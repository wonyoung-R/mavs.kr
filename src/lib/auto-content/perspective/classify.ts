import { callGeminiJSON } from '../gemini';
import { buildSystemPrompt } from '../prompt/system';
import type { RiskLevel } from '../publisher';

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

export interface ClassifyResult {
  category: TopicCategory;
  riskLevel: RiskLevel;
  reason?: string;
}

const PROMPT = `다음 기사 텍스트를 읽고 어느 카테고리에 속하는지 분류해라.

카테고리 정의:
- routine_recap: 평범한 경기 결과/리캡
- player_performance: 특정 선수 활약/스탯
- emotional_moment: 감동적/극적 순간 (역전, 마지막 슛 등)
- transaction: 트레이드/계약/방출 (확정된 사실)
- injury: 부상/복귀 보고
- controversy: 코칭/감독/구단 운영 논란
- speculation: 트레이드 루머/예측/가십

JSON으로만 응답:
{ "category": "<카테고리>", "reason": "<짧은 이유>" }

기사:
---
{ARTICLE}
---`;

export async function classifyArticle(article: string): Promise<ClassifyResult> {
  const truncated = article.slice(0, 4000);
  const raw = await callGeminiJSON<{ category: TopicCategory; reason?: string }>(
    PROMPT.replace('{ARTICLE}', truncated),
    {
      systemInstruction: buildSystemPrompt('너는 분류 작업만 수행한다. 의견 작성 금지.'),
      temperature: 0.2,
      maxOutputTokens: 200,
    },
  );

  const category = raw.category in RISK_BY_CATEGORY ? raw.category : 'routine_recap';
  return {
    category,
    riskLevel: RISK_BY_CATEGORY[category],
    reason: raw.reason,
  };
}
