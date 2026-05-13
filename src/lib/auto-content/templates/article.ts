import type { AutoNewsSource, PerspectiveStatus, RiskLevel } from '../publisher';

const SOURCE_LABEL: Record<AutoNewsSource, string> = {
  nba_api: 'NBA.com',
  mavsmoneyball: 'Mavs Moneyball',
  smokingcuban: 'The Smoking Cuban',
  espn: 'ESPN',
  injury_report: 'NBA Injury Report',
};

export interface ArticleParts {
  title: string;
  leadParagraph: string;
  bodyParagraphs: string[];
  perspectiveText: string;
  source: AutoNewsSource;
  sourceUrl?: string;
  riskLevel: RiskLevel;
  perspectiveStatus: PerspectiveStatus;
}

const PERSPECTIVE_BLOCK_START = '━━━━━━━━━━━━━━';
const PERSPECTIVE_BLOCK_END = '━━━━━━━━━━━━━━';

export function renderArticleMarkdown(parts: ArticleParts): string {
  const sourceLabel = SOURCE_LABEL[parts.source];
  const out: string[] = [];

  out.push(`# ${parts.title}`);
  out.push('');
  out.push(`🤖 자동 생성 · ${sourceLabel}`);
  out.push('');
  out.push(parts.leadParagraph.trim());
  out.push('');
  for (const p of parts.bodyParagraphs) {
    out.push(p.trim());
    out.push('');
  }
  out.push(PERSPECTIVE_BLOCK_START);
  out.push('🟦 **MAVS.KR의 시각**');
  out.push('');
  out.push(parts.perspectiveText.trim());
  out.push(PERSPECTIVE_BLOCK_END);
  out.push('');
  out.push('📷 더 깊은 분석과 카드뉴스는 [@mavs.kr 인스타그램](https://instagram.com/mavs.kr)에서');
  out.push('');
  if (parts.sourceUrl) {
    out.push(`원문 출처: ${parts.sourceUrl}`);
    out.push('');
  }
  out.push('⚙️ *이 글은 MAVS.KR의 시각을 학습한 AI가 작성했습니다.*');

  return out.join('\n');
}

export function validateArticle(md: string): { ok: boolean; reason?: string } {
  if (!md.includes('🤖 자동 생성')) return { ok: false, reason: 'AI label missing' };
  if (!md.includes('MAVS.KR의 시각')) return { ok: false, reason: 'perspective block missing' };
  if (!md.includes('@mavs.kr 인스타그램')) return { ok: false, reason: 'instagram CTA missing' };
  return { ok: true };
}
