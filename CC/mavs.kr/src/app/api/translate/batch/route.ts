import { NextRequest, NextResponse } from 'next/server';
import { batchSimpleTranslate, loadTranslationCache } from '@/lib/translation/simple-translator';

export async function POST(request: NextRequest) {
  try {
    const { texts } = await request.json();

    if (!texts || !Array.isArray(texts)) {
      return NextResponse.json(
        { error: 'Texts array is required' },
        { status: 400 }
      );
    }

    if (texts.length === 0) {
      return NextResponse.json({ translations: [] });
    }

    // 캐시 로드
    loadTranslationCache();

    // 간단한 배치 번역 사용 (즉시 반환)
    const translations = batchSimpleTranslate(texts);

    return NextResponse.json({
      translations,
      success: true,
      count: translations.length,
      method: 'simple'
    });

  } catch (error) {
    console.error('Batch Translation Error:', error);
    return NextResponse.json({
      error: 'Failed to translate texts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
