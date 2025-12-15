# 🚀 새 PC 세팅 가이드

포맷된 새로운 PC에서 mavs.kr 프로젝트를 처음부터 세팅하는 완벽한 가이드입니다.

---

## 📋 목차
1. [필수 소프트웨어 설치](#1-필수-소프트웨어-설치)
2. [프로젝트 클론](#2-프로젝트-클론)
3. [Node.js 의존성 설치](#3-nodejs-의존성-설치)
4. [Python 환경 설정](#4-python-환경-설정)
5. [Docker 환경 설정](#5-docker-환경-설정)
6. [환경 변수 설정](#6-환경-변수-설정)
7. [데이터베이스 설정](#7-데이터베이스-설정)
8. [개발 서버 실행](#8-개발-서버-실행)
9. [문제 해결](#9-문제-해결)

---

## 1. 필수 소프트웨어 설치

### 1.1 Git 설치
```bash
# macOS
brew install git

# Windows
# https://git-scm.com/download/win 에서 다운로드
```

### 1.2 Node.js 설치 (v20 이상 권장)
```bash
# macOS - Homebrew 사용
brew install node

# 또는 nvm 사용 (권장)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Windows
# https://nodejs.org/ 에서 LTS 버전 다운로드
```

버전 확인:
```bash
node --version  # v20.x.x 이상
npm --version   # v10.x.x 이상
```

### 1.3 Python 설치 (v3.8 이상)
```bash
# macOS
brew install python@3.13

# Windows
# https://www.python.org/downloads/ 에서 다운로드
```

버전 확인:
```bash
python3 --version  # Python 3.8 이상
```

### 1.4 Docker 설치
```bash
# macOS
brew install --cask docker

# Windows
# https://www.docker.com/products/docker-desktop 에서 다운로드
```

Docker 실행 후 확인:
```bash
docker --version
docker-compose --version
```

### 1.5 VSCode 설치 (선택사항)
```bash
# macOS
brew install --cask visual-studio-code

# Windows
# https://code.visualstudio.com/ 에서 다운로드
```

---

## 2. 프로젝트 클론

### 2.1 Git 설정
```bash
# Git 사용자 정보 설정
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 2.2 GitHub 인증 설정
```bash
# SSH 키 생성 (GitHub 인증용)
ssh-keygen -t ed25519 -C "your.email@example.com"

# SSH 키를 GitHub에 추가
cat ~/.ssh/id_ed25519.pub
# 출력된 키를 복사하여 GitHub Settings > SSH and GPG keys에 추가
```

### 2.3 프로젝트 클론
```bash
# 프로젝트를 저장할 디렉토리로 이동
cd ~/Projects  # 또는 원하는 경로

# 저장소 클론
git clone git@github.com:wonyoung-R/mavs.kr.git
cd mavs.kr
```

---

## 3. Node.js 의존성 설치

### 3.1 npm 패키지 설치
```bash
# 프로젝트 루트에서 실행
npm install
```

이 명령어는 `package.json`에 정의된 모든 의존성을 설치합니다.

**예상 소요 시간**: 2-5분

---

## 4. Python 환경 설정

### 4.1 가상환경 생성
```bash
# Python 가상환경 생성
python3 -m venv venv

# 가상환경 활성화
# macOS/Linux
source venv/bin/activate

# Windows
# venv\Scripts\activate
```

### 4.2 Python 패키지 설치
```bash
# requirements.txt의 패키지 설치
pip install -r requirements.txt
```

### 4.3 설치 확인
```bash
pip list
# nba_api, requests, numpy, pandas 등이 보여야 함
```

---

## 5. Docker 환경 설정

### 5.1 Docker 컨테이너 시작
```bash
# Docker Desktop이 실행 중인지 확인

# PostgreSQL과 Redis 컨테이너 시작
docker-compose up -d
```

### 5.2 컨테이너 상태 확인
```bash
docker-compose ps

# 출력 예시:
# NAME                COMMAND                  SERVICE             STATUS
# mavs-kr-db-1        "docker-entrypoint.s…"   db                  running
# mavs-kr-redis-1     "docker-entrypoint.s…"   redis               running
```

### 5.3 로그 확인 (문제 발생 시)
```bash
docker-compose logs db
docker-compose logs redis
```

---

## 6. 환경 변수 설정

### 6.1 .env.local 파일 생성
```bash
# 프로젝트 루트에 .env.local 파일 생성
touch .env.local
```

### 6.2 환경 변수 설정
`.env.local` 파일을 열고 다음 내용을 추가합니다:

```bash
# 데이터베이스
DATABASE_URL="postgresql://admin:password@localhost:5432/mavs_kr"

# NextAuth (인증)
NEXTAUTH_SECRET="your-super-secret-key-change-this-in-production"
NEXTAUTH_URL="http://localhost:3000"

# Redis
REDIS_URL="redis://localhost:6379"

# 크론잡 (선택사항)
CRON_SECRET="your-cron-secret-key"

# Google Translate API (선택사항)
GOOGLE_TRANSLATE_API_KEY="your-google-translate-api-key"

# DeepL API (선택사항)
DEEPL_API_KEY="your-deepl-api-key"

# Gemini API (선택사항)
GEMINI_API_KEY="your-gemini-api-key"

# Reddit API (선택사항)
REDDIT_CLIENT_ID="your-reddit-client-id"
REDDIT_CLIENT_SECRET="your-reddit-client-secret"

# News API (선택사항)
NEWS_API_KEY="your-news-api-key"

# Supabase (선택사항)
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

### 6.3 시크릿 키 생성
```bash
# NEXTAUTH_SECRET 생성
openssl rand -base64 32

# CRON_SECRET 생성
openssl rand -base64 32
```

### 6.4 필수 vs 선택사항
**필수 환경 변수** (최소 동작):
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

**선택사항** (전체 기능 사용):
- API 키들은 해당 기능을 사용할 때만 필요합니다
- 없어도 기본적인 개발은 가능합니다

---

## 7. 데이터베이스 설정

### 7.1 Prisma 클라이언트 생성
```bash
npm run db:generate
```

### 7.2 데이터베이스 마이그레이션
```bash
# 개발 환경 마이그레이션
npm run db:migrate

# 또는 스키마만 푸시
npm run db:push
```

### 7.3 시드 데이터 삽입 (선택사항)
```bash
npm run db:seed
```

### 7.4 데이터베이스 연결 확인
```bash
# PostgreSQL에 직접 연결 (선택사항)
docker exec -it mavs-kr-db-1 psql -U admin -d mavs_kr

# 테이블 확인
\dt

# 종료
\q
```

---

## 8. 개발 서버 실행

### 8.1 개발 서버 시작
```bash
npm run dev
```

### 8.2 브라우저에서 확인
브라우저에서 다음 주소로 접속:
- **메인 페이지**: http://localhost:3000
- **뉴스 페이지**: http://localhost:3000/news
- **경기 페이지**: http://localhost:3000/games
- **포럼 페이지**: http://localhost:3000/forum

### 8.3 API 테스트
```bash
# 별도 터미널에서 테스트
curl http://localhost:3000/api/news/all
```

---

## 9. 문제 해결

### 9.1 포트 충돌
**에러**: `Port 3000 is already in use`

**해결책**:
```bash
# 포트를 사용 중인 프로세스 종료
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### 9.2 Docker 연결 실패
**에러**: `Can't reach database server`

**해결책**:
```bash
# Docker 컨테이너 재시작
docker-compose down
docker-compose up -d

# 헬스체크 확인
docker-compose ps
```

### 9.3 Prisma 에러
**에러**: `@prisma/client did not initialize yet`

**해결책**:
```bash
# Prisma 클라이언트 재생성
npm run db:generate

# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```

### 9.4 Python 패키지 에러
**에러**: `ModuleNotFoundError: No module named 'nba_api'`

**해결책**:
```bash
# 가상환경 활성화 확인
source venv/bin/activate

# 패키지 재설치
pip install -r requirements.txt
```

### 9.5 npm 설치 에러
**에러**: `gyp ERR!` 또는 네이티브 모듈 빌드 에러

**해결책**:
```bash
# macOS - Xcode Command Line Tools 설치
xcode-select --install

# Windows - Visual Studio Build Tools 설치
# https://visualstudio.microsoft.com/downloads/
```

---

## 🎯 빠른 시작 체크리스트

1. ✅ Git, Node.js, Python, Docker 설치
2. ✅ 프로젝트 클론
3. ✅ `npm install` 실행
4. ✅ Python 가상환경 생성 및 패키지 설치
5. ✅ `docker-compose up -d` 실행
6. ✅ `.env.local` 파일 생성 및 환경 변수 설정
7. ✅ `npm run db:generate` 실행
8. ✅ `npm run db:migrate` 실행
9. ✅ `npm run dev` 실행
10. ✅ http://localhost:3000 접속

---

## 📞 추가 도움말

### 유용한 명령어
```bash
# 개발 서버 실행
npm run dev

# 타입 체크
npm run type-check

# 린팅
npm run lint

# 코드 포맷팅
npm run format

# 테스트
npm run test

# Docker 로그 확인
docker-compose logs -f

# Docker 중지
docker-compose down

# Docker 완전 삭제 (데이터 포함)
docker-compose down -v
```

### VSCode 추천 확장 프로그램
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Prisma
- GitLens
- Error Lens

### 개발 팁
- 환경 변수 변경 시 서버 재시작 필요
- `.env.local`은 Git에 커밋하지 않음 (보안상 중요)
- Docker 컨테이너는 항상 백그라운드에서 실행되어야 함
- API 키 없이도 기본 개발은 가능 (일부 기능 제한)

---

## 🔥 프로덕션 배포

Vercel에 배포하는 경우:
1. Vercel 계정 생성
2. GitHub 저장소 연결
3. 환경 변수 설정 (Vercel Dashboard)
4. 자동 배포 활성화

자세한 내용은 [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)를 참조하세요.

---

**마지막 업데이트**: 2025-11-14

