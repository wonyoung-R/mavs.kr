import { prisma } from '@/lib/db/prisma';
import { generateColumn, type ColumnOutput } from './generate-column';
import { critiqueColumn } from './critique-column';
import { pickClosing, seedHash } from './closings';
import { lintPerspectiveText } from '../perspective/banned-patterns';
import type { TeamTag, PerspectiveStatus } from '../publisher';

export interface ColumnPipelineInput {
  article: string;
  sourceUrl?: string;
  sourceLabel?: string;
  team?: TeamTag;
  dryRun?: boolean;
  newsId?: string;
  /** 모델 오버라이드 — 비교 테스트용. 미지정 시 ANTHROPIC_MODEL env */
  model?: string;
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
  /** critique LLM 호출이 실제로 실행됐는지 (비용 추적용) */
  critiqueRan: boolean;
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

/**
 * low-risk + 자기검증 통과 글 중 1/N은 critique 감사를 거친다.
 * generate 자기검증이 시간이 지나며 느슨해지는(드리프트) 것을 감지하기 위한 표본 검사.
 */
const AUDIT_SAMPLE_RATE = 4;

function fullText(col: ColumnOutput): string {
  return [col.titleKr, col.leadParagraph, ...col.bodyParagraphs, col.closingParagraph].join('\n\n');
}

/** generate가 비워둔 closingParagraph를 고정 템플릿 풀에서 채운다 (LLM 비용·거부 위험 0). */
function withClosing(col: ColumnOutput, team: TeamTag): ColumnOutput {
  return { ...col, closingParagraph: pickClosing(team, col.titleKr || col.leadParagraph || '') };
}

/** low-risk 자기검증 통과 글의 1/AUDIT_SAMPLE_RATE 표본 감사 여부 (sourceUrl 시드로 결정적) */
function shouldSampleAudit(seed: string | undefined): boolean {
  if (!seed) return true; // 시드 없으면 안전하게 감사
  return seedHash(seed) % AUDIT_SAMPLE_RATE === 0;
}

/**
 * 비용 최소화 재설계(B안) 파이프라인:
 *
 * 1) generate (자기검증 포함) → draft1, 마무리는 고정 템플릿으로 채움
 * 2) 정규식 lint — 무료 사전 차단
 * 3) 리스크 라우팅:
 *    - low-risk + selfCheck.ok + 샘플 감사 비대상 → critique 생략, 바로 발행 (총 1콜)
 *    - medium/high-risk OR selfCheck 실패 OR 샘플 감사 대상 → critique 게이트 (2콜)
 * 4) critique REVISE → 재생성 1회 + 재검수 1회 (최대 4콜, 드물어야 정상)
 */
export async function runColumnPipeline(input: ColumnPipelineInput): Promise<ColumnPipelineResult> {
  const { article, sourceUrl, sourceLabel = '외신', team = 'mavericks', dryRun = false, newsId, model } = input;

  // ── 1콜: 자기검증형 generate ──
  const draft1 = withClosing(await generateColumn(article, team, sourceLabel, model), team);

  // 정규식 사전 차단 — 본문 전체 검사
  const lint1 = lintPerspectiveText(fullText(draft1));
  if (!lint1.ok) {
    return finalize(
      {
        status: 'fallback',
        shouldSkipPublish: false,
        column: { ...draft1, closingParagraph: FALLBACK_BY_TEAM[team].closingParagraph },
        draft1,
        bannedPatternHit: lint1.hits[0].reason,
        usedFallback: true,
        critiqueRan: false,
      },
      sourceUrl,
      newsId,
      dryRun,
    );
  }

  // ── 리스크 기반 critique 라우팅 ──
  const lowRisk = draft1.riskLevel === 'low';
  const selfOk = draft1.selfCheck.ok;
  const audit = shouldSampleAudit(sourceUrl);

  // low-risk + 자기검증 통과 + 샘플 감사 비대상 → critique 생략, 바로 발행
  if (lowRisk && selfOk && !audit) {
    return finalize(
      {
        status: 'passed',
        shouldSkipPublish: false,
        column: draft1,
        draft1,
        critique1: 'SKIP: low-risk + self-verified (critique 생략)',
        usedFallback: false,
        critiqueRan: false,
      },
      sourceUrl,
      newsId,
      dryRun,
    );
  }

  // medium/high-risk, selfCheck 실패, 또는 샘플 감사 대상 → critique 게이트
  const critPrefix = lowRisk && selfOk ? 'AUDIT' : 'GATE';
  const crit1 = await critiqueColumn(article, draft1, team, model);

  if (crit1.result === 'PASS') {
    return finalize(
      {
        status: 'passed',
        shouldSkipPublish: false,
        column: draft1,
        draft1,
        critique1: `${critPrefix} PASS: ${crit1.reason}`,
        usedFallback: false,
        critiqueRan: true,
      },
      sourceUrl,
      newsId,
      dryRun,
    );
  }

  if (crit1.result === 'REJECT') {
    // 환각 탐지 → 발행 skip (SEO 신뢰도 보호)
    return finalize(
      {
        status: 'rejected',
        shouldSkipPublish: true,
        column: { ...draft1, closingParagraph: FALLBACK_BY_TEAM[team].closingParagraph },
        draft1,
        critique1: `${critPrefix} REJECT: ${crit1.reason}`,
        hallucinations: crit1.hallucinations,
        usedFallback: true,
        critiqueRan: true,
      },
      sourceUrl,
      newsId,
      dryRun,
    );
  }

  // REVISE → 재생성 1회
  const draft2 = withClosing(await generateColumn(article, team, sourceLabel, model), team);
  const lint2 = lintPerspectiveText(fullText(draft2));
  if (!lint2.ok) {
    return finalize(
      {
        status: 'fallback',
        shouldSkipPublish: false,
        column: { ...draft2, closingParagraph: FALLBACK_BY_TEAM[team].closingParagraph },
        draft1,
        draft2,
        critique1: `${critPrefix} REVISE: ${crit1.reason}`,
        bannedPatternHit: lint2.hits[0].reason,
        usedFallback: true,
        critiqueRan: true,
      },
      sourceUrl,
      newsId,
      dryRun,
    );
  }

  const crit2 = await critiqueColumn(article, draft2, team, model);
  if (crit2.result === 'PASS') {
    return finalize(
      {
        status: 'passed',
        shouldSkipPublish: false,
        column: draft2,
        draft1,
        draft2,
        critique1: `${critPrefix} REVISE: ${crit1.reason}`,
        critique2: `PASS: ${crit2.reason}`,
        usedFallback: false,
        critiqueRan: true,
      },
      sourceUrl,
      newsId,
      dryRun,
    );
  }

  // 재검수도 통과 못 함 → 발행 skip (환각 위험)
  return finalize(
    {
      status: 'rejected',
      shouldSkipPublish: true,
      column: { ...draft2, closingParagraph: FALLBACK_BY_TEAM[team].closingParagraph },
      draft1,
      draft2,
      critique1: `${critPrefix} REVISE: ${crit1.reason}`,
      critique2: `${crit2.result}: ${crit2.reason}`,
      hallucinations: crit2.hallucinations,
      usedFallback: true,
      critiqueRan: true,
    },
    sourceUrl,
    newsId,
    dryRun,
  );
}

/** 로그 저장 후 결과를 그대로 반환 */
async function finalize(
  result: ColumnPipelineResult,
  sourceUrl: string | undefined,
  newsId: string | undefined,
  dryRun: boolean,
): Promise<ColumnPipelineResult> {
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
