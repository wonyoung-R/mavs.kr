// src/app/api/cron/translate-news/route.ts
// Separate endpoint to trigger translation only

import { NextRequest, NextResponse } from 'next/server';
import { translateAndUpdateNews, translateNewsById } from '@/lib/services/news-translation-service';
import { supabase } from '@/lib/db/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get('id');
    const debug = searchParams.get('debug') === 'true';

    console.log('🌐 Translation job started');

    // Debug mode: test Supabase connection directly
    if (debug) {
        try {
            const { data, error, count } = await supabase
                .from('news')
                .select('id, title, title_kr', { count: 'exact' })
                .limit(5);

            return NextResponse.json({
                debug: true,
                supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
                hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                hasGeminiKey: !!process.env.GEMINI_API_KEY,
                query: {
                    count,
                    dataLength: data?.length || 0,
                    error: error?.message || null,
                    sample: data?.slice(0, 2) || [],
                },
            });
        } catch (err: any) {
            return NextResponse.json({
                debug: true,
                error: err.message,
            });
        }
    }

    try {
        // If specific ID provided, translate just that article
        if (articleId) {
            console.log(`🎯 Translating specific article: ${articleId}`);
            const result = await translateNewsById(articleId);

            return NextResponse.json({
                success: result.success,
                message: result.success ? 'Article translated' : 'Translation failed',
                articleId,
                result,
                timestamp: new Date().toISOString(),
            });
        }

        // Otherwise, translate batch of untranslated articles
        const result = await translateAndUpdateNews(10);

        console.log(`🌐 Translation complete: translated=${result.translated}, errors=${result.errors}`);

        return NextResponse.json({
            success: true,
            message: 'Translation completed',
            result,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Translation job error:', error);
        return NextResponse.json({
            success: false,
            error: 'Translation failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
