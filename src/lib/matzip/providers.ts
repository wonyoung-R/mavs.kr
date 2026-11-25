import { coordinates, MatzipError, regionPath, safeBlogUrl } from './validation';

async function kakao(path: string, params: Record<string, string>) {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) throw new MatzipError('장소 검색을 준비 중입니다. 관리자에게 문의해 주세요.', 503);
  const response = await fetch(`https://dapi.kakao.com/v2/local/${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(8000), cache: 'no-store',
  });
  if (!response.ok) throw new MatzipError('장소 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.', 502);
  return response.json();
}

export async function searchPlaces(query: string) {
  const result = await kakao('search/keyword.json', { query, size: '15', category_group_code: 'FD6' });
  return (result.documents ?? []).map((item: Record<string, string>) => ({
    id: item.id, place_name: item.place_name, road_address_name: item.road_address_name,
    address_name: item.address_name, x: item.x, y: item.y,
  }));
}

export async function resolvePlace(id: string, searchQuery: string) {
  // Reuse the original query so a selected branch is not lost among identically named restaurants.
  const places = await searchPlaces(searchQuery);
  const place = places.find((item: { id: string }) => item.id === id);
  if (!place) throw new MatzipError('장소를 다시 검색하고 선택해 주세요.');
  const point = coordinates(place.x, place.y);
  const result = await kakao('geo/coord2regioncode.json', { x: String(point.longitude), y: String(point.latitude) });
  const region = (result.documents ?? []).find((item: { region_type: string }) => item.region_type === 'H');
  if (!region) throw new MatzipError('행정구역을 확인하지 못했습니다. 다른 장소를 선택해 주세요.', 502);
  const regions = regionPath(region.region_1depth_name, region.region_2depth_name, region.region_3depth_name);
  return { name: place.place_name, address: place.road_address_name || place.address_name, ...point, regions };
}

export async function topBlog(name: string, address: string) {
  const clientId = process.env.NAVER_BLOG_CLIENT_ID, secret = process.env.NAVER_BLOG_CLIENT_SECRET;
  if (!clientId || !secret) throw new MatzipError('네이버 블로그 API 설정 후 승인할 수 있습니다.', 503);
  const query = `${address.split(' ').slice(0, 3).join(' ')} ${name}`;
  const params = new URLSearchParams({ query, display: '1', start: '1', sort: 'sim', format: 'json' });
  const response = await fetch(`https://naverapihub.apigw.ntruss.com/search/v1/blog?${params}`, {
    headers: { 'X-NCP-APIGW-API-KEY-ID': clientId, 'X-NCP-APIGW-API-KEY': secret },
    cache: 'no-store', signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new MatzipError('블로그 검색에 실패했습니다. 다시 승인해 주세요.', 502);
  const result = await response.json();
  if (!Array.isArray(result.items)) throw new MatzipError('블로그 검색 결과를 확인하지 못했습니다.', 502);
  const first = result.items[0];
  return first ? { blog_url: safeBlogUrl(first.link), blog_title: String(first.title ?? '').replace(/<[^>]*>/g, '').slice(0, 300) } : { blog_url: null, blog_title: null };
}
