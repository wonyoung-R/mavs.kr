# MAVS.KR Development Rules

> **Last Updated:** 2025년 10월
>
> **Stack:** Next.js 15, React 19, TypeScript 5.9, Tailwind CSS 4, Prisma ORM

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [코드 스타일 가이드라인](#코드-스타일-가이드라인)
3. [컴포넌트 컨벤션](#컴포넌트-컨벤션)
4. [TypeScript 설정](#typescript-설정)
5. [Tailwind CSS 디자인 시스템](#tailwind-css-디자인-시스템)
6. [API 디자인](#api-디자인)
7. [데이터베이스 컨벤션](#데이터베이스-컨벤션)
8. [성능 최적화](#성능-최적화)
9. [테스트 요구사항](#테스트-요구사항)
10. [보안](#보안)
11. [커밋 메시지 형식](#커밋-메시지-형식)
12. [배포 워크플로](#배포-워크플로)

---

## 프로젝트 개요

Dallas Mavericks 한국 팬사이트 - 뉴스 집계, 실시간 경기 추적, 커뮤니티 포럼 제공

**주요 기능:**
- 실시간 NBA 경기 데이터 연동
- 다국어 뉴스 자동 번역 및 큐레이션
- 팬 커뮤니티 포럼 및 투표 시스템
- 선수 통계 및 경기 일정 관리

---

## 코드 스타일 가이드라인

### 기본 원칙

1. **TypeScript Strict Mode 사용**
   - 모든 `.ts`, `.tsx` 파일에서 엄격한 타입 검사 적용
   - `any` 타입 사용 금지 - 대신 `unknown` 사용 후 타입 가드 적용

2. **함수형 컴포넌트 및 Hooks 선호**
   - 클래스 컴포넌트 사용 금지
   - 로직 재사용은 커스텀 훅으로 추출

3. **Tailwind CSS 우선 사용**
   - CSS 모듈 및 styled-components 사용 최소화
   - 복잡한 스타일은 Tailwind theme 확장으로 해결

4. **ESLint 및 Prettier 설정 준수**
   ```json
   {
     "extends": [
       "next/core-web-vitals",
       "plugin:@typescript-eslint/strict-type-checked",
       "prettier"
     ],
     "rules": {
       "@typescript-eslint/no-explicit-any": "error",
       "@typescript-eslint/no-unused-vars": "error",
       "prefer-const": "error"
     }
   }
   ```

5. **코드 주석**
   - 비즈니스 로직 주석은 **한국어**로 작성
   - 함수 및 타입 문서화는 JSDoc/TSDoc 사용
   ```typescript
   /**
    * 사용자 인증 상태를 검증하고 세션 정보를 반환합니다.
    * @param token - JWT 액세스 토큰
    * @returns 사용자 정보 및 권한
    * @throws {AuthError} 토큰이 유효하지 않거나 만료된 경우
    */
   async function validateAuth(token: string): Promise<UserSession> {
     // 토큰 검증 로직...
   }
   ```

---

## 컴포넌트 컨벤션

### Atomic Design 패턴

```
src/
├── components/
│   ├── atoms/          # 기본 UI 요소 (Button, Input, Badge)
│   ├── molecules/      # 원자 조합 (SearchBar, PlayerCard)
│   ├── organisms/      # 복잡한 UI 블록 (Header, GameSchedule)
│   ├── templates/      # 페이지 레이아웃
│   └── ui/            # shadcn/ui 컴포넌트
```

### 네이밍 규칙

- **컴포넌트:** PascalCase (`PlayerCard.tsx`)
- **유틸 함수:** camelCase (`formatGameTime.ts`)
- **상수:** UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **타입/인터페이스:** PascalCase, `I` 접두사 금지

### 파일 구조

```typescript
// PlayerCard.tsx
'use client' // Client Component인 경우에만 명시

import { type FC } from 'react'

interface PlayerCardProps {
  player: Player
  isHighlighted?: boolean
}

/**
 * 선수 정보를 카드 형태로 표시하는 컴포넌트
 */
export const PlayerCard: FC<PlayerCardProps> = ({ player, isHighlighted = false }) => {
  // 컴포넌트 로직 (200줄 이하 유지)
  return (
    <article className="...">
      {/* JSX */}
    </article>
  )
}

// displayName 명시 (디버깅 편의성)
PlayerCard.displayName = 'PlayerCard'
```

### Server vs Client Components

**기본은 Server Component:**
```typescript
// app/games/[id]/page.tsx (Server Component)
import { db } from '@/lib/db'

export default async function GameDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const game = await db.game.findUnique({ where: { id } })

  return <GameDetail game={game} />
}
```

**Client Component가 필요한 경우:**
- 브라우저 API 사용 (localStorage, window 등)
- 이벤트 핸들러 (onClick, onChange)
- useState, useEffect 등 리액트 훅 사용
- 써드파티 클라이언트 전용 라이브러리

```typescript
// 'use client' 지시어 필수
'use client'

import { useState } from 'react'

export function VoteButton() {
  const [votes, setVotes] = useState(0)
  // ...
}
```

---

## TypeScript 설정

### tsconfig.json 권장 설정

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",

    // Type Checking - STRICT 설정
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    // Additional Checks
    "noUncheckedIndexedAccess": true,  // 배열/객체 접근 시 undefined 체크 강제
    "noImplicitOverride": true,        // override 키워드 명시 강제
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "allowUnusedLabels": false,

    // Module Resolution
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "isolatedModules": true,
    "skipLibCheck": true,

    // Emit
    "noEmit": true,
    "incremental": true,

    // Path Mapping
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/types/*": ["./src/types/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### 환경 변수 타입 안정성

```typescript
// src/env.ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NBA_API_KEY: z.string(),
  REDIS_URL: z.string().url().optional(),
})

export const env = envSchema.parse(process.env)

// 사용 예시
import { env } from '@/env'
console.log(env.DATABASE_URL) // ✅ 타입 안전
```

### 타입 선언 규칙

```typescript
// ❌ 나쁜 예: any 사용
function processData(data: any) { }

// ✅ 좋은 예: unknown + 타입 가드
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'id' in data) {
    // 타입 좁히기 후 사용
  }
}

// ❌ 나쁜 예: I 접두사
interface IUser { }

// ✅ 좋은 예
interface User { }
type UserProps = { }

// ✅ 좋은 예: 유니온 타입으로 명확한 상태 정의
type GameStatus = 'scheduled' | 'live' | 'finished' | 'postponed'
```

---

## Tailwind CSS 디자인 시스템

### Theme 확장 (tailwind.config.ts)

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      // Design Tokens 정의
      colors: {
        mavs: {
          blue: '#00538C',
          navy: '#002B5E',
          silver: '#B8C4CA',
          white: '#FFFFFF',
        },
        brand: {
          primary: 'var(--color-primary)',
          secondary: 'var(--color-secondary)',
        },
      },
      fontFamily: {
        sans: ['var(--font-pretendard)', 'system-ui', 'sans-serif'],
        display: ['var(--font-bebas-neue)', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
}

export default config
```

### CSS 클래스 네이밍 컨벤션

**패턴:** `[Context][Element][Variant]`

```typescript
// ✅ 좋은 예: 재사용 가능한 커스텀 클래스
// globals.css
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-mavs-blue text-white rounded-lg
           hover:bg-mavs-navy transition-colors duration-200
           focus:outline-none focus:ring-2 focus:ring-mavs-blue focus:ring-offset-2
           disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .card-game-summary {
    @apply p-6 bg-white rounded-xl shadow-lg
           hover:shadow-xl transition-shadow duration-300;
  }
}

// 사용
<button className="btn-primary">투표하기</button>
<article className="card-game-summary">...</article>
```

### Responsive Design

```typescript
// Mobile-first 접근
<div className="
  px-4 py-6           // 모바일
  sm:px-6             // 640px+
  md:px-8 md:py-10    // 768px+
  lg:px-12 lg:py-14   // 1024px+
  xl:px-16            // 1280px+
">
  Content
</div>
```

---

## API 디자인

### Route Handler (App Router)

```typescript
// app/api/games/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'

// 요청 스키마 정의 (Zod)
const GetGamesSchema = z.object({
  season: z.string().regex(/^\d{4}$/),
  team: z.enum(['DAL', 'ALL']).default('DAL'),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const params = GetGamesSchema.parse({
      season: searchParams.get('season'),
      team: searchParams.get('team'),
      limit: searchParams.get('limit'),
    })

    // 캐시 확인
    const cacheKey = `games:${params.season}:${params.team}:${params.limit}`
    const cached = await redis.get(cacheKey)
    if (cached) {
      return NextResponse.json(JSON.parse(cached), {
        headers: { 'X-Cache': 'HIT' },
      })
    }

    // DB 조회
    const games = await db.game.findMany({
      where: { season: params.season },
      take: params.limit,
    })

    // 캐시 저장 (1시간)
    await redis.setex(cacheKey, 3600, JSON.stringify(games))

    return NextResponse.json(games, {
      headers: { 'X-Cache': 'MISS' },
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      )
    }

    console.error('GET /api/games error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Rate Limiting 적용
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // or 'edge'
```

### Server Actions

```typescript
// app/actions/vote.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

const VoteSchema = z.object({
  pollId: z.string().uuid(),
  optionId: z.string().uuid(),
})

export async function submitVote(formData: FormData) {
  const session = await auth()
  if (!session?.user) {
    return { success: false, error: '로그인이 필요합니다' }
  }

  try {
    const data = VoteSchema.parse({
      pollId: formData.get('pollId'),
      optionId: formData.get('optionId'),
    })

    // 중복 투표 확인
    const existingVote = await db.vote.findFirst({
      where: {
        pollId: data.pollId,
        userId: session.user.id,
      },
    })

    if (existingVote) {
      return { success: false, error: '이미 투표하셨습니다' }
    }

    // 투표 저장
    await db.vote.create({
      data: {
        pollId: data.pollId,
        optionId: data.optionId,
        userId: session.user.id,
      },
    })

    // 캐시 무효화
    revalidatePath(`/community/polls/${data.pollId}`)

    return { success: true }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: '잘못된 요청입니다' }
    }

    console.error('submitVote error:', error)
    return { success: false, error: '투표 처리 중 오류가 발생했습니다' }
  }
}
```

### API 보안

1. **모든 입력 값 검증 (Zod)**
2. **Rate Limiting** - Upstash Redis 활용
3. **CSRF 토큰** - NextAuth.js 내장 기능 사용
4. **SQL Injection 방지** - Prisma ORM 사용
5. **XSS 방지** - DOMPurify로 사용자 입력 sanitize

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from './redis'

export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 1분에 10회
  analytics: true,
})

// API Route에서 사용
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await rateLimiter.limit(ip)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    )
  }

  // 실제 로직...
}
```

---

## 데이터베이스 컨벤션

### Prisma Schema 네이밍

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 네이밍 규칙:
// - 모델명: PascalCase (User, GameSchedule)
// - 필드명: camelCase (firstName, createdAt)
// - DB 테이블/컬럼: snake_case (user, first_name)
// - 관계 필드: 단수형 명사 (author, team)

model User {
  id            String    @id @default(cuid()) @map("user_id")
  email         String    @unique
  name          String?
  emailVerified DateTime? @map("email_verified")
  image         String?
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  accounts      Account[]
  sessions      Session[]
  posts         Post[]
  votes         Vote[]

  @@map("users")
  @@index([email])
}

model Post {
  id          String   @id @default(cuid())
  title       String
  content     String   @db.Text
  published   Boolean  @default(false)
  authorId    String   @map("author_id")
  categoryId  String   @map("category_id")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // 관계 필드는 단수형
  author      User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  category    Category @relation(fields: [categoryId], references: [id])

  @@map("posts")
  @@index([authorId])
  @@index([categoryId])
  @@index([createdAt])
}

model Category {
  id    String @id @default(cuid())
  name  String @unique
  posts Post[]

  @@map("categories")
}
```

### 마이그레이션 규칙

```bash
# 개발 환경: 새 마이그레이션 생성 및 적용
npx prisma migrate dev --name add_post_category

# 프로덕션: 마이그레이션만 적용 (생성 X)
npx prisma migrate deploy

# 마이그레이션 이름 형식: snake_case + 동사_목적어
# ✅ add_user_email_index
# ✅ rename_post_content_column
# ✅ create_game_schedule_table
# ❌ migration1, update, fix
```

### 트랜잭션 사용

```typescript
// ❌ 나쁜 예: 개별 쿼리
await db.user.update({ where: { id }, data: { coins: user.coins - 100 } })
await db.order.create({ data: { userId: id, amount: 100 } })

// ✅ 좋은 예: 트랜잭션
await db.$transaction([
  db.user.update({
    where: { id },
    data: { coins: { decrement: 100 } }
  }),
  db.order.create({
    data: { userId: id, amount: 100 }
  }),
])

// ✅ 더 좋은 예: Interactive Transaction
await db.$transaction(async (tx) => {
  const user = await tx.user.findUnique({ where: { id } })
  if (!user || user.coins < 100) {
    throw new Error('Insufficient coins')
  }

  await tx.user.update({
    where: { id },
    data: { coins: { decrement: 100 } },
  })

  await tx.order.create({
    data: { userId: id, amount: 100 },
  })
})
```

### 인덱스 전략

```prisma
model Game {
  id            String   @id @default(cuid())
  homeTeamId    String   @map("home_team_id")
  awayTeamId    String   @map("away_team_id")
  scheduledAt   DateTime @map("scheduled_at")
  status        String   // 'scheduled' | 'live' | 'finished'
  season        String

  // 자주 조회되는 필드 조합에 인덱스
  @@index([season, scheduledAt])
  @@index([status, scheduledAt])
  @@index([homeTeamId, season])
  @@index([awayTeamId, season])
  @@map("games")
}
```

---

## 성능 최적화

### 1. Next.js 캐싱 전략

```typescript
// ISR (Incremental Static Regeneration)
// app/news/[slug]/page.tsx
export const revalidate = 3600 // 1시간마다 재생성

export async function generateStaticParams() {
  const news = await db.news.findMany({
    select: { slug: true },
    take: 100, // 빌드 시 상위 100개만 생성
  })

  return news.map((item) => ({ slug: item.slug }))
}

// 동적 페이지는 On-demand로 생성
export const dynamicParams = true

// Static Data Fetching
export default async function NewsPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // force-cache: 빌드 시 fetch하여 캐싱
  const news = await fetch(`https://api.example.com/news/${slug}`, {
    cache: 'force-cache',
    next: { revalidate: 3600 },
  })

  return <NewsArticle data={await news.json()} />
}
```

### 2. 이미지 최적화

```typescript
import Image from 'next/image'

// ✅ 좋은 예: Next.js Image 컴포넌트
<Image
  src="/players/luka-doncic.jpg"
  alt="Luka Dončić"
  width={400}
  height={400}
  loading="lazy" // 기본값
  placeholder="blur"
  blurDataURL="/players/luka-doncic-blur.jpg"
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
/>

// 외부 이미지 도메인 허용 (next.config.js)
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.nba.com',
        pathname: '/headshots/**',
      },
    ],
  },
}
```

### 3. Code Splitting & Lazy Loading

```typescript
import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// 동적 import로 번들 사이즈 줄이기
const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <div>차트 로딩 중...</div>,
  ssr: false, // 클라이언트에서만 렌더링
})

export default function StatsPage() {
  return (
    <div>
      <h1>선수 통계</h1>
      <Suspense fallback={<div>데이터 로딩 중...</div>}>
        <HeavyChart />
      </Suspense>
    </div>
  )
}
```

### 4. Virtual Scrolling

```typescript
// react-window 사용
import { FixedSizeList } from 'react-window'

function GameList({ games }: { games: Game[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <GameCard game={games[index]} />
    </div>
  )

  return (
    <FixedSizeList
      height={600}
      itemCount={games.length}
      itemSize={100}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  )
}
```

### 5. React Streaming & Suspense

```typescript
// app/games/page.tsx
import { Suspense } from 'react'

async function GameListServer() {
  const games = await db.game.findMany()
  return <GameList games={games} />
}

export default function GamesPage() {
  return (
    <div>
      <h1>경기 일정</h1>
      <Suspense fallback={<GameListSkeleton />}>
        {/* Server Component가 데이터 fetch하는 동안 fallback 표시 */}
        <GameListServer />
      </Suspense>
    </div>
  )
}
```

---

## 테스트 요구사항

### 테스트 프레임워크

- **단위 테스트:** Vitest
- **E2E 테스트:** Playwright
- **컴포넌트 테스트:** React Testing Library

### 커버리지 목표

- **전체 코드 커버리지:** 80% 이상
- **유틸 함수:** 90% 이상
- **API Routes:** 85% 이상
- **컴포넌트:** 75% 이상

### 테스트 작성 규칙

```typescript
// __tests__/utils/formatGameTime.test.ts
import { describe, it, expect } from 'vitest'
import { formatGameTime } from '@/lib/utils/formatGameTime'

describe('formatGameTime', () => {
  it('한국 시간으로 경기 시각을 포맷팅한다', () => {
    const date = new Date('2025-10-15T18:00:00Z')
    expect(formatGameTime(date)).toBe('2025년 10월 16일 오전 3:00')
  })

  it('잘못된 날짜 입력 시 에러를 발생시킨다', () => {
    expect(() => formatGameTime(null as any)).toThrow()
  })
})

// __tests__/components/GameCard.test.tsx
import { render, screen } from '@testing-library/react'
import { GameCard } from '@/components/molecules/GameCard'

describe('GameCard', () => {
  const mockGame = {
    id: '1',
    homeTeam: 'Dallas Mavericks',
    awayTeam: 'Los Angeles Lakers',
    scheduledAt: new Date('2025-10-15T18:00:00Z'),
    status: 'scheduled' as const,
  }

  it('경기 정보를 올바르게 렌더링한다', () => {
    render(<GameCard game={mockGame} />)

    expect(screen.getByText('Dallas Mavericks')).toBeInTheDocument()
    expect(screen.getByText('Los Angeles Lakers')).toBeInTheDocument()
  })
})

// e2e/vote.spec.ts (Playwright)
import { test, expect } from '@playwright/test'

test('사용자가 투표를 제출할 수 있다', async ({ page }) => {
  await page.goto('/community/polls/mvp-2025')

  // 로그인
  await page.click('text=로그인')
  await page.fill('input[name="email"]', 'test@example.com')
  await page.fill('input[name="password"]', 'password123')
  await page.click('button[type="submit"]')

  // 투표 선택
  await page.click('text=Luka Dončić')
  await page.click('button:has-text("투표하기")')

  // 성공 메시지 확인
  await expect(page.locator('text=투표가 완료되었습니다')).toBeVisible()
})
```

### CI/CD 통합

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Unit tests
        run: npm run test

      - name: E2E tests
        run: npx playwright test

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
```

---

## 보안

### 1. 입력 검증

```typescript
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

// API 입력 검증
const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10).max(50000),
  categoryId: z.string().uuid(),
})

// HTML sanitization
function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a'],
    ALLOWED_ATTR: ['href', 'target'],
  })
}
```

### 2. 인증 (NextAuth.js)

```typescript
// lib/auth.ts
import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from './db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30일
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
})

// Middleware로 보호된 라우트 설정
// middleware.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isOnProtectedRoute = req.nextUrl.pathname.startsWith('/dashboard')

  if (isOnProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

### 3. CSRF 보호

NextAuth.js는 자동으로 CSRF 토큰 검증을 제공합니다.

### 4. 환경 변수 관리

```bash
# .env.local (절대 커밋 금지)
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..." # 최소 32자
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
NBA_API_KEY="..."

# .env.example (커밋 가능)
DATABASE_URL="postgresql://user:password@localhost:5432/db"
NEXTAUTH_SECRET="your-secret-here-min-32-chars"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

---

## 커밋 메시지 형식

### Conventional Commits

```
type(scope): 한국어로 간결한 설명 (#이슈번호)

[선택] 상세 설명

[선택] Breaking Changes, Closes 등
```

### Type 종류

- **feat**: 새 기능 추가
- **fix**: 버그 수정
- **docs**: 문서 수정
- **style**: 코드 포맷팅 (기능 변경 없음)
- **refactor**: 코드 리팩토링
- **test**: 테스트 추가/수정
- **chore**: 빌드 설정, 패키지 관리 등
- **perf**: 성능 개선

### 예시

```bash
feat(auth): 구글 소셜 로그인 추가 (#42)

NextAuth.js를 사용하여 구글 OAuth 로그인 구현
- 세션 관리를 JWT로 설정
- 만료 시간 30일로 연장

Closes #42

---

fix(api): 경기 일정 API 시간대 오류 수정 (#78)

서버 시간대(UTC)를 한국 시간(KST)으로 변환하지 않아 발생한 문제 해결

---

perf(components): GameList 컴포넌트에 가상 스크롤 적용

react-window를 사용하여 1000개 이상의 경기 목록도 부드럽게 렌더링

---

chore(deps): Next.js 15.2로 업그레이드

- 성능 개선 및 버그 수정
- App Router 안정성 향상
```

### Git Hooks (Husky)

```bash
# .husky/pre-commit
npm run lint-staged
npm run type-check

# .husky/commit-msg
npx commitlint --edit $1
```

---

## 배포 워크플로

### 3단계 배포 전략

1. **Preview** (자동) - PR 생성 시
2. **Staging** (수동) - main 브랜치 머지 후
3. **Production** (수동 승인) - Staging 테스트 후

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  pull_request:
  push:
    branches: [main]

jobs:
  preview:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: vercel/action@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  staging:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: vercel/action@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-args: '--prod'

  production:
    needs: staging
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: vercel/action@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-args: '--prod'
          vercel-project-id: ${{ secrets.VERCEL_PROD_PROJECT_ID }}
```

### Semantic Release

```json
// package.json
{
  "scripts": {
    "release": "semantic-release"
  },
  "release": {
    "branches": ["main"],
    "plugins": [
      "@semantic-release/commit-analyzer",
      "@semantic-release/release-notes-generator",
      "@semantic-release/changelog",
      "@semantic-release/npm",
      "@semantic-release/github"
    ]
  }
}
```

---

## 📚 참고 자료

- [Next.js 15 문서](https://nextjs.org/docs)
- [React 19 문서](https://react.dev)
- [TypeScript 5.9 핸드북](https://www.typescriptlang.org/docs/)
- [Tailwind CSS 4 문서](https://tailwindcss.com/docs)
- [Prisma 문서](https://www.prisma.io/docs)
- [Vitest 문서](https://vitest.dev)
- [Playwright 문서](https://playwright.dev)

---

**마지막 업데이트:** 2025년 10월
**관리자:** MAVS.KR 개발팀
**버전:** 2.0.0
