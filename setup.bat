@echo off
REM mavs.kr 프로젝트 자동 세팅 스크립트 (Windows)
REM 사용법: setup.bat

echo ============================================
echo 🏀 MAVS.KR 프로젝트 세팅을 시작합니다...
echo ============================================
echo.

REM 1. Node.js 확인
echo 📦 Step 1: Node.js 확인 중...
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js 설치됨: %NODE_VERSION%
) else (
    echo ❌ Node.js가 설치되어 있지 않습니다.
    echo    https://nodejs.org/ 에서 Node.js v20 이상을 설치해주세요.
    pause
    exit /b 1
)
echo.

REM 2. Python 확인
echo 🐍 Step 2: Python 확인 중...
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
    echo ✅ Python 설치됨: %PYTHON_VERSION%
) else (
    echo ❌ Python이 설치되어 있지 않습니다.
    echo    https://www.python.org/downloads/ 에서 Python 3.8 이상을 설치해주세요.
    pause
    exit /b 1
)
echo.

REM 3. Docker 확인
echo 🐳 Step 3: Docker 확인 중...
where docker >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('docker --version') do set DOCKER_VERSION=%%i
    echo ✅ Docker 설치됨: %DOCKER_VERSION%
) else (
    echo ❌ Docker가 설치되어 있지 않습니다.
    echo    https://www.docker.com/products/docker-desktop 에서 Docker Desktop을 설치해주세요.
    pause
    exit /b 1
)
echo.

REM 4. npm 패키지 설치
echo 📚 Step 4: npm 패키지 설치 중...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm 패키지 설치 실패
    pause
    exit /b 1
)
echo ✅ npm 패키지 설치 완료
echo.

REM 5. Python 가상환경 설정
echo 🔧 Step 5: Python 가상환경 설정 중...
if not exist "venv" (
    python -m venv venv
    echo ✅ Python 가상환경 생성 완료
) else (
    echo ⚠️  Python 가상환경이 이미 존재합니다.
)

REM 가상환경 활성화 및 패키지 설치
call venv\Scripts\activate.bat
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Python 패키지 설치 실패
    pause
    exit /b 1
)
echo ✅ Python 패키지 설치 완료
echo.

REM 6. Docker 컨테이너 시작
echo 🚀 Step 6: Docker 컨테이너 시작 중...
docker-compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker 컨테이너 시작 실패
    pause
    exit /b 1
)
echo ✅ Docker 컨테이너 시작 완료
timeout /t 3 /nobreak >nul
echo.

REM 7. .env.local 파일 확인
echo 🔐 Step 7: 환경 변수 파일 확인 중...
if not exist ".env.local" (
    echo ⚠️  .env.local 파일이 존재하지 않습니다. 기본 템플릿을 생성합니다...
    (
        echo # 데이터베이스
        echo DATABASE_URL="postgresql://admin:password@localhost:5432/mavs_kr"
        echo.
        echo # NextAuth
        echo NEXTAUTH_SECRET="change-this-to-a-random-string-in-production"
        echo NEXTAUTH_URL="http://localhost:3000"
        echo.
        echo # Redis
        echo REDIS_URL="redis://localhost:6379"
        echo.
        echo # Cron Secret
        echo CRON_SECRET="change-this-to-a-random-string"
        echo.
        echo # API Keys ^(선택사항 - 필요한 경우 추가^)
        echo # GOOGLE_TRANSLATE_API_KEY=""
        echo # DEEPL_API_KEY=""
        echo # GEMINI_API_KEY=""
        echo # REDDIT_CLIENT_ID=""
        echo # REDDIT_CLIENT_SECRET=""
        echo # NEWS_API_KEY=""
    ) > .env.local
    echo ✅ .env.local 파일 생성 완료
    echo.
    echo ⚠️  .env.local 파일을 열어서 시크릿 키를 변경해주세요!
) else (
    echo ✅ .env.local 파일이 이미 존재합니다.
)
echo.

REM 8. Prisma 설정
echo 🗄️  Step 8: Prisma 클라이언트 생성 중...
call npm run db:generate
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Prisma 클라이언트 생성 실패
    pause
    exit /b 1
)
echo ✅ Prisma 클라이언트 생성 완료
echo.

REM 9. 데이터베이스 마이그레이션
echo 🔄 Step 9: 데이터베이스 마이그레이션 중...
call npm run db:push
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 데이터베이스 마이그레이션 실패
    pause
    exit /b 1
)
echo ✅ 데이터베이스 마이그레이션 완료
echo.

REM 10. 완료 메시지
echo.
echo =========================================
echo 🎉  MAVS.KR 프로젝트 세팅 완료!
echo =========================================
echo.
echo 다음 명령어로 개발 서버를 시작하세요:
echo.
echo   npm run dev
echo.
echo 브라우저에서 다음 주소로 접속하세요:
echo   http://localhost:3000
echo.
echo 추가 명령어:
echo   - Docker 로그 확인:     docker-compose logs -f
echo   - Docker 중지:          docker-compose down
echo   - 타입 체크:            npm run type-check
echo   - 테스트:               npm run test
echo.
echo 문제가 발생하면 SETUP_GUIDE.md를 참조하세요.
echo.
pause

