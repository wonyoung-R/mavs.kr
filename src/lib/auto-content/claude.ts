import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude API wrapper for the auto-content pipeline.
 *
 * 모델은 ANTHROPIC_MODEL 환경변수로 전환 가능:
 * - claude-haiku-4-5 (기본): 저렴 + 빠름, 고볼륨 자동화에 적합
 * - claude-sonnet-4-6: 환각 critique 품질이 더 필요할 때
 *
 * Prompt caching: 시스템 프롬프트는 stable prefix이므로 cache_control을 붙인다.
 * 같은 cron 실행 내(5분 TTL)에서 같은 task의 호출이 반복될 때만 적중한다.
 * cron이 시간 단위로 떨어져 실행되면 run 간 캐시는 적중하지 않으므로,
 * 시스템 프롬프트는 캐시를 노려 인위적으로 키우지 않고 필요한 만큼만 유지한다.
 */

// `||` 사용 의도적: ANTHROPIC_MODEL이 빈 문자열("")로 설정돼도 기본값으로 폴백한다.
// (`??`는 ""를 유효값으로 취급 → model:"" 로 API 호출 시 400)
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

const client = new Anthropic(); // ANTHROPIC_API_KEY from env

export class LLMError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'LLMError';
  }
}

export interface LLMOptions {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** 모델 오버라이드 — 비교 테스트/특수 cron용. 미지정 시 ANTHROPIC_MODEL env */
  model?: string;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

let lastUsage: LLMUsage | null = null;
export function getLastUsage(): LLMUsage | null {
  return lastUsage;
}

// 누적 usage — runColumnPipeline처럼 여러 LLM 호출의 합산 측정용
let accumulated = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 0 };
export function resetUsage(): void {
  accumulated = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 0 };
}
export function getAccumulatedUsage() {
  return { ...accumulated };
}

export async function callLLM(prompt: string, opts: LLMOptions = {}): Promise<string> {
  const { systemInstruction, temperature = 0.7, maxOutputTokens = 2048 } = opts;
  const model = opts.model ?? MODEL;
  const supportsTemp = !model.startsWith('claude-opus-4-7');

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxOutputTokens,
      ...(supportsTemp ? { temperature } : {}),
      ...(systemInstruction
        ? {
            system: [
              {
                type: 'text',
                text: systemInstruction,
                cache_control: { type: 'ephemeral' },
              },
            ],
          }
        : {}),
      messages: [{ role: 'user', content: prompt }],
    });

    lastUsage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    };
    accumulated.inputTokens += lastUsage.inputTokens;
    accumulated.outputTokens += lastUsage.outputTokens;
    accumulated.cacheReadTokens += lastUsage.cacheReadTokens;
    accumulated.cacheWriteTokens += lastUsage.cacheWriteTokens;
    accumulated.calls += 1;

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    if (!text) {
      throw new LLMError(`Empty response (stop_reason: ${response.stop_reason})`);
    }
    return text;
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      throw new LLMError(`Claude ${e.status}: ${e.message}`, e.status);
    }
    throw e instanceof Error ? e : new LLMError(String(e));
  }
}

export async function callLLMJSON<T>(prompt: string, opts: LLMOptions = {}): Promise<T> {
  const text = await callLLM(prompt, opts);
  const cleaned = extractJsonBlock(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new LLMError(`JSON parse failed: ${text.slice(0, 200)}`);
  }
}

function extractJsonBlock(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  const firstA = trimmed.indexOf('[');
  const lastA = trimmed.lastIndexOf(']');
  if (firstA >= 0 && lastA > firstA) return trimmed.slice(firstA, lastA + 1);
  return trimmed;
}

export { MODEL as CLAUDE_MODEL };
