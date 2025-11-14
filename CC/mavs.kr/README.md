# MAVS.KR - 달라스 매버릭스 한국 팬 커뮤니티

달라스 매버릭스의 최신 뉴스, 경기 정보, 선수 통계, 그리고 팬 커뮤니티를 제공하는 웹사이트입니다.

## 🚀 주요 기능

- **📰 실시간 뉴스**: ESPN, Reddit, The Smoking Cuban 등 다양한 소스에서 뉴스를 수집하고 한국어로 번역
- **🎯 ScrambleText 효과**: 인터랙티브한 텍스트 애니메이션으로 시각적 임팩트 제공
- **🏀 실시간 경기**: 라이브 스코어, 경기 일정, 선수 통계를 실시간으로 업데이트
- **👥 선수 정보**: 루카 돈치치, 키리 어빙 등 선수들의 상세한 통계와 정보
- **💬 커뮤니티**: 팬들과의 소통을 위한 포럼 및 게임 스레드
- **🔄 자동 업데이트**: 크론잡을 통한 정기적인 뉴스 및 경기 정보 업데이트
- **🌐 다국어 지원**: 영어 뉴스를 한국어로 자동 번역

## 🛠️ 기술 스택

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: NextAuth.js
- **Caching**: Redis, Next.js Cache
- **Queue**: Bull/BullMQ
- **Web Scraping**: Cheerio, Puppeteer
- **Translation**: Google Translate API, DeepL API
- **External APIs**: ESPN API, Reddit API, NewsAPI
- **Deployment**: Vercel
- **Cron Jobs**: Vercel Cron

## 📦 설치 및 실행

### 🚀 새 PC에서 처음 시작하는 경우

**자동 설치 스크립트 사용** (권장):

```bash
# macOS/Linux
bash setup.sh

# Windows
setup.bat
```

또는 **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** 문서를 참조하세요. (상세한 단계별 가이드 포함)

---

### ⚡ 빠른 시작 (이미 개발 환경이 있는 경우)

### 1. 프로젝트 클론
```bash
git clone https://github.com/wonyoung-R/mavs.kr.git
cd mavs.kr
```

### 2. 의존성 설치
```bash
npm install
```

### 3. Docker 시작
```bash
docker-compose up -d
```

### 4. 환경 변수 설정
```bash
# .env.local 파일 생성 후 환경 변수 설정
cp .env.example .env.local  # (존재하는 경우)
# 또는 수동으로 .env.local 파일 생성
```

### 5. 데이터베이스 설정
```bash
# Prisma 클라이언트 생성
npm run db:generate

# 데이터베이스 마이그레이션
npm run db:push

# 시드 데이터 삽입 (선택사항)
npm run db:seed
```

### 6. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 📁 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # 루트 레이아웃
│   ├── page.tsx           # 홈페이지
│   └── api/               # API 라우트
├── components/            # React 컴포넌트
│   ├── layout/            # 레이아웃 컴포넌트
│   ├── ui/                # 재사용 가능한 UI 컴포넌트
│   ├── news/              # 뉴스 관련 컴포넌트
│   ├── games/             # 경기 관련 컴포넌트
│   └── forum/             # 포럼 관련 컴포넌트
├── lib/                   # 유틸리티 및 설정
│   ├── api/               # 외부 API 클라이언트
│   ├── crawler/           # 웹 크롤러
│   ├── db/                # 데이터베이스 설정
│   └── utils/             # 유틸리티 함수
├── hooks/                 # 커스텀 훅
├── stores/                # 상태 관리 (Zustand)
├── types/                 # TypeScript 타입 정의
└── styles/                # 스타일 파일
```

## 🔧 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm run start

# 린팅
npm run lint

# 타입 체크
npm run type-check

# 테스트 실행
npm run test

# 코드 포맷팅
npm run format

# 뉴스 크롤링 테스트
npm run crawl:news

# 경기 정보 업데이트 테스트
npm run update:games
```

## 🌐 API 엔드포인트

### 뉴스 API
- `GET /api/news/all` - 모든 소스의 뉴스 통합 조회
- `GET /api/news/espn` - ESPN 뉴스 조회
- `GET /api/news/reddit` - Reddit 게시글 조회
- `GET /api/news/smoking-cuban` - The Smoking Cuban 웹 스크래핑

### 번역 API
- `POST /api/translate` - 텍스트 번역 (영어 → 한국어)

### 크론잡 API
- `GET /api/cron/update-news` - 뉴스 업데이트 (10분마다 실행)
- `GET /api/cron/update-games` - 경기 정보 업데이트 (5분마다 실행)
- `POST /api/cron/crawl-news` - 뉴스 크롤링 (30분마다 실행)

## 🗄️ 데이터베이스 명령어

```bash
# Prisma 클라이언트 생성
npm run db:generate

# 데이터베이스 스키마 푸시
npm run db:push

# 마이그레이션 생성 및 적용
npm run db:migrate

# 시드 데이터 삽입
npm run db:seed
```

## 🌐 배포

### Vercel 배포
1. Vercel 계정에 GitHub 저장소 연결
2. 환경 변수 설정
3. 자동 배포 활성화

### 환경 변수
프로덕션 환경에서 다음 환경 변수들을 설정해야 합니다:

#### 필수 환경 변수
- `DATABASE_URL`: PostgreSQL 데이터베이스 URL
- `NEXTAUTH_SECRET`: NextAuth.js 시크릿 키
- `NEXTAUTH_URL`: 애플리케이션 URL

#### 뉴스 API 키 (선택사항)
- `NEWS_API_KEY`: NewsAPI 키
- `GOOGLE_TRANSLATE_API_KEY`: Google Translate API 키
- `DEEPL_API_KEY`: DeepL 번역 API 키
- `REDDIT_CLIENT_ID`: Reddit API 클라이언트 ID
- `REDDIT_CLIENT_SECRET`: Reddit API 클라이언트 시크릿

#### 캐싱 및 큐
- `REDIS_URL`: Redis 서버 URL
- `UPSTASH_REDIS_URL`: Upstash Redis URL
- `UPSTASH_REDIS_TOKEN`: Upstash Redis 토큰

#### 크론잡
- `CRON_SECRET`: 크론잡 인증을 위한 시크릿 키

#### 웹소켓
- `NEXT_PUBLIC_SOCKET_URL`: 웹소켓 서버 URL

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 연락처

프로젝트 링크: [https://github.com/your-username/mavs.kr](https://github.com/your-username/mavs.kr)

## 🙏 감사의 말

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Prisma](https://prisma.io/)
- [Vercel](https://vercel.com/)
