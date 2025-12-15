// src/app/api/batch/translate-news/route.ts
// 번역되지 않은 뉴스 기사들을 배치로 번역하는 API
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { translateContentWithGemini } from '@/lib/api/gemini';

// Rate limit 방지를 위한 딜레이 함수
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5'); // 한 번에 처리할 개수
    const delayMs = parseInt(searchParams.get('delay') || '10000'); // 기본 10초 딜레이

    try {
        // 1. 번역이 안 된 기사들 조회 (titleKr 또는 contentKr이 null인 것)
        const untranslatedNews = await prisma.news.findMany({
            where: {
                OR: [
                    { titleKr: null },
                    { contentKr: null }
                ]
            },
            orderBy: { publishedAt: 'desc' },
            take: limit
        });

        if (untranslatedNews.length === 0) {
            return NextResponse.json({
                success: true,
                message: '번역할 기사가 없습니다.',
                translated: 0
            });
        }

        console.log(`[Batch Translation] ${untranslatedNews.length}개 기사 번역 시작...`);

        const results: { id: string; title: string; success: boolean; error?: string }[] = [];

        for (let i = 0; i < untranslatedNews.length; i++) {
            const article = untranslatedNews[i];
            console.log(`[${i + 1}/${untranslatedNews.length}] 번역 중: ${article.title.substring(0, 50)}...`);

            try {
                let titleKr = article.titleKr;
                let contentKr = article.contentKr;

                // 제목 번역
                if (!titleKr && article.title) {
                    console.log(`  - 제목 번역 중...`);
                    titleKr = await translateContentWithGemini(article.title);
                    await delay(2000); // 제목 번역 후 2초 대기
                }

                // 내용 번역
                if (!contentKr && article.content) {
                    console.log(`  - 내용 번역 중...`);
                    contentKr = await translateContentWithGemini(article.content);
                    await delay(2000); // 내용 번역 후 2초 대기
                }

                // DB 업데이트
                await prisma.news.update({
                    where: { id: article.id },
                    data: {
                        titleKr: titleKr || article.titleKr,
                        contentKr: contentKr || article.contentKr
                    }
                });

                results.push({
                    id: article.id,
                    title: article.title,
                    success: true
                });

                console.log(`  ✓ 번역 완료!`);

            } catch (error) {
                console.error(`  ✗ 번역 실패:`, error);
                results.push({
                    id: article.id,
                    title: article.title,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }

            // 다음 기사 처리 전 딜레이 (Rate Limit 방지)
            if (i < untranslatedNews.length - 1) {
                console.log(`  ⏳ ${delayMs / 1000}초 대기 중...`);
                await delay(delayMs);
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        // 남은 미번역 기사 개수 확인
        const remainingCount = await prisma.news.count({
            where: {
                OR: [
                    { titleKr: null },
                    { contentKr: null }
                ]
            }
        });

        return NextResponse.json({
            success: true,
            message: `번역 완료: ${successCount}건 성공, ${failCount}건 실패`,
            translated: successCount,
            failed: failCount,
            remaining: remainingCount,
            results
        });

    } catch (error) {
        console.error('[Batch Translation] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// POST도 지원 (크론잡에서 호출 시)
export async function POST(request: NextRequest) {
    return GET(request);
}

