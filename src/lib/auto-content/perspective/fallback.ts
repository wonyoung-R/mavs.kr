import type { RiskLevel } from '../publisher';

export const FALLBACK_TEXT: Record<RiskLevel, string> = {
  low: '이번 소식은 한국 매버릭스 팬덤이 계속 주목해 온 흐름의 한 장면이다.',
  medium: '이번 사안은 매버릭스 팬덤이 신중하게 지켜보는 변수 중 하나다.',
  high: '이 사안은 한국 매버릭스 팬덤이 신중하게 지켜보는 흐름이다.',
};

export function getFallbackPerspective(riskLevel: RiskLevel): string {
  return FALLBACK_TEXT[riskLevel];
}
