const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export interface GeminiOptions {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: 'text/plain' | 'application/json';
  retries?: number;
}

export class GeminiError extends Error {
  constructor(message: string, public readonly status?: number, public readonly body?: string) {
    super(message);
    this.name = 'GeminiError';
  }
}

export async function callGemini(prompt: string, opts: GeminiOptions = {}): Promise<string> {
  if (!GEMINI_API_KEY) throw new GeminiError('GEMINI_API_KEY missing');

  const {
    systemInstruction,
    temperature = 0.7,
    maxOutputTokens = 2048,
    responseMimeType = 'text/plain',
    retries = 2,
  } = opts;

  const body = {
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      responseMimeType,
      // Gemini 2.5 thinking 비활성화 (응답 잘림 방지). 2.0에서는 무시됨.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status === 429 && attempt < retries) {
          // rate limit: 5s, 10s 백오프
          await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        throw new GeminiError(`Gemini ${res.status}`, res.status, text);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string') {
        throw new GeminiError('Empty response', undefined, JSON.stringify(data).slice(0, 500));
      }
      return text.trim();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new GeminiError(String(lastErr));
}

export async function callGeminiJSON<T>(prompt: string, opts: Omit<GeminiOptions, 'responseMimeType'> = {}): Promise<T> {
  const text = await callGemini(prompt, { ...opts, responseMimeType: 'application/json' });
  const cleaned = extractJsonBlock(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new GeminiError(`JSON parse failed: ${text.slice(0, 200)}`);
  }
}

function extractJsonBlock(raw: string): string {
  const trimmed = raw.trim();
  // ```json ... ``` 또는 ``` ... ``` 코드블록 제거
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();
  // 첫 { ~ 마지막 } 구간 추출
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  // 배열 형태
  const firstA = trimmed.indexOf('[');
  const lastA = trimmed.lastIndexOf(']');
  if (firstA >= 0 && lastA > firstA) return trimmed.slice(firstA, lastA + 1);
  return trimmed;
}
