import { callLLMJSON } from '../claude';
import { buildSystemPrompt } from '../prompt/system';
import type { TeamTag } from '../publisher';
import type { ColumnOutput } from './generate-column';

export type CritiqueResult = 'PASS' | 'REVISE' | 'REJECT';

export interface CritiqueColumnOutput {
  result: CritiqueResult;
  reason: string;
  hallucinations?: string[];
}

/**
 * 안정적 검수 지시문 — 매 호출 동일하므로 system 프롬프트(캐시 prefix)에 들어간다.
 */
const CRITIQUE_TASK_INSTRUCTIONS = `
## 작업: 자동 칼럼 엄격 검수 (너는 검수만 한다. 칼럼을 다시 쓰지 않는다.)

**핵심 검증: 환각(hallucination) 탐지**

칼럼에 등장하는 모든 고유명사·구체 사실을 출처 기사에서 찾아라:
- 선수/감독 이름
- 팀명 / 도시명 / 경기장명
- 숫자/스탯 (득점, 어시스트, 야투율 등)
- 사건/상황 (트레이드, 부상, 연승, 부진 등)
- 시즌 위치 (플레이오프, 정규시즌, 종료 등)
- 인용 발언

**출처에서 매칭되지 않는 항목 = 환각.** 환각이 있으면 REJECT.

평가 기준:
1. 환각 0건 (가장 중요)
2. 관찰형 톤 (처방·예측·단정 X)
3. 선수/코치 비방 없음
4. MAVS.KR 톤 (이모지 X, 과장 X, 메타 언급 X)
5. 한국어 자연스러움
6. SEO 친화 (제목에 핵심 키워드, 본문 800~1500자)

판정:
- PASS: 환각 0건 + 다른 기준 충족
- REVISE: 환각 0건이지만 톤/문체 경미 위반
- REJECT: 환각 1건 이상 또는 심각 위반

JSON으로만 응답:
{
  "result": "PASS" | "REVISE" | "REJECT",
  "reason": "<짧고 구체적 이유>",
  "hallucinations": ["<환각 항목 1>", "<환각 항목 2>"]
}`;

function buildUserPrompt(article: string, column: ColumnOutput): string {
  const fullText = [
    column.titleKr,
    column.leadParagraph,
    ...column.bodyParagraphs,
    column.closingParagraph,
  ].join('\n\n');

  return `출처 기사:
---
${article.slice(0, 4000)}
---

검수할 칼럼:
---
${fullText}
---`;
}

export async function critiqueColumn(
  article: string,
  column: ColumnOutput,
  team?: TeamTag,
): Promise<CritiqueColumnOutput> {
  const raw = await callLLMJSON<CritiqueColumnOutput>(buildUserPrompt(article, column), {
    systemInstruction: buildSystemPrompt(CRITIQUE_TASK_INSTRUCTIONS, team),
    temperature: 0.1,
    maxOutputTokens: 400,
  });

  if (!['PASS', 'REVISE', 'REJECT'].includes(raw.result)) {
    return { result: 'REJECT', reason: `invalid result: ${raw.result}` };
  }
  return raw;
}
