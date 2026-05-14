import { callLLMJSON } from '../claude';
import { buildSystemPrompt } from '../prompt/system';
import type { TeamTag } from '../publisher';

export type CritiqueResult = 'PASS' | 'REVISE' | 'REJECT';

export interface CritiqueOutput {
  result: CritiqueResult;
  reason: string;
}

const PROMPT = `너는 MAVS.KR 자동 글의 엄격한 검수자다. 다음 시각 박스를 평가해라.

**핵심 검증: 환각(hallucination) 탐지**

시각 박스에 등장하는 모든 고유명사·구체 사실을 출처 기사에서 찾아라:
- 선수 이름 (예: 루카, 카이리, 플래그, 어빙, 데이비스 등)
- 코치 이름
- 팀명 / 도시명
- 숫자/스탯 (득점, 어시스트, 야투율 등)
- 사건/상황 (트레이드, 부상, 연승, 부진 등)
- 시즌 위치 (플레이오프, 정규시즌, 시즌 종료 등)

**출처에서 매칭되지 않는 항목이 1개라도 있으면 → REJECT.**
모델 사전 지식으로 추측해서 채운 내용은 사실로 인정하지 않는다.

평가 기준 (모두 통과해야 PASS):
1. **환각 0건**: 시각 박스의 모든 구체 사실이 출처에 존재
2. 관찰형인가? (처방·예측·단정 X)
3. 선수/코치 비방이 없는가?
4. MAVS.KR 톤 부합 (이모지 X, 과장 X, 메타 언급 X)
5. 한국 매버릭스 팬덤 정서와 자연스러운가?

판정 가이드:
- PASS: 5개 기준 모두 충족 (특히 환각 0건)
- REVISE: 경미한 톤/문체 위반, 환각은 없음
- REJECT: **환각 1건 이상 발견** 또는 심각한 위반

JSON으로만 응답:
{ "result": "PASS" | "REVISE" | "REJECT", "reason": "<위반 항목과 출처 미매칭 부분을 구체적으로>" }

출처 기사:
---
{ARTICLE}
---

시각 박스:
---
{PERSPECTIVE}
---`;

export async function critiquePerspective(article: string, perspective: string, team?: TeamTag): Promise<CritiqueOutput> {
  const raw = await callLLMJSON<CritiqueOutput>(
    PROMPT.replace('{ARTICLE}', article.slice(0, 3000)).replace('{PERSPECTIVE}', perspective),
    {
      systemInstruction: buildSystemPrompt('너는 검수만 한다. 시각 박스 자체를 다시 쓰지 않는다.', team),
      temperature: 0.1,
      maxOutputTokens: 300,
    },
  );

  if (!['PASS', 'REVISE', 'REJECT'].includes(raw.result)) {
    return { result: 'REJECT', reason: `invalid result value: ${raw.result}` };
  }
  return raw;
}
