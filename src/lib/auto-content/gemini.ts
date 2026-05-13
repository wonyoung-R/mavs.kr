const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.0-flash';
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
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new GeminiError(`JSON parse failed: ${text.slice(0, 200)}`);
  }
}
