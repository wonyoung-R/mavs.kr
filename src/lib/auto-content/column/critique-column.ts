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
 * few-shot 예시로 검수 판단을 안정화하고, 동시에 4096+ 토큰을 확보해
 * prompt caching이 실제 적중하도록 설계한다.
 */
const CRITIQUE_TASK_INSTRUCTIONS = `
## 작업: 자동 칼럼 엄격 검수 (너는 검수만 한다. 칼럼을 다시 쓰지 않는다.)

**핵심 검증: 환각(hallucination) 탐지**

칼럼에 등장하는 모든 고유명사·구체 사실을 출처 기사에서 한 건씩 찾아 대조하라:
- 선수/감독 이름
- 팀명 / 도시명 / 경기장명
- 숫자/스탯 (득점, 어시스트, 야투율, 점수 차 등)
- 사건/상황 (트레이드, 부상, 연승, 부진 등)
- 시즌 위치 (플레이오프, 정규시즌, 시즌 종료 등)
- 인용 발언과 발언자

**출처에서 매칭되지 않는 항목 = 환각.** 환각이 1건이라도 있으면 REJECT.
모델 사전 지식으로 추측해 채운 내용은 사실로 인정하지 않는다.

## 검수 절차 (이 순서로)

1. 칼럼에서 모든 고유명사·숫자·상황을 추출한다.
2. 각 항목을 출처 기사에서 찾는다.
3. 출처에 없는 항목이 하나라도 있으면 → hallucinations 배열에 적고 REJECT.
4. 환각이 0건이면 톤·문체를 본다.

## 평가 기준

1. **환각 0건** (가장 중요 — 위 절차로 검증)
2. 관찰형 톤 (처방형 "~해야 한다", 단정 미래 "~할 것이다" 없음)
3. 선수/코치 비방 없음
4. MAVS.KR 톤 (이모지 X, 과장 어휘 X, 메타 언급 X)
5. 한국어 자연스러움
6. SEO 친화 (제목에 핵심 키워드, 본문 800~1500자)

## 판정

- **PASS**: 환각 0건 + 나머지 기준 모두 충족
- **REVISE**: 환각 0건이지만 톤/문체 경미 위반 (재생성으로 개선 가능)
- **REJECT**: 환각 1건 이상, 또는 심각한 톤 위반

## few-shot 예시

### 예시 1 — REJECT (환각)

출처 기사: "댈러스 매버릭스 112점, 멤피스 그리즐리스 105점. 결과: 매버릭스 승리."

검수할 칼럼 일부: "루카 돈치치가 28점 9어시스트로 팀을 이끌었고, 매버릭스는
플레이오프 경쟁에서 한 발 앞서갔다."

판정:
{
  "result": "REJECT",
  "reason": "출처에 선수 기록과 시즌 맥락이 전혀 없는데 칼럼이 이를 지어냄",
  "hallucinations": ["루카 돈치치 28점 9어시스트 (출처에 선수 기록 없음)", "플레이오프 경쟁 (출처에 시즌 맥락 없음)"]
}

### 예시 2 — PASS (깨끗)

출처 기사: "댈러스 매버릭스 112점, 멤피스 그리즐리스 105점. 7점 차. 홈 경기."

검수할 칼럼 일부: "댈러스 매버릭스가 홈에서 멤피스 그리즐리스를 112-105로 제압했다.
7점 차 승리였다. 한국 매버릭스 팬덤에게는 반가운 홈 승리다."

판정:
{
  "result": "PASS",
  "reason": "모든 사실(112-105, 7점 차, 홈, 상대팀)이 출처와 일치. 환각 0건. 톤 적절.",
  "hallucinations": []
}

### 예시 3 — REVISE (톤 경미 위반)

출처 기사: "댈러스 매버릭스 112점, 멤피스 그리즐리스 105점."

검수할 칼럼 일부: "매버릭스의 폭발적인 공격력이 그리즐리스를 압도했다. 앞으로도
이런 경기력을 이어갈 것이다."

판정:
{
  "result": "REVISE",
  "reason": "환각은 없으나 '폭발적인'은 과장 어휘, '이어갈 것이다'는 단정 미래",
  "hallucinations": []
}

## JSON 출력 (다른 텍스트 없이 JSON만)
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
  model?: string,
): Promise<CritiqueColumnOutput> {
  const raw = await callLLMJSON<CritiqueColumnOutput>(buildUserPrompt(article, column), {
    systemInstruction: buildSystemPrompt(CRITIQUE_TASK_INSTRUCTIONS, team),
    temperature: 0.1,
    // 환각 다수 탐지 시 reason+hallucinations가 길어짐 — 잘림 방지로 충분히 확보
    maxOutputTokens: 1024,
    model,
  });

  if (!['PASS', 'REVISE', 'REJECT'].includes(raw.result)) {
    return { result: 'REJECT', reason: `invalid result: ${raw.result}` };
  }
  return raw;
}
