export interface BannedPattern {
  regex: RegExp;
  reason: string;
}

/**
 * 정규식으로 명확히 잡을 수 있는 위반만 사전 차단.
 *
 * 단정 미래("할 것이다") 같은 모호한 표현은 lint에서 제외 — critique LLM에 위임.
 * lint가 너무 공격적이면 자연스러운 글도 fallback 처리되어 품질 ↓.
 */
export const BANNED_PATTERNS: BannedPattern[] = [
  { regex: /경질|해고|방출해야|트레이드해야|영입해야/, reason: 'prescriptive_personnel' },
  { regex: /실패작|망했다|망한다|한심|무능|개판|쓰레기/, reason: 'derogatory' },
  { regex: /해야\s*한다|해야만\s*한다/, reason: 'prescriptive_verb' },
  { regex: /충격적|혁명적|경악|폭로|미친\s*활약|대박/, reason: 'sensational' },
  { regex: /조회수|좋아요\s*수|댓글\s*수|공유\s*수|트래픽/, reason: 'meta_reference' },
  { regex: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, reason: 'emoji' },
];

export interface LintResult {
  ok: boolean;
  hits: { reason: string; match: string }[];
}

export function lintPerspectiveText(text: string): LintResult {
  const hits: { reason: string; match: string }[] = [];
  for (const p of BANNED_PATTERNS) {
    const m = text.match(p.regex);
    if (m) hits.push({ reason: p.reason, match: m[0] });
  }
  return { ok: hits.length === 0, hits };
}
