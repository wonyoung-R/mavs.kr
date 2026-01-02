# MAVS.KR 개발 가이드

## 🚀 Quick Start

```bash
# 1. 프로젝트 클론 및 설치
git clone [repository-url]
cd mavs-kr
npm install

# 2. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일 편집하여 API 키 입력

# 3. 데이터베이스 설정
docker-compose up -d db redis
npx prisma migrate dev
npx prisma db seed

# 4. 개발 서버 실행
npm run dev
```

## 📝 Cursor AI 프롬프트 템플릿

### 1. 컴포넌트 생성

```
Create a TypeScript React component called [ComponentName] that:
- Uses Tailwind CSS for styling with dark mode support
- Implements Framer Motion animations for entrance/exit
- Is fully typed with TypeScript interfaces
- Uses Mavs team colors (navy: #002B5E, silver: #C4CED4, blue: #00538C)
- Includes loading and error states
- Is responsive for mobile/tablet/desktop
```

### 2. API 라우트 생성

```
Create a Next.js 14 API route at /api/[endpoint] that:
- Uses App Router route handlers
- Implements proper TypeScript types
- Includes error handling with try-catch
- Validates request data with Zod
- Uses Prisma for database operations
- Returns appropriate HTTP status codes
- Implements rate limiting middleware
```

### 3. 크롤러 구현

```
Create a web crawler function for [website] that:
- Uses Cheerio for HTML parsing
- Implements retry logic with exponential backoff
- Handles errors gracefully
- Returns structured data matching our News type
- Includes user-agent headers
- Respects robots.txt
- Has configurable delays between requests
```

### 4. 데이터베이스 쿼리

```
Create a Prisma query function that:
- Uses proper TypeScript return types
- Implements pagination with cursor-based approach
- Includes necessary relations
- Uses transactions for multiple operations
- Has proper error handling
- Implements caching with Redis
```

## 💻 핵심 코드 예시

### WebSocket Hook 구현

```typescript
// src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { useNotificationStore } from '@/stores/notificationStore';

export function useWebSocket() {
  const socket = useRef<Socket | null>(null);
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    socket.current = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      transports: ['websocket'],
    });

    socket.current.on('connect', () => {
      console.log('WebSocket 연결됨');
    });

    socket.current.on('notification', (data) => {
      addNotification(data);
    });

    return () => {
      socket.current?.disconnect();
    };
  }, []);

  const subscribe = useCallback((event: string, handler: Function) => {
    socket.current?.on(event, handler as any);
  }, []);

  const unsubscribe = useCallback((event: string, handler: Function) => {
    socket.current?.off(event, handler as any);
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socket.current?.emit(event, data);
  }, []);

  return { subscribe, unsubscribe, emit };
}
```

### 뉴스 크롤러 예시 (ESPN)

```typescript
// src/lib/crawler/espn-crawler.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { News } from '@/types/news';
import { delay } from '@/lib/utils/delay';

const ESPN_BASE_URL = 'https://www.espn.com';
const MAVS_URL = `${ESPN_BASE_URL}/nba/team/_/name/dal/dallas-mavericks`;

export async function crawlESPN(): Promise<Partial<News>[]> {
  try {
    const response = await axios.get(MAVS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MAVS.KR Bot/1.0)',
      },
    });

    const $ = cheerio.load(response.data);
    const articles: Partial<News>[] = [];

    $('.contentItem__content').each((index, element) => {
      const $el = $(element);

      const title = $el.find('.contentItem__title').text().trim();
      const link = $el.find('a').attr('href');
      const summary = $el.find('.contentItem__subhead').text().trim();
      const imageUrl = $el.find('img').attr('data-src');
      const timestamp = $el.find('.timestamp').attr('data-date');

      if (title && link) {
        articles.push({
          title,
          sourceUrl: link.startsWith('http') ? link : `${ESPN_BASE_URL}${link}`,
          summary,
          imageUrl,
          source: 'ESPN',
          publishedAt: timestamp ? new Date(timestamp) : new Date(),
        });
      }

      // 각 요청 사이 지연
      if (index < 10) {
        await delay(1000);
      }
    });

    // 상세 내용 크롤링
    for (const article of articles.slice(0, 5)) {
      try {
        const contentResponse = await axios.get(article.sourceUrl!);
        const content$ = cheerio.load(contentResponse.data);

        article.content = content$('.article-body').text().trim();
        article.author = content$('.author').text().trim();

        await delay(2000); // 상세 페이지 크롤링 시 더 긴 지연
      } catch (error) {
        console.error(`Failed to crawl article content: ${article.sourceUrl}`);
      }
    }

    return articles;
  } catch (error) {
    console.error('ESPN 크롤링 실패:', error);
    return [];
  }
}
```

### 번역 유틸리티

```typescript
// src/lib/utils/translation.ts
import { Translate } from '@google-cloud/translate/build/src/v2';

const translate = new Translate({
  key: process.env.GOOGLE_TRANSLATE_API_KEY,
});

export async function translateContent(
  text: string,
  targetLang: string = 'ko'
): Promise<string> {
  try {
    // 텍스트 길이 제한 (Google Translate API 제한)
    const MAX_LENGTH = 5000;

    if (text.length <= MAX_LENGTH) {
      const [translation] = await translate.translate(text, targetLang);
      return translation;
    }

    // 긴 텍스트는 분할하여 번역
    const chunks = [];
    for (let i = 0; i < text.length; i += MAX_LENGTH) {
      chunks.push(text.slice(i, i + MAX_LENGTH));
    }

    const translations = await Promise.all(
      chunks.map(chunk => translate.translate(chunk, targetLang))
    );

    return translations.map(([t]) => t).join(' ');
  } catch (error) {
    console.error('번역 실패:', error);
    return text; // 실패 시 원본 반환
  }
}

// DeepL 대안 (더 나은 품질)
import * as deepl from 'deepl-node';

const translator = new deepl.Translator(process.env.DEEPL_API_KEY!);

export async function translateWithDeepL(
  text: string,
  targetLang: deepl.TargetLanguageCode = 'ko'
): Promise<string> {
  try {
    const result = await translator.translateText(
      text,
      null,
      targetLang
    );
    return result.text;
  } catch (error) {
    console.error('DeepL 번역 실패:', error);
    return translateContent(text); // Google Translate로 폴백
  }
}
```

### Zustand Store 예시

```typescript
// src/stores/gameStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Game } from '@/types/game';

interface GameStore {
  currentGame: Game | null;
  upcomingGames: Game[];
  recentGames: Game[];
  isLoading: boolean;

  setCurrentGame: (game: Game | null) => void;
  setUpcomingGames: (games: Game[]) => void;
  fetchGames: () => Promise<void>;
}

export const useGameStore = create<GameStore>()(
  devtools(
    persist(
      (set) => ({
        currentGame: null,
        upcomingGames: [],
        recentGames: [],
        isLoading: false,

        setCurrentGame: (game) => set({ currentGame: game }),

        setUpcomingGames: (games) => set({ upcomingGames: games }),

        fetchGames: async () => {
          set({ isLoading: true });
          try {
            const response = await fetch('/api/games/schedule');
            const data = await response.json();

            set({
              upcomingGames: data.upcoming,
              recentGames: data.recent,
              currentGame: data.live || null,
            });
          } catch (error) {
            console.error('Failed to fetch games:', error);
          } finally {
            set({ isLoading: false });
          }
        },
      }),
      {
        name: 'game-storage',
      }
    )
  )
);
```

## 🎨 UI/UX 컴포넌트 가이드

### 인터랙티브 카드 컴포넌트

```typescript
// src/components/ui/InteractiveCard.tsx
'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface InteractiveCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function InteractiveCard({
  children,
  className = '',
  onClick
}: InteractiveCardProps) {
  return (
    <motion.div
      className={`
        relative bg-gradient-to-br from-gray-900 to-gray-800
        rounded-xl overflow-hidden cursor-pointer
        ${className}
      `}
      whileHover={{ scale: 1.02, y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* 홀로그램 효과 */}
      <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />

      {/* 테두리 글로우 효과 */}
      <div className="absolute inset-0 rounded-xl ring-1 ring-blue-500/20 hover:ring-blue-500/40 transition-all duration-300" />

      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
```

### 3D 농구공 로딩 애니메이션

```typescript
// src/components/ui/BasketballLoader.tsx
'use client';

import { Canvas } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

function Basketball() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta;
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial
        color="#EE6730"
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
}

export function BasketballLoader() {
  return (
    <div className="w-32 h-32">
      <Canvas>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <Basketball />
      </Canvas>
      <p className="text-center mt-4 text-gray-400 animate-pulse">
        로딩 중...
      </p>
    </div>
  );
}
```

## 🔧 개발 도구 설정

### VSCode 설정 (`.vscode/settings.json`)

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

### 테스트 설정

```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
  ],
};
```

## 📊 성능 최적화 체크리스트

- [ ] Next.js Image 컴포넌트 사용
- [ ] 동적 import로 코드 스플리팅
- [ ] React.memo로 불필요한 리렌더링 방지
- [ ] useMemo, useCallback 적절히 사용
- [ ] 가상 스크롤링 구현 (긴 리스트)
- [ ] API 응답 캐싱 (Redis)
- [ ] 이미지 최적화 (WebP, AVIF)
- [ ] 폰트 최적화 (next/font)
- [ ] 번들 사이즈 분석 (next-bundle-analyzer)
- [ ] Lighthouse 점수 90+ 목표

## 🚢 배포 체크리스트

### 배포 전 확인사항

- [ ] 환경 변수 설정 완료
- [ ] 데이터베이스 마이그레이션 실행
- [ ] Redis 연결 확인
- [ ] 모든 테스트 통과
- [ ] 빌드 에러 없음
- [ ] SEO 메타 태그 설정
- [ ] 로봇.txt, 사이트맵 생성
- [ ] 에러 모니터링 설정 (Sentry)
- [ ] 애널리틱스 설정 (GA4)
- [ ] HTTPS 설정
- [ ] 도메인 연결

### Vercel 배포 명령어

```bash
# 프로덕션 배포
vercel --prod

# 스테이징 배포
vercel

# 환경 변수 설정
vercel env add DATABASE_URL
vercel env add REDIS_URL
# ... 기타 환경 변수
```

## 📱 PWA (Progressive Web App) 설정

MAVS.KR은 PWA로 설정되어 있어 모바일에서 네이티브 앱처럼 사용할 수 있습니다.

### 주요 파일
- `public/manifest.json`: PWA 매니페스트 파일
- `public/sw.js`: Service Worker (오프라인 지원)
- `public/icons/`: PWA 아이콘 (192x192, 512x512)
- `src/components/layout/ServiceWorkerRegistration.tsx`: Service Worker 등록 컴포넌트

### 아이콘 재생성
```bash
npm run generate:icons
```

### 테스트 방법
1. 개발 서버 실행 후 브라우저 개발자 도구 > Application > Manifest 확인
2. 모바일에서 "홈 화면에 추가" 기능 테스트
3. Lighthouse로 PWA 점수 확인

자세한 내용은 **[PWA_GUIDE.md](./PWA_GUIDE.md)** 문서를 참조하세요.

## 📈 모니터링 및 분석

### Sentry 설정

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
  ],
});
```

### Google Analytics 설정

```typescript
// src/app/layout.tsx
import { GoogleAnalytics } from '@next/third-parties/google'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <GoogleAnalytics gaId="G-XXXXXXXXXX" />
      </body>
    </html>
  );
}
```

## 🤝 팀 협업 가이드

### Git 브랜치 전략

```
main (production)
├── develop (staging)
│   ├── feature/news-crawler
│   ├── feature/live-game
│   └── feature/forum
└── hotfix/critical-bug
```

### 코드 리뷰 체크리스트

- [ ] TypeScript 타입 정의 적절함
- [ ] 에러 핸들링 구현됨
- [ ] 테스트 작성됨
- [ ] 성능 최적화 고려됨
- [ ] 접근성 고려됨
- [ ] 반응형 디자인 구현됨
- [ ] 코드 주석 적절함
- [ ] 보안 이슈 없음

## 📞 문제 해결 가이드

### 자주 발생하는 문제들

1. **Prisma 에러**: `npx prisma generate` 실행
2. **TypeScript 에러**: `npm run type-check` 실행
3. **빌드 실패**: `.next` 폴더 삭제 후 재빌드
4. **Redis 연결 실패**: Docker 컨테이너 상태 확인
5. **번역 API 한도**: 캐싱 구현 확인

## 🎯 마일스톤

### Phase 1 (MVP) ✅
- 기본 뉴스 크롤링
- 사용자 인증
- 기본 UI/UX

### Phase 2 (Beta) 🚧
- 실시간 경기 추적
- 포럼 기능
- 번역 최적화

### Phase 3 (Launch) 📅
- 성능 최적화
- 모바일 앱
- 수익화 기능

---

**Last Updated**: 2024.01
**Maintainer**: MAVS.KR Development Team
