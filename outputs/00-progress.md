---
agent: claude (자율 진행)
status: ✅ Phase 0 + Phase 1 + Phase 2 + Phase 3 코드 완료
project: mavs.kr
branch: main
env: local
started: 2026-05-13 KST
mode: 운영
self-review: PASS (tsc --noEmit exit 0)
push: ❌ 보류 (사장 검토 대상)
db_migration: ❌ 미실행 (SQL 파일만 작성)
---

# 자율 진행 결과 보고

## 진행 트랙별 결과

### Track A: 인프라 (코드)
- ✅ `src/lib/auto-content/gemini.ts` — Gemini wrapper (재시도, JSON mode)
- ✅ `src/lib/auto-content/prompt/system.ts` — VOICE_SPEC inline 시스템 프롬프트
- ✅ `src/lib/auto-content/publisher.ts` — News 테이블 publish 헬퍼 + system author 캐시
- ✅ `src/lib/auto-content/templates/article.ts` — 표준 글 빌더 + validateArticle
- ✅ `src/lib/auto-content/cron-auth.ts` — Bearer CRON_SECRET + Vercel UA 허용 + dry-run 파서
- ✅ `src/lib/seo/jsonld.ts` — buildNewsArticleSchema
- ✅ `src/app/sitemap.ts` — 동적 sitemap (News + Post, revalidate 1h)
- ✅ `src/app/news/[id]/page.tsx` — SEO용 상세 라우트 (generateMetadata + JSON-LD + 자동 글 배지)

### Track B: DB (SQL only)
- ✅ `prisma/schema.prisma` — News 모델 확장 + PerspectiveLog 신설 + NewsSource enum 2건 추가
- ✅ `prisma/migrations-pending/001_system_user_and_news_extension.sql`
- ✅ `npx prisma generate` 실행 완료 (클라이언트만, DB 영향 없음)
- ❌ `prisma db push` / 실제 SQL 실행 — **사장 확인 후 수동**

### Track C: 코퍼스
- ✅ `scripts/voice-corpus/extract.ts` — Post 테이블에서 Ryu 글 추출 스크립트
- ✅ `voice-corpus/posts/*.md` — **14건 추출 완료** (FREE 4, COLUMN 2, MEETUP 3, ANALYSIS 1, NEWS 2, NOTICE 2)
- ✅ `voice-corpus/signature.md` — Ryu 시그니처 표현
- ✅ `voice-corpus/instagram/README.md` — 수동 드롭 안내
- ✅ `voice-corpus/VOICE_SPEC.md` v1.0 — 분석 기반 사양

### Phase 1: 시각 박스 5단계 파이프라인
- ✅ `perspective/banned-patterns.ts` — 7개 정규식 (처방형/단정미래/비방/이모지/메타 등)
- ✅ `perspective/classify.ts` — 7 카테고리 → risk_level 매핑
- ✅ `perspective/generate.ts` — LOW/MEDIUM/HIGH 템플릿
- ✅ `perspective/critique.ts` — Self-critique (PASS/REVISE/REJECT)
- ✅ `perspective/fallback.ts` — risk별 폴백 텍스트
- ✅ `perspective/index.ts` — `runPerspectivePipeline` 통합 진입점 + perspective_logs 자동 기록

### Phase 2: 3개 cron 라우트
- ✅ `app/api/cron/nba-recap/route.ts` — stats.nba.com scoreboardv3, 어제 Mavs 경기 → 시각박스 → publish
- ✅ `app/api/cron/mavsmoneyball-rss/route.ts` — RSS + cheerio 본문 + Gemini 재창조 + 시각박스 (최대 3건/run)
- ⚠️ `app/api/cron/injury-report/route.ts` — **스켈레톤만**. `npm install pdf-parse` 필요.

### Phase 3: 관리자 + 다이제스트
- ✅ `app/admin/auto-posts/page.tsx` — 회수 대시보드 (source/risk/status 필터, 인라인 시각박스, 회수 버튼)
- ✅ `app/api/admin/auto-posts/route.ts` — 최근 30일 자동 글 GET (admin 인증)
- ✅ `app/api/admin/retract/[id]/route.ts` — 회수 POST + retractedAt/retractReason 기록 + log
- ✅ `app/api/cron/daily-digest/route.ts` — Resend 발송 (KST 09:30 = UTC 00:30)

### Vercel cron 통합
- ✅ `vercel.json` — 7개 cron 등록:
  - `update-box-scores` (기존)
  - `update-news` 3h마다 (기존 라우트 등록만)
  - `translate-news` 3h마다 +15min
  - `nba-recap` 매일 KST 09:00
  - `mavsmoneyball-rss` 6h마다
  - `injury-report` 매일 KST 07:30
  - `daily-digest` 매일 KST 09:30

---

## 타입 안전성
```
npx tsc --noEmit  → exit 0 (모든 새 코드 통과)
```

## 사장 확인 후 다음 단계 (체크리스트)

### A. 실행 대기 명령 (운영 DB 영향)
```bash
# 1) 마이그레이션 SQL 검토 후 적용
psql $DATABASE_URL -f prisma/migrations-pending/001_system_user_and_news_extension.sql

# 2) (또는 Prisma migrate dev로 새 마이그레이션 생성)
npx prisma migrate dev --name auto_content_phase0
```

### B. 환경변수 추가 (Vercel + .env.local)
```
CRON_SECRET            (Vercel cron 인증용, 임의 64자 hex 생성)
RESEND_API_KEY         (다이제스트 이메일 발송용)
NEXT_PUBLIC_SITE_URL   (https://mavs.kr — JSON-LD/sitemap canonical)
```

### C. 의존성 추가
```bash
npm install pdf-parse  # injury-report 파이프라인 활성화용
```

### D. push 결정
- 현재 ad897c8 이후 자동 콘텐츠 파이프라인 코드만 추가
- main 직접 push 또는 dev 브랜치 분리 — **사장 결정**

### E. dry-run 검증 (배포 전)
```bash
# 로컬에서
curl http://localhost:3000/api/cron/nba-recap?dry=1
curl http://localhost:3000/api/cron/mavsmoneyball-rss?dry=1
curl http://localhost:3000/api/cron/daily-digest?dry=1
```

### F. Voice Corpus 운영 결정
- `voice-corpus/posts/*.md` — 공개 게시글 미러이지만 .gitignore 추가 여부 결정
- Instagram 캡션 추가 드롭 시점 결정

---

## 한 줄 요약

작업 지시서 Phase 0~3 코드 100% 작성 완료(injury-report 스켈레톤 제외). 
DB SQL 미실행, push 미실행. 사장 검토 후 위 A~F 결정 필요.
