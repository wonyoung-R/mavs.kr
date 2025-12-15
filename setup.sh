#!/bin/bash

# mavs.kr 프로젝트 자동 세팅 스크립트 (macOS/Linux)
# 사용법: bash setup.sh

set -e  # 에러 발생 시 스크립트 중단

echo "🏀 MAVS.KR 프로젝트 세팅을 시작합니다..."
echo ""

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 함수: 성공 메시지
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# 함수: 경고 메시지
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 함수: 에러 메시지
error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. Node.js 확인
echo "📦 Step 1: Node.js 확인 중..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    success "Node.js 설치됨: $NODE_VERSION"
else
    error "Node.js가 설치되어 있지 않습니다."
    echo "  https://nodejs.org/ 에서 Node.js v20 이상을 설치해주세요."
    exit 1
fi
echo ""

# 2. Python 확인
echo "🐍 Step 2: Python 확인 중..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    success "Python 설치됨: $PYTHON_VERSION"
else
    error "Python3가 설치되어 있지 않습니다."
    echo "  https://www.python.org/downloads/ 에서 Python 3.8 이상을 설치해주세요."
    exit 1
fi
echo ""

# 3. Docker 확인
echo "🐳 Step 3: Docker 확인 중..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    success "Docker 설치됨: $DOCKER_VERSION"
else
    error "Docker가 설치되어 있지 않습니다."
    echo "  https://www.docker.com/products/docker-desktop 에서 Docker Desktop을 설치해주세요."
    exit 1
fi
echo ""

# 4. npm 패키지 설치
echo "📚 Step 4: npm 패키지 설치 중..."
if npm install; then
    success "npm 패키지 설치 완료"
else
    error "npm 패키지 설치 실패"
    exit 1
fi
echo ""

# 5. Python 가상환경 설정
echo "🔧 Step 5: Python 가상환경 설정 중..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    success "Python 가상환경 생성 완료"
else
    warning "Python 가상환경이 이미 존재합니다."
fi

# 가상환경 활성화 및 패키지 설치
source venv/bin/activate
if pip install -r requirements.txt; then
    success "Python 패키지 설치 완료"
else
    error "Python 패키지 설치 실패"
    exit 1
fi
echo ""

# 6. Docker 컨테이너 시작
echo "🚀 Step 6: Docker 컨테이너 시작 중..."
if docker-compose up -d; then
    success "Docker 컨테이너 시작 완료"
    sleep 3  # 컨테이너가 완전히 시작될 때까지 대기
else
    error "Docker 컨테이너 시작 실패"
    exit 1
fi
echo ""

# 7. .env.local 파일 확인
echo "🔐 Step 7: 환경 변수 파일 확인 중..."
if [ ! -f ".env.local" ]; then
    warning ".env.local 파일이 존재하지 않습니다. 기본 템플릿을 생성합니다..."
    cat > .env.local << 'EOF'
# 데이터베이스
DATABASE_URL="postgresql://admin:password@localhost:5432/mavs_kr"

# NextAuth
NEXTAUTH_SECRET="change-this-to-a-random-string-in-production"
NEXTAUTH_URL="http://localhost:3000"

# Redis
REDIS_URL="redis://localhost:6379"

# Cron Secret
CRON_SECRET="change-this-to-a-random-string"

# API Keys (선택사항 - 필요한 경우 추가)
# GOOGLE_TRANSLATE_API_KEY=""
# DEEPL_API_KEY=""
# GEMINI_API_KEY=""
# REDDIT_CLIENT_ID=""
# REDDIT_CLIENT_SECRET=""
# NEWS_API_KEY=""
EOF
    success ".env.local 파일 생성 완료"
    echo ""
    warning "⚠️  .env.local 파일을 열어서 시크릿 키를 변경해주세요!"
    echo "   시크릿 키 생성: openssl rand -base64 32"
else
    success ".env.local 파일이 이미 존재합니다."
fi
echo ""

# 8. Prisma 설정
echo "🗄️  Step 8: Prisma 클라이언트 생성 중..."
if npm run db:generate; then
    success "Prisma 클라이언트 생성 완료"
else
    error "Prisma 클라이언트 생성 실패"
    exit 1
fi
echo ""

# 9. 데이터베이스 마이그레이션
echo "🔄 Step 9: 데이터베이스 마이그레이션 중..."
if npm run db:push; then
    success "데이터베이스 마이그레이션 완료"
else
    error "데이터베이스 마이그레이션 실패"
    exit 1
fi
echo ""

# 10. 완료 메시지
echo ""
echo "🎉 ========================================="
echo "🎉  MAVS.KR 프로젝트 세팅 완료!"
echo "🎉 ========================================="
echo ""
echo "다음 명령어로 개발 서버를 시작하세요:"
echo ""
echo "  ${GREEN}npm run dev${NC}"
echo ""
echo "브라우저에서 다음 주소로 접속하세요:"
echo "  ${GREEN}http://localhost:3000${NC}"
echo ""
echo "추가 명령어:"
echo "  - Docker 로그 확인:     ${YELLOW}docker-compose logs -f${NC}"
echo "  - Docker 중지:          ${YELLOW}docker-compose down${NC}"
echo "  - 타입 체크:            ${YELLOW}npm run type-check${NC}"
echo "  - 테스트:               ${YELLOW}npm run test${NC}"
echo ""
echo "문제가 발생하면 SETUP_GUIDE.md를 참조하세요."
echo ""

