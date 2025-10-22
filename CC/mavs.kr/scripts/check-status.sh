#!/bin/bash

echo "🏀 MAVS.KR 프로젝트 상태 확인"
echo "================================"

# 프로젝트 정보
echo "📁 프로젝트 디렉토리: $(pwd)"
echo "📦 Node.js 버전: $(node --version)"
echo "📦 npm 버전: $(npm --version)"

# 의존성 확인
echo ""
echo "📋 설치된 주요 패키지:"
echo "- Next.js: $(npm list next --depth=0 2>/dev/null | grep next || echo 'Not found')"
echo "- React: $(npm list react --depth=0 2>/dev/null | grep react || echo 'Not found')"
echo "- TypeScript: $(npm list typescript --depth=0 2>/dev/null | grep typescript || echo 'Not found')"
echo "- Prisma: $(npm list prisma --depth=0 2>/dev/null | grep prisma || echo 'Not found')"

# 파일 구조 확인
echo ""
echo "📂 주요 디렉토리 구조:"
if [ -d "src" ]; then
  echo "✅ src/ 디렉토리 존재"
  echo "  - components/: $(ls -1 src/components 2>/dev/null | wc -l) 개 디렉토리"
  echo "  - lib/: $(ls -1 src/lib 2>/dev/null | wc -l) 개 디렉토리"
  echo "  - types/: $(ls -1 src/types 2>/dev/null | wc -l) 개 파일"
else
  echo "❌ src/ 디렉토리 없음"
fi

if [ -d "prisma" ]; then
  echo "✅ prisma/ 디렉토리 존재"
else
  echo "❌ prisma/ 디렉토리 없음"
fi

if [ -f ".env.example" ]; then
  echo "✅ .env.example 파일 존재"
else
  echo "❌ .env.example 파일 없음"
fi

if [ -f "DEVELOPMENT_GUIDE.md" ]; then
  echo "✅ DEVELOPMENT_GUIDE.md 파일 존재"
else
  echo "❌ DEVELOPMENT_GUIDE.md 파일 없음"
fi

# 스크립트 실행 가능 여부 확인
echo ""
echo "🔧 사용 가능한 npm 스크립트:"
npm run --silent 2>/dev/null | grep -E "^\s+" | head -10

# Docker 상태 확인
echo ""
echo "🐳 Docker 상태:"
if command -v docker &> /dev/null; then
  if docker ps &> /dev/null; then
    echo "✅ Docker 실행 중"
    if docker-compose ps 2>/dev/null | grep -q "Up"; then
      echo "✅ Docker Compose 서비스 실행 중"
    else
      echo "⚠️  Docker Compose 서비스가 실행되지 않음"
      echo "   실행하려면: docker-compose up -d"
    fi
  else
    echo "❌ Docker가 실행되지 않음"
  fi
else
  echo "❌ Docker가 설치되지 않음"
fi

echo ""
echo "🚀 다음 단계:"
echo "1. 환경 변수 설정: cp .env.example .env.local"
echo "2. 데이터베이스 시작: docker-compose up -d"
echo "3. 개발 서버 실행: npm run dev"
echo "4. 개발 가이드 확인: cat DEVELOPMENT_GUIDE.md"
