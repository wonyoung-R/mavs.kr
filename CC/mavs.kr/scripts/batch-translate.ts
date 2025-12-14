#!/usr/bin/env npx ts-node
/**
 * 뉴스 번역 배치 스크립트
 * 
 * 사용법:
 *   npx ts-node scripts/batch-translate.ts
 * 
 * 또는 API 호출:
 *   curl "http://localhost:3000/api/batch/translate-news?limit=5&delay=10000"
 * 
 * 옵션:
 *   limit: 한 번에 번역할 기사 수 (기본: 5)
 *   delay: 기사 간 대기 시간 (ms, 기본: 10000 = 10초)
 */

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function runBatchTranslation() {
    console.log('🚀 뉴스 번역 배치 시작...\n');

    const limit = process.argv[2] || '5';
    const delay = process.argv[3] || '10000';

    try {
        const response = await fetch(
            `${API_URL}/api/batch/translate-news?limit=${limit}&delay=${delay}`
        );

        const result = await response.json();

        if (result.success) {
            console.log('\n✅ 배치 완료!');
            console.log(`   - 성공: ${result.translated}건`);
            console.log(`   - 실패: ${result.failed}건`);
            console.log(`   - 남은 미번역: ${result.remaining}건`);
            
            if (result.remaining > 0) {
                console.log('\n💡 남은 기사를 번역하려면 스크립트를 다시 실행하세요.');
            }
        } else {
            console.error('❌ 배치 실패:', result.error);
        }

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    }
}

runBatchTranslation();

