# CLAUDE.md - MAVS.KR 프로젝트 컨텍스트

이 파일은 Claude Code가 MAVS.KR 프로젝트를 이해하고 작업할 때 참고하는 문서입니다.

## 프로젝트 개요

**MAVS.KR**은 댈러스 매버릭스 한국 팬 커뮤니티 웹사이트입니다.

- **도메인**: mavs.kr
- **목적**: 한국 매버릭스 팬들을 위한 뉴스, 경기 정보, 커뮤니티 플랫폼
- **언어**: 한국어 (뉴스는 영어에서 자동 번역)

## 기술 스택

### 프론트엔드
- **Next.js 16** (Turbopack 사용)
- **React 19**
- **TypeScript**
- **Tailwind CSS 4**
- **Framer Motion** (애니메이션)
- **Lucide React** (아이콘)
- **TipTap Editor** (리치 텍스트 에디터)

### 백엔드
- **Next.js API Routes** (Server Actions 포함)
- **Prisma ORM**
- **PostgreSQL** (Supabase 호스팅)
- **Supabase Auth** (Google OAuth)

### 외부 서비스
- **Supabase**: 데이터베이스 및 인증
- **Gemini API**: 뉴스 번역
- **Vercel**: 배포 및 크론잡

## 프로젝트 구조

```
src/
├── app/                      # Next.js App Router
│   ├── page.tsx              # 메인 홈페이지 (탭 기반 SPA)
│   ├── layout.tsx            # 루트 레이아웃
│   ├── admin/                # 관리자 페이지
│   │   ├── page.tsx          # 대시보드
│   │   ├── layout.tsx        # 관리자 레이아웃
│   │   └── user/page.tsx     # 사용자 관리
│   ├── profile/page.tsx      # 프로필 수정
│   ├── login/page.tsx        # 로그인 (Google OAuth)
│   ├── column/               # 컬럼 기능
│   ├── actions/              # Server Actions
│   │   ├── community.ts      # 커뮤니티 CRUD
│   │   ├── comment.ts        # 댓글 CRUD
│   │   ├── profile.ts        # 프로필 업데이트
│   │   ├── notice.ts         # 공지사항
│   │   └── column.ts         # 컬럼 관리
│   └── api/                  # API Routes
│       ├── community/        # 커뮤니티 API
│       ├── nba/              # NBA 데이터 API
│       ├── news/             # 뉴스 API
│       ├── cron/             # 크론잡 API
│       └── admin/            # 관리자 API
│
├── components/
│   ├── home/                 # 홈페이지 탭 컴포넌트
│   │   ├── NewHomePage.tsx   # 메인 탭 컨테이너
│   │   ├── HomeView.tsx      # 홈 탭
│   │   ├── NewsView.tsx      # 뉴스 탭
│   │   ├── ScheduleView.tsx  # 일정 탭
│   │   ├── CommunityView.tsx # 커뮤니티 탭 (핵심 컴포넌트)
│   │   ├── ColumnView.tsx    # 컬럼 탭
│   │   └── StatsView.tsx     # 통계 탭
│   ├── layout/               # 레이아웃 컴포넌트
│   ├── ui/                   # 재사용 UI 컴포넌트
│   ├── nba/                  # NBA 관련 컴포넌트
│   ├── news/                 # 뉴스 컴포넌트
│   ├── column/               # 컬럼 컴포넌트
│   └── editor/               # TipTap 에디터
│
├── contexts/
│   └── AuthContext.tsx       # 인증 컨텍스트 (Supabase)
│
├── lib/
│   ├── db/
│   │   ├── prisma.ts         # Prisma 클라이언트
│   │   └── supabase.ts       # Supabase 클라이언트
│   └── supabase-helpers.ts   # 서버사이드 Supabase 헬퍼
│
└── types/                    # TypeScript 타입 정의
```

## 데이터베이스 스키마 (핵심 모델)

### User (사용자)
```prisma
model User {
  id        String   # cuid
  email     String   @unique
  username  String   @unique
  name      String?  # 닉네임 (프로필에서 수정 가능)
  image     String?  # 프로필 이미지
  role      Role     # USER, MODERATOR, ADMIN, COLUMNIST
  points    Int      # 활동 포인트
  posts     Post[]
  comments  Comment[]
  likes     Like[]
}
```

### Post (게시글)
```prisma
model Post {
  id             String         # cuid
  title          String
  content        String         # HTML (TipTap 에디터)
  category       ForumCategory  # NOTICE, NEWS, FREE, MARKET, MEETUP, COLUMN
  authorId       String
  isPinned       Boolean        # 공지사항 고정
  price          Int?           # 중고장터 가격
  meetupDate     DateTime?      # 모임 날짜
  meetupLocation String?        # 모임 장소
  meetupPurpose  MeetupPurpose? # 모임 목적
  images         String[]       # 뉴스 이미지 URLs
  snsLinks       String[]       # SNS 링크
}
```

### 카테고리 종류
- `NOTICE`: 공지사항 (관리자만)
- `NEWS`: 뉴스 공유
- `FREE`: 자유게시판
- `MARKET`: 중고장터
- `MEETUP`: 오프라인 모임
- `COLUMN`: 컬럼 (컬럼작성자+)

## 인증 시스템

### Supabase Auth + Google OAuth
1. 클라이언트에서 `supabase.auth.signInWithOAuth({ provider: 'google' })`
2. 콜백: `/auth/callback` 에서 세션 처리
3. `AuthContext`에서 사용자 상태 관리
4. Server Actions에서 `accessToken`으로 인증 검증

### 권한 체계
- `USER`: 일반 사용자 (커뮤니티 글/댓글 작성)
- `COLUMNIST`: 컬럼 작성 권한
- `ADMIN`: 모든 권한 (공지사항, 사용자 관리, 뉴스 크롤링)

### 인증 패턴 (Server Actions)
```typescript
// 클라이언트에서 accessToken 전달
const { data: { session } } = await supabase.auth.getSession();
const accessToken = session?.access_token;
await serverAction(formData, accessToken);

// Server Action에서 인증 확인
const { data, error } = await supabase.auth.getUser(accessToken);
```

## 핵심 컴포넌트

### CommunityView.tsx
커뮤니티 탭의 메인 컴포넌트로, SPA 스타일로 동작:
- 게시글 목록 (카테고리별 필터링)
- 게시글 상세 보기 (인라인)
- 글쓰기/수정/삭제 (인라인)
- 댓글/답글
- 좋아요
- 페이지네이션

### 주요 기능 함수
- `getDisplayName(author)`: 닉네임 > username > 이메일 순으로 표시
- `isAuthor(post)`: 현재 사용자가 작성자인지 확인
- `handleLikeToggle(postId)`: 좋아요 토글

## API 엔드포인트

### 커뮤니티 API
```
GET  /api/community?category=FREE   # 게시글 목록
POST /api/community                  # 게시글 생성 (deprecated, Server Action 사용)
```

### Server Actions (권장)
```typescript
import { createCommunityPost, updateCommunityPost, deleteCommunityPost } from '@/app/actions/community';
import { createComment, getComments } from '@/app/actions/comment';
```

### 크론잡 API
```
GET /api/cron/update-box-scores    # 박스스코어 업데이트
POST /api/admin/crawl-news         # 뉴스 크롤링
```

## 환경 변수

### 필수 (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
DATABASE_URL=postgresql://...
GEMINI_API_KEY=AIzaSyxxx...
```

## 개발 명령어

```bash
npm run dev              # 개발 서버 (Turbopack)
npm run build            # 프로덕션 빌드
npm run db:generate      # Prisma 클라이언트 생성
npm run db:push          # 스키마 푸시
```

## 코드 스타일 가이드

### 컴포넌트
- 'use client' 디렉티브 사용
- Tailwind CSS 클래스 사용
- lucide-react 아이콘
- framer-motion 애니메이션

### Server Actions
- 'use server' 디렉티브
- accessToken 파라미터로 인증
- Prisma로 DB 접근
- revalidatePath로 캐시 무효화

### 한국어 UI
- 모든 사용자 facing 텍스트는 한국어
- 날짜: `date-fns` + `ko` locale
- 시간: "n분 전" 형식

## 주의사항

1. **인증**: 모든 쓰기 작업은 `accessToken` 필수
2. **카테고리**: 커뮤니티와 컬럼은 분리된 시스템
3. **닉네임**: `User.name` 필드 사용 (username 아님)
4. **관리자**: `mavsdotkr@gmail.com` 이메일로 판별
5. **개발모드**: `NODE_ENV=development`에서 관리자 체크 우회
