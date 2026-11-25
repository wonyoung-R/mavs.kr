import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getTourPrisma } from '@/lib/db/tour-prisma';
import { supabase } from '@/lib/db/supabase';
import { tourAdminNoteLimit, tourLeadStatuses, type TourLeadStatus } from '@/lib/tour-admin-types';

export const runtime = 'nodejs';

const pageSize = 30;
const maxPage = 1000;
const operatorEmail = 'mavsdotkr@gmail.com';

const leadFields = {
  id: true,
  name: true,
  phone: true,
  email: true,
  instagram: true,
  partySize: true,
  intent: true,
  inquiry: true,
  attribution: true,
  consentVersion: true,
  consentedAt: true,
  marketingConsent: true,
  status: true,
  adminNote: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TourLeadSelect;

function reply(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}

function failure(status: number, message: string) {
  return reply({ ok: false, message }, status);
}

async function authorize(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ') || authorization.length <= 7 || authorization.length > 8192) {
    return failure(401, '관리자 계정으로 로그인해 주세요.');
  }
  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!authUrl || authUrl.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return requestError();
  }
  const { data, error } = await supabase.auth.getUser(authorization.slice(7));
  if (error?.name === 'AuthRetryableFetchError' || (error?.status && error.status >= 500)) return requestError();
  if (error || !data.user) return failure(401, '관리자 계정으로 로그인해 주세요.');
  // Contact data is restricted to the verified operator used by the site's existing protected admin flow.
  if (data.user.email?.toLowerCase() !== operatorEmail || !data.user.email_confirmed_at) {
    return failure(403, '팬투어 접수 내역을 조회할 권한이 없습니다.');
  }
}

function requestError() {
  console.error('[tour admin] Request failed');
  return failure(503, '팬투어 접수 내역을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
}

function isLeadStatus(value: unknown): value is TourLeadStatus {
  return typeof value === 'string' && Object.hasOwn(tourLeadStatuses, value);
}

export async function GET(request: Request) {
  try {
    const denied = await authorize(request);
    if (denied) return denied;

    const params = new URL(request.url).searchParams;
    const status = params.get('status');
    const pageParam = params.get('page') ?? '1';
    const page = Number(pageParam);
    if ((status !== null && !isLeadStatus(status)) || !/^\d{1,4}$/.test(pageParam) || page < 1 || page > maxPage) {
      return failure(400, '상담 상태와 페이지 번호를 확인해 주세요.');
    }

    const leads = await getTourPrisma().tourLead.findMany({
      where: isLeadStatus(status) ? { status } : undefined,
      select: leadFields,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });
    return reply({ ok: true, leads: leads.slice(0, pageSize), page, hasMore: page < maxPage && leads.length > pageSize });
  } catch {
    return requestError();
  }
}

export async function PATCH(request: Request) {
  try {
    const denied = await authorize(request);
    if (denied) return denied;
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return failure(415, '저장할 상담 내용을 다시 확인해 주세요.');
    }
    if (Number(request.headers.get('content-length')) > 16_000) {
      return failure(413, '저장할 상담 내용이 너무 깁니다.');
    }

    const raw = await request.text();
    if (Buffer.byteLength(raw) > 16_000) return failure(413, '저장할 상담 내용이 너무 깁니다.');
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return failure(400, '저장할 상담 내용을 다시 확인해 주세요.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return failure(400, '저장할 상담 내용을 다시 확인해 주세요.');
    }
    const { id, status, adminNote, updatedAt } = body as Record<string, unknown>;
    if (typeof id !== 'string' || !/^[a-z0-9]{25}$/.test(id) || !isLeadStatus(status)
      || typeof adminNote !== 'string' || adminNote.length > tourAdminNoteLimit
      || /[\u0000]/.test(adminNote) || typeof updatedAt !== 'string' || updatedAt.length !== 24) {
      return failure(400, '신청 번호, 상담 상태와 메모를 확인해 주세요.');
    }
    const version = new Date(updatedAt);
    if (!Number.isFinite(version.getTime()) || version.toISOString() !== updatedAt) {
      return failure(400, '신청 내역을 새로고침한 뒤 다시 저장해 주세요.');
    }

    const [lead] = await getTourPrisma().tourLead.updateManyAndReturn({
      where: { id, updatedAt: version },
      data: { status, adminNote: adminNote.trim(), updatedAt: new Date(Math.max(Date.now(), version.getTime() + 1)) },
      select: leadFields,
    });
    if (!lead) return failure(409, '신청 내역이 변경되었습니다. 새로고침 후 다시 저장해 주세요.');
    return reply({ ok: true, lead });
  } catch {
    return requestError();
  }
}
