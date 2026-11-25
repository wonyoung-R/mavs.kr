import { NextResponse } from 'next/server';
import { authenticate, database, failure, jsonBody, requireData } from '@/lib/matzip/server';
import { resolvePlace } from '@/lib/matzip/providers';
import { MatzipError, submissionInput } from '@/lib/matzip/validation';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const db = database();
    const [places, regions] = await Promise.all([
      db.from('matzip_places').select('id,kakao_place_id,name,address,latitude,longitude,region_id,menu,recommendation,blog_url,blog_title').order('published_at', { ascending: false }).limit(1000),
      db.from('matzip_regions').select('id,name,parent_id,level').order('name').limit(10000),
    ]);
    requireData(places.error); requireData(regions.error);
    const usedRegions = new Set<string>();
    const byId = new Map((regions.data ?? []).map(region => [region.id, region]));
    for (const place of places.data ?? []) {
      let id = place.region_id;
      while (id && !usedRegions.has(id)) {
        usedRegions.add(id);
        id = byId.get(id)?.parent_id;
      }
    }
    return NextResponse.json({ places: places.data, regions: (regions.data ?? []).filter(region => usedRegions.has(region.id)) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const user = await authenticate(request);
    const input = submissionInput(await jsonBody(request));
    const db = database(true);
    const resolved = await resolvePlace(input.kakao_place_id, input.search_query);
    const { regions, ...place } = resolved;
    const { data, error } = await db.rpc('matzip_submit', {
      p_actor: user.id, p_place: { ...place, kakao_place_id: input.kakao_place_id, region_id: regions[regions.length - 1].id, menu: input.menu, recommendation: input.recommendation }, p_regions: regions,
    });
    if (error?.code === 'P0002') throw new MatzipError('등록 신청은 하루 10곳까지 가능합니다.', 429);
    requireData(error);
    return NextResponse.json({ submission: { id: data, status: 'pending' } }, { status: 201 });
  } catch (error) { return failure(error); }
}
