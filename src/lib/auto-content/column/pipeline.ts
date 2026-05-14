import { prisma } from '@/lib/db/prisma';
import { generateColumn, type ColumnOutput } from './generate-column';
import { critiqueColumn } from './critique-column';
import { lintPerspectiveText } from '../perspective/banned-patterns';
import type { TeamTag, PerspectiveStatus } from '../publisher';

export interface ColumnPipelineInput {
  article: string;
  sourceUrl?: string;
  sourceLabel?: string;
  team?: TeamTag;
  dryRun?: boolean;
  newsId?: string;
}

export interface ColumnPipelineResult {
  status: PerspectiveStatus;
  /** true면 발행 skip 권고 (환각/심각 위반 탐지) */
  shouldSkipPublish: boolean;
  column: ColumnOutput;
  draft1: ColumnOutput;
  draft2?: ColumnOutput;
  critique1?: string;
  critique2?: string;
  hallucinations?: string[];
  bannedPatternHit?: string;
  usedFallback: boolean;
}

const FALLBACK_BY_TEAM: Record<'mavericks' | 'wings', { titleKr: string; closingParagraph: string }> = {
  mavericks: {
    titleKr: '한국 매버릭스 팬덤이 주목하는 흐름',
    closingParagraph: '한국 매버릭스 팬덤이 계속 지켜보는 흐름의 한 장면이다.',
  },
  wings: {
    titleKr: '댈러스 윙스를 응원하는 팬들이 주목하는 흐름',
    closingParagraph: '댈러스 윙스를 응원하는 한국 팬덤이 함께 지켜보는 흐름이다.',
  },
};

function fullText(col: ColumnOutput): string {
  return [col.titleKr, col.leadParagraph, ...col.bodyParagraphs, col.closingParagraph].join('\n\n');
}

export async function runColumnPipeline(input: ColumnPipelineInput): Promise<ColumnPipelineResult> {
  const { article, sourceUrl, sourceLabel = '외신', team = 'mavericks', dryRun = false, newsId } = input;

  const draft1 = await generateColumn(article, team, sourceLabel);

  // 정규식 사전 차단 — 본문 전체 검사
  const lint1 = lintPerspectiveText(fullText(draft1));
  if (!lint1.ok) {
    const result = {
      status: 'fallback' as PerspectiveStatus,
      shouldSkipPublish: false,
      column: { ...draft1, closingParagraph: FALLBACK_BY_TEAM[team].closingParagraph },
      draft1,
      bannedPatternHit: lint1.hits[0].reason,
      usedFallback: true,
    };
    await persistLog(result, sourceUrl, newsId, dryRun);
    return result;
  }

  const crit1 = await critiqueColumn(article, draft1, team);
  if (crit1.result === 'PASS') {
    const result = {
      status: 'passed' as PerspectiveStatus,
      shouldSkipPublish: false,
      column: draft1,
      draft1,
      critique1: `PASS: ${crit1.reason}`,
      usedFallback: false,
    };
    await persistLog(result, sourceUrl, newsId, dryRun);
    return result;
  }

  if (crit1.result === 'REJECT') {
    // 환각 다수 → 발행 skip (SEO 신뢰도 보호)
    const fb = FALLBACK_BY_TEAM[team];
    const result = {
      status: 'rejected' as PerspectiveStatus,
      shouldSkipPublish: true,
      column: { ...draft1, closingParagraph: fb.closingParagraph },
      draft1,
      critique1: `REJECT: ${crit1.reason}`,
      hallucinations: crit1.hallucinations,
      usedFallback: true,
    };
    await persistLog(result, sourceUrl, newsId, dryRun);
    return result;
  }

  // REVISE → 재생성 1회
  const draft2 = await generateColumn(article, team, sourceLabel);
  const lint2 = lintPerspectiveText(fullText(draft2));
  if (!lint2.ok) {
    const fb = FALLBACK_BY_TEAM[team];
    const result = {
      status: 'fallback' as PerspectiveStatus,
      shouldSkipPublish: false,
      column: { ...draft2, closingParagraph: fb.closingParagraph },
      draft1,
      draft2,
      critique1: `REVISE: ${crit1.reason}`,
      bannedPatternHit: lint2.hits[0].reason,
      usedFallback: true,
    };
    await persistLog(result, sourceUrl, newsId, dryRun);
    return result;
  }

  const crit2 = await critiqueColumn(article, draft2, team);
  if (crit2.result === 'PASS') {
    const result = {
      status: 'passed' as PerspectiveStatus,
      shouldSkipPublish: false,
      column: draft2,
      draft1,
      draft2,
      critique1: `REVISE: ${crit1.reason}`,
      critique2: `PASS: ${crit2.reason}`,
      usedFallback: false,
    };
    await persistLog(result, sourceUrl, newsId, dryRun);
    return result;
  }

  // 두 번째도 PASS 못함 → 발행 skip (환각 위험)
  const fb = FALLBACK_BY_TEAM[team];
  const result = {
    status: 'rejected' as PerspectiveStatus,
    shouldSkipPublish: true,
    column: { ...draft2, closingParagraph: fb.closingParagraph },
    draft1,
    draft2,
    critique1: `REVISE: ${crit1.reason}`,
    critique2: `${crit2.result}: ${crit2.reason}`,
    hallucinations: crit2.hallucinations,
    usedFallback: true,
  };
  await persistLog(result, sourceUrl, newsId, dryRun);
  return result;
}

async function persistLog(
  result: ColumnPipelineResult,
  sourceUrl: string | undefined,
  newsId: string | undefined,
  dryRun: boolean,
) {
  if (dryRun) return;
  try {
    await prisma.perspectiveLog.create({
      data: {
        newsId,
        sourceUrl,
        riskLevel: result.column.riskLevel,
        draft1: JSON.stringify(result.draft1),
        critique1: result.critique1,
        draft2: result.draft2 ? JSON.stringify(result.draft2) : undefined,
        critique2: result.critique2,
        finalText: JSON.stringify(result.column),
        usedFallback: result.usedFallback,
        bannedPatternHit: result.bannedPatternHit,
      },
    });
  } catch (e) {
    console.warn('[column-pipeline] log save failed:', e);
  }
}
