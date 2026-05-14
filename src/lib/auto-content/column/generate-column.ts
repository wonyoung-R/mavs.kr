import { callGeminiJSON } from '../gemini';
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

function buildPrompt(article: string, team: TeamTag, sourceLabel: string): string {
  const teamName = team === 'wings' ? '댈러스 윙스 (WNBA)' : '댈러스 매버릭스 (NBA)';
  const audienceTone = team === 'wings'
    ? '댈러스 윙스를 응원하는 한국 팬덤의 시각'
    : '한국 매버릭스 팬덤의 시각';

  return `다음 영문 ${sourceLabel} 기사를 한국 ${teamName} 팬덤이 읽을 한국어 칼럼으로 재창조해라.

이 글은 단순 번역이 아니라 **${audienceTone}**에서 자연스럽게 쓴 칼럼이어야 한다.
사실은 출처 기사에서만 가져오고, MAVS.KR의 톤으로 자연스러운 한국 스포츠 기사처럼 작성한다.

## 출력 항목 (모두 채워라)

1. **category**: 7개 중 하나
   - routine_recap (평범한 경기 리캡)
   - player_performance (특정 선수 활약/스탯)
   - emotional_moment (감동/극적 순간)
   - transaction (트레이드/계약/방출 확정)
   - injury (부상/복귀)
   - controversy (코칭/구단 운영 논란)
   - speculation (루머/예측/가십)

2. **titleKr**: SEO 친화 한국어 제목 (25~50자, 핵심 인물/팀명/사건 포함, 과장 X)
3. **metaDescription**: 글 요약 1~2문장 (100~160자, 자연스러운 한국어, og description용)
4. **leadParagraph**: 도입부 (2~3문장, 핵심 사실 + 흥미 유발)
5. **bodyParagraphs**: 본문 단락 배열 (3~5개 단락, 단락당 2~4문장)
   - 사실 진술 + 인용 + 자연스러운 한국 팬덤 시각 분석
   - 인용 시 발언자 명시
6. **closingParagraph**: 마무리 (1~2문장, 팬덤 정서로 자연스럽게 닫기)

## 절대 규칙
- 출처에 없는 선수명/감독/스탯/시즌 위치/부상/트레이드 이력 → 추가 금지 (환각 0)
- 너의 사전 지식 사용 금지. 모르면 빼라.
- 처방형 ("~해야 한다"), 단정 미래 ("~할 것이다") 금지
- 이모지 / 과장 어휘 / 메타 언급 (조회수 등) 금지
- 마크다운/HTML 태그 없이 순수 텍스트
- 전체 길이 800~1500자 권장 (SEO)

## JSON 출력 (다른 텍스트 없이 JSON만)
{
  "category": "<카테고리>",
  "titleKr": "<제목>",
  "metaDescription": "<메타>",
  "leadParagraph": "<리드>",
  "bodyParagraphs": ["<단락1>", "<단락2>", "<단락3>"],
  "closingParagraph": "<마무리>"
}

출처 기사:
---
${article.slice(0, 8000)}
---`;
}

export async function generateColumn(
  article: string,
  team: TeamTag = 'mavericks',
  sourceLabel: string = '외신',
): Promise<ColumnOutput> {
  const raw = await callGeminiJSON<Omit<ColumnOutput, 'riskLevel'>>(
    buildPrompt(article, team, sourceLabel),
    {
      systemInstruction: buildSystemPrompt(undefined, team),
      temperature: 0.6,
      maxOutputTokens: 2400,
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
