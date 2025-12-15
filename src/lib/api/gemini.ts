// src/lib/api/gemini.ts
import { translationCache } from '@/lib/cache/translation-cache';

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export async function translateWithGemini(text: string): Promise<string> {
  // 캐시에서 먼저 확인
  const cached = translationCache.get(text);
  if (cached) {
    console.log('Using cached translation for:', text.substring(0, 50) + '...');
    return cached;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const prompt = `당신은 댈러스 매버릭스 팬을 위한 전문 번역가입니다. 다음 영어 뉴스 제목을 자연스럽고 매력적인 한국어로 번역해주세요.

번역 규칙:
1. 농구 용어는 한국어로 자연스럽게 번역 (예: "sleeper move" → "깜짝 영입", "no-brainer" → "당연한")
2. 선수 이름은 한글 표기 후 괄호에 영문 병기 (예: "Luka Doncic" → "루카 돈치치(Luka Doncic)")
3. 팀명은 한국어로 번역 (예: "Mavericks" → "매버릭스", "Thunder" → "썬더")
4. 자연스러운 한국어 문장 구조 사용
5. 팬들이 흥미를 가질 수 있도록 매력적으로 번역
6. 번역만 제공하고 설명이나 추가 텍스트는 포함하지 마세요

영어 제목: ${text}

한국어 번역:`;

  // 재시도 로직
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // Rate Limit 방지를 위한 지연
      if (retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 5000 * retryCount));
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        }),
      });

      if (response.status === 429) {
        // Rate Limit 오류 시 재시도
        retryCount++;
        console.log(`Rate limit hit, retrying in ${retryCount} seconds...`);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data: GeminiResponse = await response.json();
      const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      // 캐시에 저장
      translationCache.set(text, translatedText);
      translationCache.saveToStorage();

      return translatedText;

    } catch (error) {
      if (retryCount < maxRetries - 1) {
        retryCount++;
        console.log(`Translation failed, retrying... (${retryCount}/${maxRetries})`);
        continue;
      }
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  throw new Error('Max retries exceeded');
}

export async function translateContentWithGemini(content: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const prompt = `당신은 NBA 및 댈러스 매버릭스 전문 칼럼니스트이자 번역가입니다. 다음 영어 뉴스 기사 전체를 한국 독자들을 위해 번역해주세요.

번역 및 스타일 가이드:
1. **전문성 유지**: 요약하지 말고 전체 내용을 충실히 번역하세요. 문단을 나누어 가독성을 높이세요.
2. **자연스러운 흐름**: 직역투를 피하고, 한국어 칼럼처럼 매끄럽게 읽히도록 의역하세요.
3. **농구 용어 처리**: 
   - 일반적인 용어는 한국어 농구 용어로 번역 (예: "paint" -> "페인트존", "turnover" -> "턴오버", "clutch" -> "클러치").
   - 뉘앙스가 중요한 표현은 한국 팬들이 쓰는 표현으로 (예: "posterize" -> "인유어페이스 덩크를 꽂다").
4. **고유명사 표기**: 
   - 선수/감독 이름은 첫 등장 시 '한글(영어)' 병기, 이후에는 '한글'만 사용 (예: "Luka Doncic" -> "루카 돈치치(Luka Doncic)").
   - 팀명은 한글로 표기 (예: "Mavs" -> "매버릭스").
5. **어조**: "해요체"를 사용하여 친근하면서도 전문적인 느낌을 주되, 기사의 성격에 따라 적절히 조절하세요.
6. **추가 설명 금지**: 번역 결과물만 출력하세요. "여기 번역본입니다" 등의 사족은 붙이지 마세요.

영어 기사 전문:
${content}

한국어 번역 전문:`;

  // 재시도 로직
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // Rate Limit 방지를 위한 지연 (본문 번역은 토큰 소모가 크므로 더 긴 지연 필요할 수 있음)
      if (retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 8000 * retryCount));
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192, // 본문 번역을 위해 토큰 수 증가
          }
        }),
      });

      if (response.status === 429) {
        retryCount++;
        console.log(`Content translation rate limit hit, retrying in ${retryCount * 5} seconds...`);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data: GeminiResponse = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    } catch (error) {
      if (retryCount < maxRetries - 1) {
        retryCount++;
        console.log(`Content translation failed, retrying... (${retryCount}/${maxRetries})`);
        continue;
      }
      console.error('Gemini API error (content):', error);
      throw error;
    }
  }

  throw new Error('Max retries exceeded for content translation');
}

export async function batchTranslateWithGemini(texts: string[]): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  // 캐시에서 먼저 확인하고 번역이 필요한 텍스트만 필터링
  const results: string[] = [];
  const textsToTranslate: { text: string; index: number }[] = [];

  texts.forEach((text, index) => {
    const cached = translationCache.get(text);
    if (cached) {
      results[index] = cached;
    } else {
      textsToTranslate.push({ text, index });
    }
  });

  // 모든 텍스트가 캐시에 있으면 바로 반환
  if (textsToTranslate.length === 0) {
    return results;
  }

  // 배치 번역을 위한 프롬프트 생성
  const batchPrompt = `당신은 댈러스 매버릭스 팬을 위한 전문 번역가입니다. 다음 영어 뉴스 제목들을 자연스럽고 매력적인 한국어로 번역해주세요.

번역 규칙:
1. 농구 용어는 한국어로 자연스럽게 번역 (예: "sleeper move" → "깜짝 영입", "no-brainer" → "당연한")
2. 선수 이름은 한글 표기 후 괄호에 영문 병기 (예: "Luka Doncic" → "루카 돈치치(Luka Doncic)")
3. 팀명은 한국어로 번역 (예: "Mavericks" → "매버릭스", "Thunder" → "썬더")
4. 자연스러운 한국어 문장 구조 사용
5. 팬들이 흥미를 가질 수 있도록 매력적으로 번역
6. 각 번역은 줄바꿈으로 구분하고 번호는 제거하세요
7. 번역만 제공하고 설명이나 추가 텍스트는 포함하지 마세요

영어 제목들:
${textsToTranslate.map((item, i) => `${i + 1}. ${item.text}`).join('\n')}

한국어 번역:`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: batchPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data: GeminiResponse = await response.json();
    const batchResult = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // 번역 결과를 줄바꿈으로 분리
    const translations = batchResult.split('\n').map(t => t.trim()).filter(t => t);

    // 결과를 원래 위치에 배치하고 캐시에 저장
    textsToTranslate.forEach((item, i) => {
      const translation = translations[i] || item.text; // 번역 실패 시 원본 사용
      results[item.index] = translation;
      translationCache.set(item.text, translation);
    });

    translationCache.saveToStorage();

    return results;

  } catch (error) {
    console.error('Batch translation error:', error);
    // 에러 시 원본 텍스트 반환
    textsToTranslate.forEach(item => {
      results[item.index] = item.text;
    });
    return results;
  }
}

export async function summarizeWithGemini(title: string, content: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const prompt = `당신은 댈러스 매버릭스 팬을 위한 전문 뉴스 요약가입니다. 다음 영어 뉴스 기사를 자연스러운 한국어로 요약해주세요.

요약 규칙:
1. 100자 이내로 간결하게 요약
2. 댈러스 매버릭스와 관련된 핵심 내용에 집중
3. 선수 이름은 한글 표기 후 괄호에 영문 병기 (예: "Luka Doncic" → "루카 돈치치(Luka Doncic)")
4. 농구 용어는 한국어로 자연스럽게 번역
5. 팬들이 관심 가질만한 정보 우선
6. 자연스러운 한국어 문장으로 작성
7. 요약만 제공하고 추가 설명은 포함하지 마세요

제목: ${title}
내용: ${content}

한국어 요약:`;

  // 재시도 로직
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // Rate Limit 방지를 위한 지연
      if (retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 5000 * retryCount));
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 200,
          }
        }),
      });

      if (response.status === 429) {
        // Rate Limit 오류 시 재시도
        retryCount++;
        console.log(`Summary rate limit hit, retrying in ${retryCount * 2} seconds...`);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data: GeminiResponse = await response.json();
      const summary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      // 100자 제한 적용
      return summary.length > 100
        ? summary.substring(0, 100) + '...'
        : summary;

    } catch (error) {
      if (retryCount < maxRetries - 1) {
        retryCount++;
        console.log(`Summary failed, retrying... (${retryCount}/${maxRetries})`);
        continue;
      }
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  throw new Error('Max retries exceeded');
}
