import { callLLMJSON } from '../claude';
import { buildSystemPrompt } from '../prompt/system';
import type { RiskLevel, TeamTag } from '../publisher';

export type TopicCategory =
  | 'routine_recap'
  | 'player_performance'
  | 'emotional_moment'
  | 'transaction'
  | 'injury'
  | 'controversy'
  | 'speculation';

export const RISK_BY_CATEGORY: Record<TopicCategory, RiskLevel> = {
  routine_recap: 'low',
  player_performance: 'low',
  emotional_moment: 'low',
  transaction: 'medium',
  injury: 'medium',
  controversy: 'high',
  speculation: 'high',
};

export interface ColumnOutput {
  category: TopicCategory;
  riskLevel: RiskLevel;
  titleKr: string;
  metaDescription: string;
  leadParagraph: string;
  bodyParagraphs: string[];
  closingParagraph: string;
}

/**
 * 안정적 지시문 — 매 호출 동일하므로 system 프롬프트(캐시 prefix)에 들어간다.
 * volatile한 것은 기사 본문뿐 → user 메시지에만 둔다.
 * 카테고리별 가이드 + few-shot 예시로 환각/톤을 안정화하고,
 * 동시에 4096+ 토큰을 확보해 prompt caching이 실제 적중하도록 설계한다.
 */
const COLUMN_TASK_INSTRUCTIONS = `
## 작업: 영문 외신 → 한국어 칼럼 재창조

단순 번역이 아니라 한국 팬덤의 시각에서 자연스럽게 쓴 칼럼을 만든다.
사실은 출처 기사에서만 가져오고, MAVS.KR의 톤으로 자연스러운 한국 스포츠 기사처럼 작성한다.

## 출력 항목 (모두 채워라)

1. **category**: 아래 7개 중 하나 (가이드 참조)
2. **titleKr**: SEO 친화 한국어 제목 (25~50자, 핵심 인물/팀명/사건 포함, 과장 X)
3. **metaDescription**: 글 요약 1~2문장 (100~160자, 자연스러운 한국어, og description용)
4. **leadParagraph**: 도입부 (2~3문장, 핵심 사실 + 흥미 유발)
5. **bodyParagraphs**: 본문 단락 배열 (3~5개 단락, 단락당 2~4문장)
   - 사실 진술 + 인용 + 자연스러운 한국 팬덤 시각 분석
   - 인용 시 발언자 명시
6. **closingParagraph**: 마무리 (1~2문장, 팬덤 정서로 자연스럽게 닫기)

## 카테고리별 작성 가이드

- **routine_recap** (평범한 경기 리캡): 스코어·쿼터 흐름·핵심 선수 기록 중심.
  결과를 담담하게 전하되 한국 팬덤이 주목할 포인트(연승/연패, 홈/원정)를 한 번 짚는다.
- **player_performance** (특정 선수 활약/스탯): 그 선수의 구체 스탯을 앞세운다.
  출처에 있는 숫자만 쓰고, 커리어 맥락은 출처에 명시된 경우에만 언급한다.
- **emotional_moment** (감동/극적 순간): 역전·버저비터·복귀전 등.
  장면을 생생하게 전하되 과장 어휘는 쓰지 않는다. 사실의 무게로 감정을 전한다.
- **transaction** (트레이드/계약/방출 확정): 확정된 사실만. "~로 알려졌다" 같은
  미확정 표현은 출처가 그렇게 쓴 경우에만. 팬덤 반응은 "주목하는 변수다" 수준으로.
- **injury** (부상/복귀): 부상 부위·예상 결장 기간 등 출처 명시 사실만.
  의학적 추측 금지. 복귀 시점 단정 금지.
- **controversy** (코칭/구단 운영 논란): 가장 신중하게. 양측 입장을 출처대로 전하고
  MAVS.KR이 어느 편도 들지 않는다. "팬덤이 지켜보는 사안" 수준의 거리두기.
- **speculation** (루머/예측/가십): 루머임을 명시한다. 출처가 누구의 주장인지 밝히고,
  그것을 사실처럼 쓰지 않는다.

## 절대 규칙 (환각 0)

- 출처에 없는 선수명/감독명/스탯/시즌 위치/부상/트레이드 이력 → 추가 절대 금지
- 너의 사전 지식(트레이닝 데이터) 사용 금지. 출처에 없으면 모르는 것으로 취급하고 뺀다.
- **출처 매체명(Mavs Moneyball, ESPN 등)을 본문에 인용 금지.** "OO 매체가 분석했다",
  "해당 매체는~" 같은 표현을 쓰지 마라. 출처 매체명은 user 메시지의 메타 정보일 뿐
  기사 본문 사실이 아니다. 분석 내용은 매체 인용 없이 그대로 서술한다.
- 영문 표현을 한국어로 옮길 때 정확히: "second half"는 "후반전"(2쿼터 아님),
  "just under 30 minutes"는 "30분 가까이"(구체 수치로 단정 금지)
- 처방형("~해야 한다"), 단정 미래("~할 것이다") 금지
- 이모지 / 과장 어휘(충격적, 폭발적, 미친) / 메타 언급(조회수 등) 금지
- 마크다운/HTML 태그 없이 순수 텍스트
- 전체 길이 800~1500자 권장 (SEO)

## 흔한 환각 패턴 (피할 것)

- 출처에 점수만 있는데 "루카 돈치치가 30점" 같은 선수 기록을 지어냄
- 출처에 없는데 "플레이오프 진출을 위해" 같은 시즌 맥락을 덧붙임
- "이 선수는 부활하고 있다" 같은 출처에 없는 서사를 만듦
- 한 경기 결과로 "팀이 상승세다" 같은 추세를 단정함

## few-shot 예시

### 입력 출처 기사 (예시)
"날짜(ET): 2026-03-02. 홈에서 진행된 경기. 댈러스 매버릭스 112점, 멤피스 그리즐리스 105점.
결과: 매버릭스 승리 (7점 차). 쿼터별 점수 — 매버릭스: 28-30-26-28, 그리즐리스: 25-27-29-24."

### 좋은 출력 (이렇게)
{
  "category": "routine_recap",
  "titleKr": "매버릭스, 홈에서 그리즐리스 꺾고 7점 차 승리",
  "metaDescription": "댈러스 매버릭스가 홈에서 멤피스 그리즐리스를 112-105로 꺾었다. 4쿼터까지 안정적인 리드를 지킨 경기였다.",
  "leadParagraph": "댈러스 매버릭스가 홈에서 멤피스 그리즐리스를 112-105로 제압했다. 7점 차 승리로, 매 쿼터 고른 득점을 보여준 경기였다.",
  "bodyParagraphs": [
    "경기는 큰 기복 없이 흘러갔다. 매버릭스는 1쿼터 28점, 2쿼터 30점으로 초반 흐름을 잡았고, 후반에도 26점과 28점을 기록하며 리드를 유지했다.",
    "그리즐리스는 3쿼터에 29점을 올리며 추격을 시도했지만, 매버릭스의 4쿼터 28점에 막혔다. 홈 팬들 앞에서 안정적으로 경기를 마무리한 모습이다."
  ],
  "closingParagraph": "한국 매버릭스 팬덤에게는 기복 없는 홈 승리가 반가운 소식이다."
}

여기서 핵심: 출처에 있는 숫자(112-105, 7점 차, 쿼터별 점수)만 사용했고,
선수 이름이나 시즌 맥락은 출처에 없으므로 일절 등장시키지 않았다.

### 나쁜 출력 (이렇게 하지 말 것)
- "루카 돈치치가 28점으로 팀을 이끌었다" → 출처에 선수 기록 없음. 환각.
- "이번 승리로 매버릭스는 플레이오프 경쟁에서 유리한 고지를 점했다" → 출처에 시즌 맥락 없음. 환각.
- "매버릭스의 막을 수 없는 공격력이 폭발했다" → 과장 어휘.

### 입력 출처 기사 (예시 2 — 선수 기록이 포함된 경우)
"날짜(ET): 2026-03-05. 원정에서 진행된 경기. 댈러스 매버릭스 98점, 피닉스 선스 110점.
결과: 매버릭스 패배 (12점 차).
매버릭스 주요 선수 기록:
- 카이리 어빙 (선발): 24점, 리바운드 3, 어시스트 6. 야투 9/19.
- 클레이 톰슨 (선발): 18점, 리바운드 4, 어시스트 2. 야투 7/15, 3점 4/9."

### 좋은 출력 (예시 2 — 출처에 있는 선수 기록만 사용)
{
  "category": "routine_recap",
  "titleKr": "매버릭스, 선스 원정서 98-110 패배…12점 차로 무릎",
  "metaDescription": "댈러스 매버릭스가 피닉스 선스 원정 경기에서 98-110으로 패했다. 카이리 어빙이 24점으로 분전했으나 팀 득점이 98점에 그쳤다.",
  "leadParagraph": "댈러스 매버릭스가 피닉스 선스 원정에서 98-110으로 패했다. 12점 차 패배로, 팀 득점이 100점을 넘기지 못한 경기였다.",
  "bodyParagraphs": [
    "카이리 어빙이 24점에 어시스트 6개를 기록하며 공격을 이끌었다. 야투는 19개 중 9개를 성공시켰다.",
    "클레이 톰슨은 18점을 보탰다. 3점슛 9개를 시도해 4개를 적중시켰지만, 팀 전체 득점이 98점에 머무르며 원정 패배를 막지 못했다."
  ],
  "closingParagraph": "원정 경기의 아쉬운 패배를 한국 매버릭스 팬덤도 지켜봤다."
}

여기서 핵심: 출처에 명시된 선수(카이리 어빙, 클레이 톰슨)와 그 스탯만 사용했다.
출처에 없는 다른 선수나 "부진하다" 같은 추세 단정은 일절 넣지 않았다.

## JSON 출력 (다른 텍스트 없이 JSON만)
{
  "category": "<카테고리>",
  "titleKr": "<제목>",
  "metaDescription": "<메타>",
  "leadParagraph": "<리드>",
  "bodyParagraphs": ["<단락1>", "<단락2>", "<단락3>"],
  "closingParagraph": "<마무리>"
}`;

function buildUserPrompt(article: string, sourceLabel: string): string {
  return `아래는 영문 외신 기사 본문이다.
(출처 매체: ${sourceLabel} — 참고용 메타 정보. 이 매체명을 칼럼 본문에 인용하지 말 것.)

기사 본문:
---
${article.slice(0, 8000)}
---`;
}

export async function generateColumn(
  article: string,
  team: TeamTag = 'mavericks',
  sourceLabel: string = '외신',
  model?: string,
): Promise<ColumnOutput> {
  const raw = await callLLMJSON<Omit<ColumnOutput, 'riskLevel'>>(
    buildUserPrompt(article, sourceLabel),
    {
      // system = VOICE_SPEC + team 컨텍스트 + 안정적 작업 지시문 → 캐시 prefix
      systemInstruction: buildSystemPrompt(COLUMN_TASK_INSTRUCTIONS, team),
      temperature: 0.6,
      maxOutputTokens: 2400,
      model,
    },
  );

  const category = (raw.category in RISK_BY_CATEGORY ? raw.category : 'routine_recap') as TopicCategory;
  return {
    category,
    riskLevel: RISK_BY_CATEGORY[category],
    titleKr: raw.titleKr,
    metaDescription: raw.metaDescription,
    leadParagraph: raw.leadParagraph,
    bodyParagraphs: Array.isArray(raw.bodyParagraphs) ? raw.bodyParagraphs : [],
    closingParagraph: raw.closingParagraph,
  };
}

export function renderColumnMarkdown(col: ColumnOutput): string {
  const parts: string[] = [];
  parts.push(col.leadParagraph.trim());
  parts.push('');
  for (const p of col.bodyParagraphs) {
    parts.push(p.trim());
    parts.push('');
  }
  parts.push(col.closingParagraph.trim());
  return parts.join('\n').trim();
}

export function renderColumnHtml(col: ColumnOutput): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const parts: string[] = [];
  parts.push(`<p>${esc(col.leadParagraph.trim())}</p>`);
  for (const p of col.bodyParagraphs) {
    parts.push(`<p>${esc(p.trim())}</p>`);
  }
  parts.push(`<p>${esc(col.closingParagraph.trim())}</p>`);
  return parts.join('\n');
}
