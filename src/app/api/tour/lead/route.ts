import { createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { getTourLeadConsent, isTourLeadConfigured, saveTourLead } from '@/lib/tour-lead';

export const runtime = 'nodejs';
export const maxDuration = 30;

const maxBodyBytes = 8_192;
const rateWindow = 5 * 60_000;
const rateLimit = 12;
const rateSalt = randomBytes(32);
const rateBuckets = new Map<string, { count: number; until: number }>();
const intents = ['적극', '상담 후 결정', '관심'];
const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

function error(status: number, code: string, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ ok: false, code, message }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

async function readPayload(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > maxBodyBytes) throw new RangeError('Body too large');
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing body');
  const chunks = new Uint8Array(maxBodyBytes);
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (length + value.byteLength > maxBodyBytes) {
        void reader.cancel().catch(() => undefined);
        throw new RangeError('Body too large');
      }
      chunks.set(value, length);
      length += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(chunks.subarray(0, length))) as unknown;
}

function rateLimitDelay(request: Request) {
  const address = process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() : '';
  const bucketKey = address && isIP(address) ? createHmac('sha256', rateSalt).update(address).digest('base64url') : 'unavailable';
  const now = Date.now();
  if (rateBuckets.size >= 512) {
    for (const [key, bucket] of rateBuckets) {
      if (bucket.until <= now) rateBuckets.delete(key);
    }
  }
  const bucket = rateBuckets.get(bucketKey);
  if (bucket && bucket.until > now) {
    if (bucket.count >= rateLimit) return Math.ceil((bucket.until - now) / 1000);
    bucket.count++;
  } else if (rateBuckets.size < 512 || bucket) {
    rateBuckets.set(bucketKey, { until: now + rateWindow, count: 1 });
  } else {
    return Math.ceil(rateWindow / 1000);
  }
  return 0;
}

function attributionOf(payload: Record<string, unknown>) {
  const values: string[] = [];
  const utm = payload.utm;
  if (isRecord(utm)) {
    for (const key of utmKeys) {
      const input = utm[key];
      if (typeof input !== 'string') continue;
      const text = input.replace(/[\x00-\x20\x7f\s]+/g, ' ').trim().slice(0, 120);
      if (text) values.push(`${key}=${text}`);
    }
  }
  if (typeof payload.referrer === 'string' && URL.canParse(payload.referrer)) {
    const url = new URL(payload.referrer);
    if (url.protocol === 'https:' || url.protocol === 'http:') values.push(`referrer=${url.origin}`);
  }
  return values.join(' | ');
}

function stringField(value: unknown, maxLength: number) {
  if (value === undefined) return '';
  if (typeof value !== 'string') return null;
  const text = value.trim().normalize('NFC');
  return text.length > maxLength || text.includes('\u0000') ? null : text;
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  const url = new URL(request.url);
  const host = request.headers.get('host')?.toLowerCase() ?? url.host;
  if (origin !== `${url.protocol}//${host}` || site === 'cross-site' || site === 'same-site') {
    return error(403, 'invalid_origin', '이 페이지에서 다시 제출해 주세요.');
  }
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return error(415, 'invalid_content_type', '신청 양식을 다시 열어 제출해 주세요.');
  }
  const retryAfter = rateLimitDelay(request);
  if (retryAfter) return error(429, 'rate_limited', '등록 시도가 많습니다. 잠시 후 다시 시도해 주세요.', { 'Retry-After': String(retryAfter) });

  const consent = getTourLeadConsent();
  if (!consent || !isTourLeadConfigured()) {
    return error(503, 'registration_unavailable', '현재 관심 등록을 받을 수 없습니다.');
  }
  let payload: unknown;
  try {
    payload = await readPayload(request);
  } catch (bodyError) {
    return bodyError instanceof RangeError
      ? error(413, 'request_too_large', '등록 내용이 너무 깁니다.')
      : error(400, 'invalid_json', '신청 양식을 다시 확인해 주세요.');
  }
  if (!isRecord(payload)) return error(400, 'invalid_input', '신청 양식을 다시 확인해 주세요.');
  if (payload.website !== undefined && payload.website !== '') {
    return error(400, 'invalid_input', '신청 양식을 다시 확인해 주세요.');
  }

  const name = stringField(payload.name, 80);
  const phoneInput = stringField(payload.phone, 30);
  const email = stringField(payload.email, 254);
  const instagram = stringField(payload.instagram, 31);
  const inquiry = stringField(payload.inquiry, 1000);
  const { partySize, intent, privacyConsent, marketingConsent, consentVersion } = payload;
  const phone = phoneInput?.replace(/[ ()-]/g, '');

  if (!name || /[\x00-\x1f\x7f]/.test(name)) return error(400, 'invalid_name', '이름을 확인해 주세요.');
  if (!phone || !/^\+?\d{7,15}$/.test(phone)) return error(400, 'invalid_phone', '연락처를 확인해 주세요.');
  if (email === null || (email && !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email))) return error(400, 'invalid_email', '이메일 형식을 확인해 주세요.');
  if (instagram === null || (instagram && !/^@?[A-Za-z0-9_.]{1,30}$/.test(instagram))) return error(400, 'invalid_instagram', '인스타그램 ID를 확인해 주세요.');
  if (typeof partySize !== 'number' || !Number.isInteger(partySize) || partySize < 1 || partySize > 99) return error(400, 'invalid_party_size', '참가 인원은 1명부터 99명까지 입력해 주세요.');
  if (typeof intent !== 'string' || !intents.includes(intent)) return error(400, 'invalid_intent', '참가 의향을 선택해 주세요.');
  if (inquiry === null) return error(400, 'invalid_inquiry', '문의는 1,000자 이내로 입력해 주세요.');
  if (privacyConsent !== true || (marketingConsent !== undefined && typeof marketingConsent !== 'boolean')) {
    return error(400, 'invalid_consent', '개인정보 수집·이용 동의 항목을 확인해 주세요.');
  }
  if (consentVersion !== consent.version) {
    return error(409, 'consent_changed', '페이지를 새로고침해 최신 개인정보 안내를 확인해 주세요.');
  }

  try {
    await saveTourLead({ name, phone, email, instagram: instagram.replace(/^@/, '').toLowerCase(), partySize, intent,
      inquiry, consentVersion, marketingConsent: marketingConsent === true, attribution: attributionOf(payload) });
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('[tour lead] Database write failed');
    return error(503, 'registration_unavailable', '등록을 확인하지 못했습니다. 입력 내용을 그대로 두고 다시 시도해 주세요.');
  }
}
