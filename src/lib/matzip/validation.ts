export class MatzipError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function textField(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new MatzipError(`${label}을(를) 확인해 주세요.`);
  }
  return value.trim();
}

export function submissionInput(body: Record<string, unknown>) {
  const id = textField(body.kakao_place_id, '장소', 30);
  if (!/^\d+$/.test(id)) throw new MatzipError('검색 결과에서 장소를 선택해 주세요.');
  return {
    kakao_place_id: id,
    place_name: textField(body.place_name, '가게 이름', 150),
    search_query: textField(body.search_query, '장소 검색어', 80),
    menu: textField(body.menu, '대표 메뉴', 120),
    recommendation: textField(body.recommendation, '추천 내용', 1000),
  };
}

export function coordinates(x: unknown, y: unknown) {
  const longitude = Number(x), latitude = Number(y);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < 124 || longitude > 132 || latitude < 33 || latitude > 39.5) {
    throw new MatzipError('국내 장소의 위치를 확인해 주세요.');
  }
  return { longitude, latitude };
}

export function safeBlogUrl(value: unknown): string {
  if (typeof value !== 'string') throw new MatzipError('블로그 검색 결과를 확인할 수 없습니다.', 502);
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw new MatzipError('블로그 검색 결과를 확인할 수 없습니다.', 502); }
}

export function regionPath(first: string, second: string, third: string) {
  const names = [first, ...second.split(/\s+/), third].filter(Boolean);
  return names.map((name, index) => ({
    id: names.slice(0, index + 1).join('/'), name,
    parent_id: index ? names.slice(0, index).join('/') : null, level: index + 1,
  }));
}
