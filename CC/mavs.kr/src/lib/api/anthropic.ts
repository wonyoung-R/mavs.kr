// src/lib/api/anthropic.ts
export interface AnthropicResponse {
  content: Array<{
    text: string;
    type: string;
  }>;
  id: string;
  model: string;
  role: string;
  stop_reason: string;
  stop_sequence: null;
  type: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export async function summarizeNewsWithAnthropic(
  title: string,
  content: string,
  maxLength: number = 100
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const prompt = `다음 뉴스 기사를 한국어로 100자 이내로 요약해주세요. 달라스 매버릭스 팬들을 위한 사이트이므로 관련 내용에 집중해서 요약해주세요.

제목: ${title}
내용: ${content}

요약:`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data: AnthropicResponse = await response.json();
    const summary = data.content[0]?.text?.trim() || '';

    // 100자 제한 적용
    return summary.length > maxLength
      ? summary.substring(0, maxLength) + '...'
      : summary;

  } catch (error) {
    console.error('Anthropic API error:', error);
    throw error;
  }
}

export async function translateAndSummarizeNews(
  title: string,
  content: string,
  maxLength: number = 100
): Promise<string> {
  try {
    // 먼저 번역
    const translateResponse = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `${title}\n\n${content}` }),
    });

    if (!translateResponse.ok) {
      throw new Error('Translation failed');
    }

    const translateData = await translateResponse.json();
    const translatedText = translateData.translated;

    // 번역된 텍스트로 요약
    return await summarizeNewsWithAnthropic(title, translatedText, maxLength);
  } catch (error) {
    console.error('Translate and summarize error:', error);
    // 번역 실패 시 원본으로 요약 시도
    return await summarizeNewsWithAnthropic(title, content, maxLength);
  }
}
