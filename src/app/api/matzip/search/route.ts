import { NextResponse } from 'next/server';
import { authenticate, failure } from '@/lib/matzip/server';
import { searchPlaces } from '@/lib/matzip/providers';
import { textField } from '@/lib/matzip/validation';

export async function GET(request: Request) {
  try {
    await authenticate(request);
    const query = textField(new URL(request.url).searchParams.get('q'), '검색어', 80);
    return NextResponse.json({ places: await searchPlaces(query) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
