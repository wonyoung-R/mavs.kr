# MAVS.KR 프로젝트 문서

> 댈러스 매버릭스 한국 팬 커뮤니티 웹사이트

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [프로젝트 구조](#프로젝트-구조)
4. [주요 기능](#주요-기능)
5. [데이터베이스 스키마](#데이터베이스-스키마)
6. [API 엔드포인트](#api-엔드포인트)
7. [컴포넌트 구조](#컴포넌트-구조)
8. [인증 시스템](#인증-시스템)
9. [실행 방법](#실행-방법)

---

## 프로젝트 개요

MAVS.KR은 댈러스 매버릭스 팬들을 위한 한국어 커뮤니티 플랫폼입니다.

### 주요 기능
- 📅 **경기 일정 및 실시간 스코어** (ESPN API 연동)
- ✍️ **칼럼** (칼럼니스트 전용 게시판)
- 💬 **커뮤니티** (자유게시판, 중고장터, 오프라인 모임)
- 👤 **사용자 인증** (Supabase OAuth)
- 🏀 **팀 정보** (선수, 순위)

---

## 기술 스택

### Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 15.5.3 | React 프레임워크 (App Router) |
| React | 19.1.0 | UI 라이브러리 |
| TypeScript | 5.x | 타입 안정성 |
| Tailwind CSS | 4.x | 스타일링 |
| Framer Motion | 12.x | 애니메이션 |
| Lucide React | 0.544.0 | 아이콘 |

### Backend
| 기술 | 버전 | 용도 |
|------|------|------|
| Prisma | 6.16.2 | ORM |
| Supabase | 2.87.0 | 인증 & 데이터베이스 |
| PostgreSQL | - | 데이터베이스 |

### 기타
| 기술 | 용도 |
|------|------|
| Tiptap | WYSIWYG 에디터 |
| Cheerio | 웹 스크래핑 |
| date-fns | 날짜 처리 |
| React Query | 서버 상태 관리 |

---

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── actions/           # Server Actions
│   │   ├── column.ts      # 칼럼 CRUD
│   │   ├── comment.ts     # 댓글 CRUD
│   │   ├── community.ts   # 커뮤니티 CRUD
│   │   └── post.ts        # 게시글 CRUD
│   │
│   ├── api/               # API Routes
│   │   ├── columns/       # 칼럼 API
│   │   ├── community/     # 커뮤니티 API
│   │   ├── cron/          # 스케줄 작업
│   │   ├── games/         # 경기 API
│   │   ├── nba/           # NBA 데이터 API
│   │   └── translate/     # 번역 API
│   │
│   ├── admin/             # 관리자 페이지
│   ├── auth/              # 인증 콜백
│   ├── column/            # 칼럼 페이지
│   ├── community/         # 커뮤니티 페이지
│   ├── games/             # 경기 페이지
│   ├── login/             # 로그인 페이지
│   ├── players/           # 선수 페이지
│   ├── profile/           # 프로필 페이지
│   │
│   ├── layout.tsx         # 루트 레이아웃
│   └── page.tsx           # 홈페이지
│
├── components/            # React 컴포넌트
│   ├── column/           # 칼럼 관련
│   ├── community/        # 커뮤니티 관련
│   ├── editor/           # 에디터
│   ├── games/            # 경기 관련
│   ├── home/             # 홈 탭 뷰
│   ├── layout/           # 레이아웃 (Header, Footer)
│   ├── nba/              # NBA 데이터 표시
│   └── ui/               # 공통 UI 컴포넌트
│
├── contexts/             # React Context
│   └── AuthContext.tsx   # 인증 상태 관리
│
├── hooks/                # Custom Hooks
│   ├── useBatchTranslation.ts
│   ├── useNews.ts
│   └── useNewsFilter.ts
│
├── lib/                  # 유틸리티 & 서비스
│   ├── api/              # 외부 API 클라이언트
│   ├── db/               # 데이터베이스 클라이언트
│   ├── services/         # 비즈니스 로직
│   └── utils/            # 유틸리티 함수
│
└── types/                # TypeScript 타입 정의
    ├── forum.ts
    ├── game.ts
    └── player.ts
```

---

## 주요 기능

### 1. 홈 (NewHomePage)

메인 화면은 탭 기반 네비게이션으로 구성됩니다.

```
┌─────────────────────────────────────────┐
│  [Home] [Schedule] [News] [Column] [Community]
├─────────────────────────────────────────┤
│                                         │
│         현재 탭의 콘텐츠                  │
│                                         │
└─────────────────────────────────────────┘
```

**탭 구성:**
- `Home` - 오늘의 경기, 주요 정보
- `Schedule` - 경기 일정 (KST 시간)
- `News` - 뉴스 (준비중)
- `Column` - 칼럼니스트 게시판
- `Community` - 팬 커뮤니티

**파일:** `src/components/home/NewHomePage.tsx`

---

### 2. 경기 일정 (Schedule)

ESPN API를 통해 매버릭스 경기 정보를 가져옵니다.

**기능:**
- 다음 경기 배너 (상단 하이라이트)
- 월별 경기 필터링
- KST 시간 변환
- 실시간 스코어 (LIVE 경기)
- 경기 결과 (WIN/LOSS)

**API 엔드포인트:**
- `GET /api/nba/espn-schedule` - 경기 일정
- `GET /api/nba/live-scores` - 실시간 스코어

**KST 변환 로직:**
```typescript
const kstFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
```

**파일:** `src/components/home/ScheduleView.tsx`

---

### 3. 칼럼 (Column)

칼럼니스트와 관리자만 작성할 수 있는 전문 게시판입니다.

**권한:**
- `COLUMNIST` - 작성 가능
- `ADMIN` - 작성 + 삭제 가능
- `USER` - 읽기만 가능

**기능:**
- Featured 칼럼 (최신 1개 대형 표시)
- 칼럼 목록 (카드 그리드)
- WYSIWYG 에디터 (Tiptap)
- 댓글/좋아요

**파일:**
- `src/components/home/ColumnView.tsx` - 목록 뷰
- `src/app/column/[id]/page.tsx` - 상세 페이지
- `src/app/column/new/page.tsx` - 작성 페이지
- `src/app/actions/column.ts` - Server Action

---

### 4. 커뮤니티 (Community)

팬들을 위한 다목적 게시판입니다.

**카테고리:**
| 카테고리 | 설명 | 추가 필드 |
|----------|------|-----------|
| `FREE` | 자유게시판 | - |
| `MARKET` | 중고장터 | `price` (가격) |
| `MEETUP` | 오프라인 모임 | `meetupDate`, `meetupLocation`, `meetupPurpose` |

**모임 목적 (MeetupPurpose):**
- `DRINK` - 술 한잔
- `MEAL` - 식사
- `THUNDER` - 번개 직관
- `EXERCISE` - 운동
- `MEETING` - 정모

**기능:**
- 카테고리별 필터링
- 인라인 글쓰기 폼
- 댓글 시스템 (대댓글 포함)
- 좋아요 기능
- Masonry 레이아웃

**파일:**
- `src/components/home/CommunityView.tsx` - 목록 뷰
- `src/app/community/[id]/page.tsx` - 상세 페이지
- `src/app/actions/community.ts` - Server Action
- `src/components/community/CommentSection.tsx` - 댓글

---

### 5. 모바일 네비게이션 (TabNavigation)

모바일에서는 햄버거 메뉴로 네비게이션합니다.

**기능:**
- 오른쪽 상단 햄버거 버튼
- 스크롤 시 버튼 스타일 변경 (불투명)
- 탭 목록 + 프로필 섹션
- 프로필 클릭 시 하위 메뉴 펼침

**파일:** `src/components/ui/TabNavigation.tsx`

---

## 데이터베이스 스키마

### News (뉴스)
```prisma
model News {
  id            String      @id @default(cuid())
  title         String
  titleKr       String?                    // 한국어 제목
  content       String      @db.Text
  contentKr     String?     @db.Text       // 한국어 본문
  summary       String?
  summaryKr     String?     @db.Text       // 한국어 요약
  source        NewsSource                 // ESPN, MAVS_MONEYBALL, SMOKING_CUBAN
  sourceUrl     String
  author        String?
  imageUrl      String?
  publishedAt   DateTime
  crawledAt     DateTime    @default(now())
  viewCount     Int         @default(0)
  tags          Tag[]

  @@index([source, publishedAt])
  @@index([crawledAt])
}

enum NewsSource {
  ESPN
  MAVS_MONEYBALL
  SMOKING_CUBAN
}
```

### User (사용자)
```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  username  String    @unique
  password  String?
  name      String?
  image     String?
  role      Role      @default(USER)  // USER, MODERATOR, ADMIN, COLUMNIST
  points    Int       @default(0)
  badges    Badge[]
  posts     Post[]
  comments  Comment[]
  votes     Vote[]
  likes     Like[]
}
```

### Post (게시글)
```prisma
model Post {
  id             String         @id @default(cuid())
  title          String
  content        String         @db.Text
  category       ForumCategory  // GAME_THREAD, GENERAL, COLUMN, FREE, MARKET, MEETUP
  author         User           @relation(...)
  viewCount      Int            @default(0)
  isPinned       Boolean        @default(false)
  comments       Comment[]
  votes          Vote[]
  likes          Like[]
  
  // Market 전용
  price          Int?
  
  // Meetup 전용
  meetupDate     DateTime?
  meetupLocation String?
  meetupPurpose  MeetupPurpose?
}
```

### Comment (댓글)
```prisma
model Comment {
  id        String    @id @default(cuid())
  content   String    @db.Text
  post      Post      @relation(...)
  author    User      @relation(...)
  parentId  String?                        // 대댓글용
  parent    Comment?  @relation("CommentReplies", ...)
  replies   Comment[] @relation("CommentReplies")
}
```

### Game (경기)
```prisma
model Game {
  id            String      @id @default(cuid())
  gameId        String      @unique
  homeTeam      String
  awayTeam      String
  homeScore     Int?
  awayScore     Int?
  status        GameStatus  // SCHEDULED, LIVE, FINAL, POSTPONED
  scheduledAt   DateTime
  quarter       Int?
  timeRemaining String?
  broadcasts    String[]
  stats         Json?
}
```

---

## API 엔드포인트

### NBA 데이터
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/nba/espn-schedule` | 매버릭스 시즌 일정 |
| GET | `/api/nba/live-scores` | 오늘의 NBA 스코어 |
| GET | `/api/nba/box-scores` | 박스 스코어 |
| GET | `/api/nba/standings` | 리그 순위 |

### 커뮤니티
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/community` | 커뮤니티 글 목록 |
| GET | `/api/columns` | 칼럼 목록 |

### Cron Jobs
| 경로 | 주기 | 설명 |
|------|------|------|
| `/api/cron/update-box-scores` | 5분 | 박스 스코어 업데이트 |

---

## 컴포넌트 구조

### UI 컴포넌트
| 컴포넌트 | 경로 | 설명 |
|----------|------|------|
| `Button` | `ui/Button.tsx` | 버튼 |
| `Card` | `ui/Card.tsx` | 카드 컨테이너 |
| `Badge` | `ui/Badge.tsx` | 배지 |
| `TabNavigation` | `ui/TabNavigation.tsx` | 탭 네비게이션 |
| `MavericksLoading` | `ui/MavericksLoading.tsx` | 로딩 애니메이션 |

### 홈 뷰 컴포넌트
| 컴포넌트 | 설명 |
|----------|------|
| `HomeView` | 홈 탭 콘텐츠 |
| `ScheduleView` | 경기 일정 |
| `ColumnView` | 칼럼 목록 |
| `CommunityView` | 커뮤니티 목록 |
| `NewsView` | 뉴스 (준비중) |

### 에디터
| 컴포넌트 | 설명 |
|----------|------|
| `TiptapEditor` | WYSIWYG 에디터 (이미지, 링크, 유튜브 지원) |

---

## 인증 시스템

### Supabase OAuth

인증은 Supabase를 통해 처리됩니다.

**지원 로그인:**
- Google OAuth

**인증 플로우:**
1. 사용자가 로그인 버튼 클릭
2. Supabase OAuth 리다이렉트
3. `/auth/callback` 에서 토큰 처리
4. `AuthContext`에 사용자 정보 저장

**AuthContext 제공값:**
```typescript
const { user, loading, signOut, userRole, session } = useAuth();
```

**역할 (Role):**
- `USER` - 일반 사용자
- `COLUMNIST` - 칼럼니스트
- `ADMIN` - 관리자
- `MODERATOR` - 중재자

**파일:**
- `src/contexts/AuthContext.tsx`
- `src/app/auth/callback/route.ts`
- `src/app/login/page.tsx`

---

## 실행 방법

### 1. 환경 변수 설정

`.env` 파일 생성:
```env
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
GEMINI_API_KEY="..."
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 데이터베이스 설정
```bash
npm run db:generate  # Prisma 클라이언트 생성
npm run db:push      # 스키마 적용
```

### 4. 개발 서버 실행
```bash
npm run dev
```

### 5. 빌드
```bash
npm run build
npm run start
```

---

## 팀 로고 매핑

팀 로고는 Supabase Storage에서 가져옵니다.

**파일:** `src/lib/utils/team-logos.ts`

**매핑 예시:**
```typescript
'Mavericks': 'dal',
'Jazz': 'uta', 'Utah Jazz': 'uta', 'Utah': 'uta',
'Lakers': 'lal', 'Los Angeles Lakers': 'lal',
// ...
```

**URL 패턴:**
```
{SUPABASE_URL}/storage/v1/object/public/MAVS.KR/NBA_Logos/{약어}.png
```

---

## 라이선스

© 2024 MAVS.KR Team. All rights reserved.

