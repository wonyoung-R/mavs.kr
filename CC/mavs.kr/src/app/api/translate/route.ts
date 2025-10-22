import { NextRequest, NextResponse } from 'next/server';
import { simpleTranslate, loadTranslationCache } from '@/lib/translation/simple-translator';

export async function POST(request: NextRequest) {
  try {
    const { text, targetLang = 'ko' } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Invalid text provided' }, { status: 400 });
    }

    // 캐시 로드
    loadTranslationCache();

    // 간단한 번역 사용 (즉시 반환)
    const translatedText = simpleTranslate(text);

    return NextResponse.json({
      translated: translatedText,
      original: text,
      sourceLang: 'en',
      targetLang: targetLang,
      method: 'simple'
    });

  } catch (error) {
    console.error('Translation Error:', error);
    return NextResponse.json({
      error: 'Failed to translate text',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
