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
 * 검수 지시문 — 매 호출 동일하므로 system 프롬프트에 들어간다.
 *
 * 설계 의도 (비용 최소화 재설계, B안):
 * - 판정 기준을 엄격히 분리: 환각만 REJECT, 톤 문제는 REVISE.
 *   (이전엔 사소한 톤 흠을 REJECT로 처리 → 거부율 83% 중 상당수가 톤 오판)
 * - 출력을 간결화 (reason 1문장 80자 이내) → 출력 토큰 절감.
 * - few-shot 압축, 출처 슬라이스를 generate와 동일하게 맞춤 (이전 4000자 → 8000자).
 */
const CRITIQUE_TASK_INSTRUCTIONS = `
## 작업: 자동 칼럼 환각 검수 (검수만 한다. 칼럼을 다시 쓰지 않는다.)

칼럼에 등장하는 모든 고유명사·숫자·상황을 출처 기사에서 한 건씩 대조한다.
출처에서 매칭되지 않는 항목 = 환각. 모델 사전 지식으로 채운 내용은 사실로 인정하지 않는다.

## 판정 (엄격히 구분 — 중요)

- **REJECT**: 출처에 없는 사실·이름·숫자(환각)가 1건이라도 있을 때 **만**.
- **REVISE**: 환각은 0건이지만 톤·문체 위반 (처방형 "~해야 한다", 단정 미래 "~할 것이다",
  과장 어휘, 편집자적 판단 "~관전 포인트다" 등).
- **PASS**: 환각 0건 + 톤도 깨끗.

※ 톤 문제를 REJECT로 올리지 마라. REJECT는 환각 전용이다.
※ 출처에 명시된 사실을 "표현이 좀 다르다"는 이유로 환각 처리하지 마라.

## 검수 절차

1. 칼럼의 고유명사·숫자·상황을 추출한다.
2. 각 항목을 출처에서 찾는다.
3. 출처에 없는 항목이 있으면 → hallucinations에 적고 REJECT.
4. 환각 0건이면 톤을 본다 → 위반 있으면 REVISE, 없으면 PASS.

## 출력 규칙 (간결하게)

- reason: 1문장, 80자 이내. 장황한 설명 금지.
- hallucinations: 환각 항목만 짧게 나열. REJECT가 아니면 빈 배열.

## few-shot

출처: "댈러스 매버릭스 112, 멤피스 그리즐리스 105. 7점 차. 홈 경기."

- 칼럼 A: "루카 돈치치가 28점으로 팀을 이끌었다."
  → { "result": "REJECT", "reason": "출처에 선수 기록 없음", "hallucinations": ["루카 돈치치 28점"] }
- 칼럼 B: "매버릭스가 홈에서 112-105로 이겼다. 한국 팬덤에 반가운 소식이다."
  → { "result": "PASS", "reason": "모든 사실이 출처와 일치", "hallucinations": [] }
- 칼럼 C: "매버릭스의 폭발적 공격이 압도했다. 이 흐름을 이어갈 것이다."
  → { "result": "REVISE", "reason": "'폭발적' 과장 어휘, '이어갈 것이다' 단정 미래", "hallucinations": [] }

## JSON만 출력 (다른 텍스트 없이)
{
  "result": "PASS" | "REVISE" | "REJECT",
  "reason": "<1문장 80자 이내>",
  "hallucinations": ["<환각 항목>"]
}`;

function buildUserPrompt(article: string, column: ColumnOutput): string {
  // closingParagraph는 검수 대상에서 제외한다.
  // 마무리는 LLM이 쓴 게 아니라 closings.ts의 고정 템플릿(설계상 환각·톤 위반 0)이므로,
  // 검수에 포함하면 "출처에 없는 문장"으로 항상 REJECT되는 오탐이 발생한다.
  const llmGeneratedText = [
    column.titleKr,
    column.leadParagraph,
    ...column.bodyParagraphs,
  ].join('\n\n');

  return `출처 기사:
---
${article.slice(0, 8000)}
---

검수할 칼럼:
---
${llmGeneratedText}
---`;
}

export async function critiqueColumn(
  article: string,
  column: ColumnOutput,
  team?: TeamTag,
  model?: string,
): Promise<CritiqueColumnOutput> {
  const raw = await callLLMJSON<CritiqueColumnOutput>(buildUserPrompt(article, column), {
    systemInstruction: buildSystemPrompt(CRITIQUE_TASK_INSTRUCTIONS, team),
    temperature: 0.1,
    // reason 1문장 + hallucinations 짧게 → 이전 1024에서 축소
    maxOutputTokens: 400,
    model,
  });

  if (!['PASS', 'REVISE', 'REJECT'].includes(raw.result)) {
    return { result: 'REJECT', reason: `invalid result: ${raw.result}` };
  }
  return raw;
}
