import { NextRequest, NextResponse } from 'next/server';
import { batchTranslateWithGemini } from '@/lib/api/gemini';

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

    console.log('Gemini API Key available:', !!process.env.GEMINI_API_KEY);
    console.log('Texts to translate:', texts);

    // Gemini API를 사용한 번역
    const translations = await batchTranslateWithGemini(texts);

    console.log('Translation result:', translations);

    return NextResponse.json({
      translations,
      success: true,
      count: translations.length,
      method: 'gemini'
    });

  } catch (error) {
    console.error('Gemini Translation Error:', error);
    return NextResponse.json({
      error: 'Failed to translate texts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
