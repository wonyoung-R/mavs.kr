import type { RiskLevel, TeamTag } from '../publisher';

const MAVS_FALLBACK: Record<RiskLevel, string> = {
  low: '이번 소식은 한국 매버릭스 팬덤이 계속 주목해 온 흐름의 한 장면이다.',
  medium: '이번 사안은 매버릭스 팬덤이 신중하게 지켜보는 변수 중 하나다.',
  high: '이 사안은 한국 매버릭스 팬덤이 신중하게 지켜보는 흐름이다.',
};

const WINGS_FALLBACK: Record<RiskLevel, string> = {
  low: '댈러스 윙스를 응원하는 한국 팬덤이 함께 지켜보는 흐름의 한 장면이다.',
  medium: '댈러스 윙스 팬덤이 주목하는 변수 중 하나다.',
  high: '윙스 팬덤이 신중하게 지켜보는 흐름이다.',
};

export function getFallbackPerspective(riskLevel: RiskLevel, team?: TeamTag): string {
  if (team === 'wings') return WINGS_FALLBACK[riskLevel];
  return MAVS_FALLBACK[riskLevel];
}
