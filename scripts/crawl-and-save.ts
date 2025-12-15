// scripts/crawl-and-save.ts
// Usage: npx tsx scripts/crawl-and-save.ts

import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

// We need to use dynamic imports for ESM compatibility
async function main() {
    console.log('🚀 Starting news crawl...\n');

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

    // Fetch news from each source API
    const sources = [
        { name: 'ESPN', endpoint: 'http://localhost:3000/api/news/espn?limit=10' },
        { name: 'Mavs Moneyball', endpoint: 'http://localhost:3000/api/news/mavsmoneyball?limit=10' },
        { name: 'Smoking Cuban', endpoint: 'http://localhost:3000/api/news/smoking-cuban?limit=10' },
    ];

    let totalSaved = 0;
    let totalErrors = 0;

    for (const source of sources) {
        console.log(`📰 Fetching from ${source.name}...`);

        try {
            const response = await fetch(source.endpoint);
            const data = await response.json();
            const articles = data.articles || [];

            console.log(`   Found ${articles.length} articles`);

            for (const article of articles) {
                try {
                    const newsData = {
                        title: article.title || '',
                        title_kr: article.titleKr || null,
                        content: article.description || null,
                        content_kr: null,
                        summary: null,
                        summary_kr: null,
                        source: article.source || source.name.toLowerCase(),
                        source_url: article.url || '',
                        author: article.author || null,
                        image_url: article.image || null,
                        published_at: article.published || new Date().toISOString(),
                    };

                    const { error } = await supabase
                        .from('news')
                        .upsert(newsData, { onConflict: 'source_url' });

                    if (error) {
                        console.error(`   ❌ Error saving: ${article.title?.substring(0, 50)}...`, error.message);
                        totalErrors++;
                    } else {
                        totalSaved++;
                    }
                } catch (err) {
                    console.error(`   ❌ Error processing article:`, err);
                    totalErrors++;
                }
            }
        } catch (err) {
            console.error(`❌ Failed to fetch from ${source.name}:`, err);
        }
    }

    console.log('\n========================================');
    console.log(`✅ Crawl complete!`);
    console.log(`   Saved: ${totalSaved}`);
    console.log(`   Errors: ${totalErrors}`);
    console.log('========================================\n');
}

main().catch(console.error);
