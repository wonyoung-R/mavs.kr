// src/app/api/news/[id]/translate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { translateNewsById } from '@/lib/services/news-prisma-service';

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    console.log(`[Translate] Manual translation for: ${id}`);

    const result = await translateNewsById(id);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, titleKr: result.titleKr });
  } catch (error) {
    console.error('[Translate] Error:', error);
    return NextResponse.json({ success: false, error: 'Translation failed' }, { status: 500 });
  }
}

