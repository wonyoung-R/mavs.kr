import { prisma } from '@/lib/db/prisma';
import { classifyArticle } from './classify';
import { generatePerspective } from './generate';
import { critiquePerspective } from './critique';
import { lintPerspectiveText } from './banned-patterns';
import { getFallbackPerspective } from './fallback';
import type { PerspectiveStatus, RiskLevel } from '../publisher';

export interface PerspectivePipelineInput {
  article: string;
  sourceUrl?: string;
  newsId?: string;
  dryRun?: boolean;
}

export interface PerspectivePipelineResult {
  text: string;
  status: PerspectiveStatus;
  riskLevel: RiskLevel;
  category: string;
  draft1: string;
  draft2?: string;
  critique1?: string;
  critique2?: string;
  usedFallback: boolean;
  bannedPatternHit?: string;
}

export async function runPerspectivePipeline(input: PerspectivePipelineInput): Promise<PerspectivePipelineResult> {
  const { article, sourceUrl, newsId, dryRun = false } = input;

  // (1) classify
  const cls = await classifyArticle(article);
  const riskLevel = cls.riskLevel;

  // (2) first generate
  const draft1 = await generatePerspective(article, riskLevel);

  // (3) lint draft1
  const lint1 = lintPerspectiveText(draft1);
  if (!lint1.ok) {
    return finalize({
      text: getFallbackPerspective(riskLevel),
      status: 'fallback',
      riskLevel,
      category: cls.category,
      draft1,
      usedFallback: true,
      bannedPatternHit: lint1.hits[0].reason,
      newsId,
      sourceUrl,
      dryRun,
    });
  }

  // (4) critique draft1
  const crit1 = await critiquePerspective(article, draft1);

  if (crit1.result === 'PASS') {
    return finalize({
      text: draft1,
      status: 'passed',
      riskLevel,
      category: cls.category,
      draft1,
      critique1: `PASS: ${crit1.reason}`,
      usedFallback: false,
      newsId,
      sourceUrl,
      dryRun,
    });
  }

  if (crit1.result === 'REJECT') {
    return finalize({
      text: getFallbackPerspective(riskLevel),
      status: 'fallback',
      riskLevel,
      category: cls.category,
      draft1,
      critique1: `REJECT: ${crit1.reason}`,
      usedFallback: true,
      newsId,
      sourceUrl,
      dryRun,
    });
  }

  // REVISE → regenerate once
  const draft2 = await generatePerspective(article, riskLevel);
  const lint2 = lintPerspectiveText(draft2);
  if (!lint2.ok) {
    return finalize({
      text: getFallbackPerspective(riskLevel),
      status: 'fallback',
      riskLevel,
      category: cls.category,
      draft1,
      draft2,
      critique1: `REVISE: ${crit1.reason}`,
      usedFallback: true,
      bannedPatternHit: lint2.hits[0].reason,
      newsId,
      sourceUrl,
      dryRun,
    });
  }

  const crit2 = await critiquePerspective(article, draft2);
  if (crit2.result === 'PASS') {
    return finalize({
      text: draft2,
      status: 'passed',
      riskLevel,
      category: cls.category,
      draft1,
      draft2,
      critique1: `REVISE: ${crit1.reason}`,
      critique2: `PASS: ${crit2.reason}`,
      usedFallback: false,
      newsId,
      sourceUrl,
      dryRun,
    });
  }

  // After 2nd attempt still not PASS → fallback
  return finalize({
    text: getFallbackPerspective(riskLevel),
    status: 'fallback',
    riskLevel,
    category: cls.category,
    draft1,
    draft2,
    critique1: `REVISE: ${crit1.reason}`,
    critique2: `${crit2.result}: ${crit2.reason}`,
    usedFallback: true,
    newsId,
    sourceUrl,
    dryRun,
  });
}

async function finalize(
  args: PerspectivePipelineResult & { newsId?: string; sourceUrl?: string; dryRun: boolean },
): Promise<PerspectivePipelineResult> {
  const { newsId, sourceUrl, dryRun, ...rest } = args;
  if (!dryRun) {
    try {
      await prisma.perspectiveLog.create({
        data: {
          newsId,
          sourceUrl,
          riskLevel: rest.riskLevel,
          draft1: rest.draft1,
          critique1: rest.critique1,
          draft2: rest.draft2,
          critique2: rest.critique2,
          finalText: rest.text,
          usedFallback: rest.usedFallback,
          bannedPatternHit: rest.bannedPatternHit,
        },
      });
    } catch (e) {
      console.warn('[perspective] log save failed:', e);
    }
  }
  return rest;
}
