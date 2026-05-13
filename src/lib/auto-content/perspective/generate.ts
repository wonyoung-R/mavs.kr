import { callGemini } from '../gemini';
import { buildSystemPrompt } from '../prompt/system';
import type { RiskLevel } from '../publisher';

const TEMPLATE_LOW = `너는 MAVS.KR의 시각 박스를 작성한다.

규칙:
- 길이: 2~4문장, 80~200자
- 톤: 관찰형. "~한 모습이 보였다", "~로 느껴진다", "~는 흐름이다"
- MAVS.KR 톤(VOICE_SPEC) 차용
- 한국 매버릭스 팬덤 정서와 자연스럽게 연결 가능

절대 금지:
- 처방형: "~해야 한다"
- 단정 미래: "~할 것이다"
- 출처에 없는 사실 주장
- 선수/코치 비판

출처 기사:
---
{ARTICLE}
---

시각 박스 텍스트만 출력. 제목/머리말/꼬리말 없이.`;

const TEMPLATE_MEDIUM = `너는 MAVS.KR의 시각 박스를 작성한다. 이 토픽은 medium 리스크다.

규칙:
- 길이: 2~3문장, 80~150자
- 톤: 사실 진술 + 팬덤 관심사 명시. 예: "매버릭스 팬덤이 가장 주목하는 변수다"
- 의견/전망 금지

절대 금지:
- 처방형, 단정 미래
- 출처에 없는 사실 주장
- 선수/코치 비판

출처 기사:
---
{ARTICLE}
---

시각 박스 텍스트만 출력. 제목/머리말/꼬리말 없이.`;

const TEMPLATE_HIGH = `너는 MAVS.KR의 시각 박스를 작성한다. 이 토픽은 high 리스크(논란/추측)다.

규칙:
- 길이: 1~2문장, 50~100자
- 톤: 맥락 진술만. 어떤 입장도 취하지 않음
- 예: "이 사안은 한국 매버릭스 팬덤이 신중하게 지켜보는 흐름이다"

절대 금지:
- 처방형, 단정 미래, 입장 표명
- 출처에 없는 사실 주장

출처 기사:
---
{ARTICLE}
---

시각 박스 텍스트만 출력. 제목/머리말/꼬리말 없이.`;

const TEMPLATES: Record<RiskLevel, string> = {
  low: TEMPLATE_LOW,
  medium: TEMPLATE_MEDIUM,
  high: TEMPLATE_HIGH,
};

export async function generatePerspective(article: string, riskLevel: RiskLevel): Promise<string> {
  const prompt = TEMPLATES[riskLevel].replace('{ARTICLE}', article.slice(0, 4000));
  const text = await callGemini(prompt, {
    systemInstruction: buildSystemPrompt(),
    temperature: 0.6,
    maxOutputTokens: 400,
  });
  return text.trim();
}
