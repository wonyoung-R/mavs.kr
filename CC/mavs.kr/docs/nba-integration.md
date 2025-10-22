# NBA Box Score Integration

이 문서는 [nba_api](https://github.com/swar/nba_api.git)를 사용하여 실시간 NBA 박스스코어를 홈페이지에 통합하는 방법을 설명합니다.

## 🚀 기능

- **실시간 박스스코어**: 매일 업데이트되는 NBA 경기 결과
- **자동 새로고침**: 1분마다 자동 업데이트
- **매버릭스 하이라이트**: 매버릭스 경기 특별 표시
- **반응형 디자인**: 모바일/데스크톱 최적화
- **캐싱 시스템**: 성능 최적화를 위한 캐싱

## 📋 설치 요구사항

### Python 환경 설정

```bash
# Python 3.7+ 필요
python3 --version

# nba_api 설치
pip install nba_api requests numpy pandas

# 또는 requirements.txt 사용
pip install -r requirements.txt
```

### 환경 변수 설정

`.env.local` 파일에 다음 변수 추가:

```bash
# Cron 작업 보안을 위한 시크릿 키
CRON_SECRET=your-secret-key-here

# 기존 NBA API 키 (선택사항)
NBA_API_KEY=your-nba-api-key
```

## 🔧 설정

### 1. Python 스크립트 실행 권한

```bash
chmod +x scripts/nba_api_service.py
```

### 2. 테스트 실행

```bash
# 오늘의 경기 데이터 가져오기
python3 scripts/nba_api_service.py today

# 특정 경기 라이브 박스스코어 (game_id 필요)
python3 scripts/nba_api_service.py live 12345
```

### 3. API 엔드포인트 테스트

```bash
# 박스스코어 API 테스트
curl http://localhost:3000/api/nba/box-scores

# 강제 새로고침
curl http://localhost:3000/api/nba/box-scores?refresh=true
```

## 📊 데이터 구조

### GameSummary 인터페이스

```typescript
interface GameSummary {
  game_id: string;           // NBA 게임 ID
  home_team: string;          // 홈팀 이름
  away_team: string;         // 원정팀 이름
  home_score: number;        // 홈팀 점수
  away_score: number;        // 원정팀 점수
  status: number;            // 경기 상태 (1: 예정, 2: 진행중, 3: 종료)
  period: number;            // 현재 쿼터
  time_remaining: string;    // 남은 시간
  game_time_kst: string;     // 한국 시간
  game_date_kst: string;     // 한국 날짜
  is_mavs_game: boolean;     // 매버릭스 경기 여부
  is_live: boolean;          // 라이브 경기 여부
  is_finished: boolean;      // 종료된 경기 여부
  broadcast: string[];       // 방송사 목록
}
```

## 🎨 컴포넌트 사용법

### LiveBoxScoreBanner 컴포넌트

```tsx
import { LiveBoxScoreBanner } from '@/components/nba/LiveBoxScoreBanner';

export default function HomePage() {
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        {/* 메인 콘텐츠 */}
      </div>

      <div className="space-y-6">
        {/* 박스스코어 배너 */}
        <LiveBoxScoreBanner />

        {/* 기타 사이드바 콘텐츠 */}
      </div>
    </div>
  );
}
```

## ⚡ 성능 최적화

### 캐싱 전략

- **메모리 캐시**: 1분간 API 응답 캐싱
- **자동 새로고침**: 클라이언트에서 1분마다 업데이트
- **Vercel Cron**: 서버에서 5분마다 백그라운드 업데이트

### 에러 처리

- **Python 스크립트 실패**: 대체 데이터 표시
- **네트워크 오류**: 재시도 버튼 제공
- **API 제한**: 캐시된 데이터 사용

## 🔄 자동 업데이트

### Vercel Cron 설정

`vercel.json`에서 5분마다 자동 업데이트:

```json
{
  "crons": [
    {
      "path": "/api/cron/update-box-scores",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### 수동 업데이트

```bash
# Cron 작업 수동 실행
curl -X GET "https://your-domain.com/api/cron/update-box-scores" \
  -H "Authorization: Bearer your-cron-secret"
```

## 🐛 문제 해결

### 일반적인 문제

1. **Python 스크립트 실행 오류**
   ```bash
   # Python 경로 확인
   which python3

   # 권한 확인
   ls -la scripts/nba_api_service.py
   ```

2. **nba_api 설치 오류**
   ```bash
   # pip 업그레이드
   pip install --upgrade pip

   # 의존성 재설치
   pip install --force-reinstall nba_api
   ```

3. **API 응답 오류**
   - NBA.com 서버 상태 확인
   - 네트워크 연결 확인
   - API 제한 확인

### 로그 확인

```bash
# 개발 환경에서 로그 확인
npm run dev

# Vercel 로그 확인
vercel logs
```

## 📈 모니터링

### 성공 지표

- API 응답 시간 < 2초
- 캐시 히트율 > 80%
- 에러율 < 5%

### 알림 설정

- API 실패 시 Slack 알림
- 데이터 업데이트 실패 시 이메일 알림

## 🔒 보안

### API 보안

- Cron 작업에 인증 토큰 사용
- Rate limiting 적용
- 입력 검증 및 sanitization

### 데이터 보안

- 민감한 정보 로깅 금지
- API 키 환경 변수 관리
- HTTPS 강제 사용

## 📚 참고 자료

- [nba_api GitHub](https://github.com/swar/nba_api.git)
- [NBA.com API 문서](https://stats.nba.com/)
- [Vercel Cron 문서](https://vercel.com/docs/cron-jobs)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)

## 🤝 기여

버그 리포트나 기능 요청은 GitHub Issues를 통해 제출해주세요.

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.





