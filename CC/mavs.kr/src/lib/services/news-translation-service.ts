// src/lib/services/news-translation-service.ts
// Service for translating news content using existing Gemini utilities

import { supabase, getServiceSupabase, NewsRow } from '@/lib/db/supabase';
import { translateWithGemini } from '@/lib/api/gemini';

/**
 * Get untranslated news from Supabase
 */
async function getUntranslatedNews(limit: number = 10): Promise<NewsRow[]> {
    console.log('🔍 Querying untranslated news...');

    const { data, error, count } = await supabase
        .from('news')
        .select('*', { count: 'exact' })
        .is('title_kr', null)
        .order('published_at', { ascending: false })
        .limit(limit);

    console.log(`🔍 Query result: count=${count}, data length=${data?.length || 0}, error=${error?.message || 'none'}`);

    if (error) {
        console.error('Error fetching untranslated news:', error);
        return [];
    }

    return (data || []) as NewsRow[];
}

/**
 * Update news translation in Supabase
 */
async function updateTranslation(id: string, titleKr: string, contentKr?: string): Promise<boolean> {
    const db = getServiceSupabase();

    const updateData: Record<string, unknown> = {
        title_kr: titleKr,
        updated_at: new Date().toISOString(),
    };

    if (contentKr) {
        updateData.content_kr = contentKr;
    }

    const { error } = await db
        .from('news')
        .update(updateData)
        .eq('id', id);

    if (error) {
        console.error('Error updating translation:', error);
        return false;
    }

    return true;
}

/**
 * Translate and update untranslated news
 */
export async function translateAndUpdateNews(limit: number = 10): Promise<{
    translated: number;
    errors: number;
}> {
    let translated = 0;
    let errors = 0;

    // Get untranslated news
    const untranslatedNews = await getUntranslatedNews(limit);
    console.log(`📝 Found ${untranslatedNews.length} untranslated articles`);

    for (const news of untranslatedNews) {
        try {
            console.log(`🌐 Translating: "${news.title.substring(0, 50)}..."`);

            // Use existing Gemini translation utility
            const titleKr = await translateWithGemini(news.title);

            if (!titleKr) {
                console.log(`⏭️ Skipped: ${news.title.substring(0, 50)}...`);
                errors++;
                continue;
            }

            console.log(`✅ Translated to: "${titleKr.substring(0, 50)}..."`);

            // Translate content if exists (for now, skip content translation to avoid rate limits)
            let contentKr: string | undefined;
            // Content translation can be added later if needed

            // Update in database
            const success = await updateTranslation(news.id, titleKr, contentKr);

            if (success) {
                translated++;
                console.log(`💾 Saved translation for: ${news.id}`);
            } else {
                errors++;
            }

            // Rate limiting: wait 2 seconds between translations
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (err) {
            console.error(`❌ Error translating news ${news.id}:`, err);
            errors++;
        }
    }

    return { translated, errors };
}

/**
 * Manually translate a single news article by ID
 * Returns detailed result for debugging
 */
export async function translateNewsById(id: string): Promise<{
    success: boolean;
    step?: string;
    error?: string;
    titleKr?: string;
}> {
    console.log(`🔍 translateNewsById: Looking for article ${id}`);

    try {
        const { data, error } = await supabase
            .from('news')
            .select('*')
            .eq('id', id)
            .single();

        console.log(`🔍 Query result: data=${!!data}, error=${error?.message || 'none'}`);

        if (error || !data) {
            return { success: false, step: 'fetch', error: error?.message || 'Not found' };
        }

        const news = data as NewsRow;
        console.log(`📰 Found article: "${news.title.substring(0, 50)}..."`);

        // Use existing Gemini translation utility
        const titleKr = await translateWithGemini(news.title);
        console.log(`🌐 Translated title: ${titleKr ? titleKr.substring(0, 50) + '...' : 'FAILED'}`);

        if (!titleKr) {
            return { success: false, step: 'translate', error: 'Gemini translation returned null' };
        }

        // Update in database
        const updateSuccess = await updateTranslation(id, titleKr);
        console.log(`💾 Update result: ${updateSuccess ? 'SUCCESS' : 'FAILED'}`);

        if (!updateSuccess) {
            return { success: false, step: 'update', error: 'Failed to update database' };
        }

        return { success: true, titleKr };
    } catch (err: unknown) {
        console.error('translateNewsById error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, step: 'exception', error: errorMessage };
    }
}
