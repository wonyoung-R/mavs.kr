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

/**
 * generate가 출력하는 자기검증 결과.
 * ok=false면 모델이 출처에 없는 걸 넣었거나 확신하지 못한 것 → 파이프라인이 critique로 라우팅한다.
 */
export interface SelfCheck {
  ok: boolean;
  concern?: string;
}

export interface ColumnOutput {
  category: TopicCategory;
  riskLevel: RiskLevel;
  titleKr: string;
  metaDescription: string;
  leadParagraph: string;
  bodyParagraphs: string[];
  /** generate는 채우지 않는다 — 파이프라인이 closings.ts 고정 템플릿으로 채운다. */
  closingParagraph: string;
  selfCheck: SelfCheck;
}

/**
 * 안정적 작업 지시문 — 매 호출 동일하므로 system 프롬프트에 들어간다.
 * volatile한 것(기사 본문)은 user 메시지에만 둔다.
 *
 * 설계 의도 (비용 최소화 재설계, B안):
 * - generate가 작성 전 자기검증을 수행 → 별도 critique 호출을 low-risk 글에서 생략 가능.
 * - 실측 거부 사유 1위였던 마무리 단락은 LLM이 쓰지 않는다 (closings.ts 고정 풀).
 * - few-shot은 1개로 압축 (이전엔 2개 + 장문 — 매 호출 입력 토큰 낭비).
 */
const COLUMN_TASK_INSTRUCTIONS = `
## 작업: 영문 외신 → 한국어 칼럼 재창조 (+ 작성 전 자기검증)

단순 번역이 아니라 한국 댈러스 농구 팬덤의 시각으로 쓴 칼럼을 만든다.
사실은 오직 출처 기사에서만 가져온다. MAVS.KR 톤의 한국 스포츠 기사처럼 쓴다.

## 작성 전 자기검증 (반드시 이 순서로 머릿속에서 수행)

1. 출처 기사에서 모든 고유명사(선수·감독·팀·도시·경기장)와 숫자(스탯·점수·금액·날짜)를 추출한다.
2. 칼럼은 그 목록 안의 것만 사용한다. 목록에 없으면 쓰지 않는다.
3. 작성 후 다시 훑어 출처에 없는 걸 더했는지 점검한다. 더했으면 빼고, 그래도 미심쩍으면
   selfCheck.ok=false + concern에 1문장으로 남긴다.

## 흔한 환각 — 절대 하지 마라 (실제 거부 사례 기반)

- **홈/원정 단정 금지**: 출처가 "a win"이면 그냥 "승리". 출처에 명시 안 됐으면 "홈 승리"라고 쓰지 마라.
- **표현 강도 격상 금지**: 출처가 "예로 들 만한 선수"라고 하면 "후보로 거론된다"로 올리지 마라.
  출처의 표현 강도를 그대로 유지한다.
- **숫자 보존**: 스탯 라인의 항목을 빼먹지 마라. "13점 6리바운드 7어시스트"를 "13점 7어시스트"로
  줄이면 환각이다.
- **사전지식 금지**: 트레이닝 데이터의 선수·맥락·이력을 끌어오지 마라. 출처에 없으면 모르는 것이다.
- **출처 매체명 인용 금지**: "OO 매체가 분석했다" 식으로 쓰지 마라. 매체명은 메타 정보일 뿐이다.
- **마무리 단락은 쓰지 마라**: closingParagraph는 시스템이 채운다. 출력 항목에 없다.

## 한글 표기 (오역 주의)

- Bucks=벅스(NOT 버크스), Nets=네츠, Warriors=워리어스, Suns=선스, Grizzlies=그리즐리스
- Cooper Flagg=쿠퍼 플래그, Kyrie Irving=카이리 어빙, Anthony Davis=앤서니 데이비스, Luka Doncic=루카 돈치치
- "second half"=후반전(2쿼터 아님), "just under 30 minutes"=30분 가까이(구체 수치 단정 금지)

## 출력 항목

1. **category**: routine_recap / player_performance / emotional_moment / transaction / injury / controversy / speculation 중 하나
2. **titleKr**: SEO 한국어 제목 (25~50자, 핵심 인물·팀·사건 포함, 과장 X)
3. **metaDescription**: 1~2문장 요약 (100~160자)
4. **leadParagraph**: 도입부 (2~3문장, 핵심 사실 + 흥미 유발)
5. **bodyParagraphs**: 본문 단락 배열 (3~5개, 단락당 2~4문장, 사실 + 인용 + 한국 팬덤 시각)
6. **selfCheck**: { ok: boolean, concern: string } — 위 자기검증 결과

(closingParagraph는 출력하지 않는다 — 시스템이 채운다.)

## 카테고리 가이드 (간단)

- routine_recap: 스코어·쿼터 흐름·핵심 기록. 추세 단정 X.
- player_performance: 출처에 있는 그 선수 스탯만.
- emotional_moment: 장면을 사실의 무게로. 과장 어휘 X.
- transaction: 확정 사실만. 미확정 표현은 출처가 그렇게 쓴 경우만.
- injury: 출처 명시 부위·기간만. 의학적 추측·복귀 시점 단정 X.
- controversy: 양측 입장 출처대로. 편들지 않는다.
- speculation: 루머임을 명시. 누구의 주장인지 밝힌다.

## 톤

- 한국 스포츠 기사 톤. 처방형("~해야 한다")·단정 미래("~할 것이다")·과장 어휘(폭발적·충격적·미친)·이모지·메타 언급 금지.
- 마크다운/HTML 없이 순수 텍스트. 전체 800~1500자.

## few-shot (1개)

입력 출처: "날짜(ET): 2026-03-05. 원정 경기. 댈러스 매버릭스 98, 피닉스 선스 110. 매버릭스 패배(12점차). 카이리 어빙(선발): 24점, 리바운드 3, 어시스트 6, 야투 9/19."

좋은 출력:
{
  "category": "routine_recap",
  "titleKr": "매버릭스, 선스 원정서 98-110 패배…12점 차로 무릎",
  "metaDescription": "댈러스 매버릭스가 피닉스 선스 원정에서 98-110으로 패했다. 카이리 어빙이 24점을 기록했다.",
  "leadParagraph": "댈러스 매버릭스가 피닉스 선스 원정에서 98-110으로 패했다. 12점 차 패배였다.",
  "bodyParagraphs": [
    "카이리 어빙이 24점에 어시스트 6개를 기록하며 공격을 이끌었다. 야투는 19개 중 9개를 성공시켰다.",
    "팀 득점이 100점을 넘기지 못하면서 원정 패배를 막지 못했다."
  ],
  "selfCheck": { "ok": true, "concern": "" }
}

핵심: 출처에 있는 선수(카이리 어빙)와 그 스탯만 사용. 홈/원정도 출처대로 "원정".
출처에 없는 선수·추세·시즌 맥락은 일절 넣지 않았다.

## JSON만 출력 (다른 텍스트 없이)
{
  "category": "<카테고리>",
  "titleKr": "<제목>",
  "metaDescription": "<메타>",
  "leadParagraph": "<리드>",
  "bodyParagraphs": ["<단락1>", "<단락2>", "<단락3>"],
  "selfCheck": { "ok": true, "concern": "" }
}`;

function buildUserPrompt(article: string, sourceLabel: string): string {
  return `아래는 영문 외신 기사 본문이다.
(출처 매체: ${sourceLabel} — 참고용 메타 정보. 이 매체명을 칼럼 본문에 인용하지 말 것.)

기사 본문:
---
${article.slice(0, 8000)}
---`;
}

/** generate 원시 출력 — riskLevel은 category로 파생, closingParagraph는 파이프라인이 채운다. */
type GenerateRaw = Omit<ColumnOutput, 'riskLevel' | 'closingParagraph'>;

export async function generateColumn(
  article: string,
  team: TeamTag = 'mavericks',
  sourceLabel: string = '외신',
  model?: string,
): Promise<ColumnOutput> {
  const raw = await callLLMJSON<GenerateRaw>(buildUserPrompt(article, sourceLabel), {
    systemInstruction: buildSystemPrompt(COLUMN_TASK_INSTRUCTIONS, team),
    temperature: 0.6,
    // 마무리 단락 제거 + 지시문 압축 → 이전 2400에서 축소
    maxOutputTokens: 1600,
    model,
  });

  const category = (raw.category in RISK_BY_CATEGORY ? raw.category : 'routine_recap') as TopicCategory;
  const selfCheck: SelfCheck =
    raw.selfCheck && typeof raw.selfCheck.ok === 'boolean'
      ? { ok: raw.selfCheck.ok, concern: raw.selfCheck.concern }
      : // selfCheck 누락 시 보수적으로 ok=false → critique 라우팅
        { ok: false, concern: 'selfCheck 필드 누락' };

  return {
    category,
    riskLevel: RISK_BY_CATEGORY[category],
    titleKr: raw.titleKr,
    metaDescription: raw.metaDescription,
    leadParagraph: raw.leadParagraph,
    bodyParagraphs: Array.isArray(raw.bodyParagraphs) ? raw.bodyParagraphs : [],
    // 파이프라인이 closings.ts 고정 템플릿으로 채운다.
    closingParagraph: '',
    selfCheck,
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
