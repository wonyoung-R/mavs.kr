import { callGeminiJSON } from '../gemini';
import { buildSystemPrompt } from '../prompt/system';

export type CritiqueResult = 'PASS' | 'REVISE' | 'REJECT';

export interface CritiqueOutput {
  result: CritiqueResult;
  reason: string;
}

const PROMPT = `너는 MAVS.KR 자동 글의 검수자다. 다음 시각 박스를 평가해라.

평가 기준 (모두 통과해야 PASS):
1. 관찰형인가? (처방·예측·단정 X)
2. 출처 사실에서 벗어난 주장이 없는가?
3. 선수/코치 비방이 없는가?
4. MAVS.KR 톤(VOICE_SPEC)에 부합하는가? (이모지 X, 과장 X, 메타 언급 X)
5. 한국 매버릭스 팬덤 정서와 자연스러운가?

판정:
- PASS: 5개 기준 모두 충족
- REVISE: 1~2개 항목 경미한 위반, 재생성으로 개선 가능
- REJECT: 심각한 위반 (날조/비방/처방형 다수)

JSON으로만 응답:
{ "result": "PASS" | "REVISE" | "REJECT", "reason": "<짧은 이유>" }

출처 기사:
---
{ARTICLE}
---

시각 박스:
---
{PERSPECTIVE}
---`;

export async function critiquePerspective(article: string, perspective: string): Promise<CritiqueOutput> {
  const raw = await callGeminiJSON<CritiqueOutput>(
    PROMPT.replace('{ARTICLE}', article.slice(0, 3000)).replace('{PERSPECTIVE}', perspective),
    {
      systemInstruction: buildSystemPrompt('너는 검수만 한다. 시각 박스 자체를 다시 쓰지 않는다.'),
      temperature: 0.1,
      maxOutputTokens: 300,
    },
  );

  if (!['PASS', 'REVISE', 'REJECT'].includes(raw.result)) {
    return { result: 'REJECT', reason: `invalid result value: ${raw.result}` };
  }
  return raw;
}
