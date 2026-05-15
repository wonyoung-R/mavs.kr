import type { TeamTag } from '../publisher';

/**
 * 마무리 단락 고정 풀.
 *
 * 배경: generate가 마무리 단락을 직접 쓰면 처방형("~수밖에 없다")·단정 미래("~할 것이다")·
 * 편집자적 판단("~관전 포인트다")으로 critique REJECT를 받는 사례가 실측 거부 사유 1위였다.
 * → 마무리는 LLM이 쓰지 않고 이 풀에서 결정적으로 고른다. 비용 0, 거부 위험 0.
 *
 * 모든 문장은 관찰형 현재시제 — 처방형·단정 미래·과장 어휘 없음.
 */
const CLOSINGS: Record<TeamTag, string[]> = {
  mavericks: [
    '한국 매버릭스 팬덤도 이 흐름을 지켜보고 있다.',
    '댈러스의 다음 행보를 한국 팬덤도 함께 주목한다.',
    '한국 매버릭스 팬들에게도 곱씹어볼 만한 장면이다.',
    '이 소식은 한국 매버릭스 팬덤의 관심사이기도 하다.',
    '한국에서 매버릭스를 응원하는 팬들도 같은 장면을 지켜봤다.',
  ],
  wings: [
    '댈러스 윙스를 응원하는 한국 팬덤도 이 흐름을 지켜본다.',
    '윙스의 행보를 한국 팬들도 함께 주목한다.',
    '한국에서 윙스를 응원하는 팬들에게도 눈여겨볼 소식이다.',
    '이 장면은 윙스 팬덤이 함께 지켜보는 흐름의 하나다.',
    '댈러스 농구를 응원하는 한국 팬들도 윙스를 주목한다.',
  ],
};

/** 문자열 → 안정적 양수 해시 (결정적 선택·샘플링 공용) */
export function seedHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * 시드(보통 titleKr)로 마무리 1개를 결정적으로 선택.
 * 같은 글 → 항상 같은 마무리, 글마다 다양하게 분산된다.
 */
export function pickClosing(team: TeamTag, seed: string): string {
  const pool = CLOSINGS[team] ?? CLOSINGS.mavericks;
  if (!seed) return pool[0];
  return pool[seedHash(seed) % pool.length];
}
