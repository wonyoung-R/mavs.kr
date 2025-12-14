# MAVS.KR API 문서

## 개요

MAVS.KR API는 댈러스 매버릭스 관련 데이터를 제공하는 RESTful API입니다. NBA API와 뉴스 크롤링을 통해 실시간 데이터를 제공합니다.

## 기본 정보

- **Base URL**: `https://mavs.kr/api`
- **인증**: Bearer Token (크론 작업용)
- **응답 형식**: JSON
- **Rate Limiting**: 15분당 100회 요청

## 인증

### 크론 작업 인증
크론 작업을 위한 API는 특별한 인증이 필요합니다:

```http
Authorization: Bearer YOUR_CRON_SECRET
```

## API 엔드포인트

### 1. 경기 정보

#### 실시간 경기 조회
```http
GET /games/live
```

**응답 예시:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "gameId": "NBA-12345",
      "homeTeam": "Dallas Mavericks",
      "awayTeam": "Los Angeles Lakers",
      "homeScore": 102,
      "awayScore": 98,
      "status": "LIVE",
      "scheduledAt": "2024-01-11T20:00:00Z",
      "quarter": 4,
      "timeRemaining": "2:35",
      "broadcasts": ["ESPN", "NBA TV"],
      "stats": {
        "homeTeam": {
          "points": 102,
          "fieldGoals": { "made": 38, "attempted": 85, "percentage": 44.7 }
        }
      }
    }
  ],
  "message": "Live games retrieved successfully"
}
```

#### 경기 일정 조회
```http
GET /games/schedule?days=7
```

**쿼리 파라미터:**
- `days` (optional): 조회할 일수 (기본값: 7)

**응답 예시:**
```json
{
  "success": true,
  "data": [
    {
      "id": "2",
      "gameId": "NBA-12346",
      "homeTeam": "Dallas Mavericks",
      "awayTeam": "Golden State Warriors",
      "status": "SCHEDULED",
      "scheduledAt": "2024-01-12T20:00:00Z"
    }
  ],
  "message": "Schedule retrieved successfully"
}
```

### 2. 뉴스 정보

#### 뉴스 조회
```http
GET /news/crawl?limit=10&source=ESPN
```

**쿼리 파라미터:**
- `limit` (optional): 조회할 뉴스 수 (기본값: 10)
- `source` (optional): 뉴스 소스 필터 (ESPN, MAVS_MONEYBALL, SMOKING_CUBAN)

**응답 예시:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "title": "Dončić, 시즌 10번째 트리플더블 달성 임박",
      "titleKr": "Dončić, 시즌 10번째 트리플더블 달성 임박",
      "content": "4쿼터 클러치 타임에서 결정적인 활약을 펼치며...",
      "contentKr": "4쿼터 클러치 타임에서 결정적인 활약을 펼치며...",
      "source": "ESPN",
      "sourceUrl": "https://espn.com/news/doncic-triple-double",
      "author": "Tim MacMahon",
      "imageUrl": "/images/doncic-triple-double.jpg",
      "publishedAt": "2024-01-11T18:00:00Z",
      "crawledAt": "2024-01-11T20:00:00Z",
      "viewCount": 1200
    }
  ],
  "message": "News retrieved successfully"
}
```

#### 뉴스 크롤링 (POST)
```http
POST /news/crawl
Authorization: Bearer YOUR_CRON_SECRET
```

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "crawled": 15,
    "saved": 12,
    "articles": [...]
  },
  "message": "News crawling completed successfully"
}
```

### 3. 크론 작업

#### 뉴스 크롤링 크론
```http
GET /cron/crawl-news
Authorization: Bearer YOUR_CRON_SECRET
```

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "crawled": 15,
    "saved": 12,
    "skipped": 3
  },
  "message": "Scheduled news crawl completed successfully"
}
```

#### 경기 업데이트 크론
```http
GET /cron/update-games
Authorization: Bearer YOUR_CRON_SECRET
```

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "gamesFound": 1,
    "updated": 1
  },
  "message": "Scheduled game update completed successfully"
}
```

## 에러 응답

### 일반적인 에러 형식
```json
{
  "success": false,
  "error": "Error type",
  "message": "Human readable error message"
}
```

### 에러 코드

| 상태 코드 | 에러 타입 | 설명 |
|-----------|-----------|------|
| 400 | Bad Request | 잘못된 요청 |
| 401 | Unauthorized | 인증 실패 |
| 403 | Forbidden | 접근 권한 없음 |
| 404 | Not Found | 리소스를 찾을 수 없음 |
| 429 | Too Many Requests | Rate limit 초과 |
| 500 | Internal Server Error | 서버 내부 오류 |

### Rate Limiting

API는 Rate Limiting을 적용합니다:

- **일반 API**: 15분당 100회 요청
- **크롤링 API**: 1시간당 10회 요청

Rate limit 초과 시 다음 헤더가 포함됩니다:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1641234567
Retry-After: 300
```

## 사용 예시

### JavaScript/TypeScript
```typescript
// 실시간 경기 조회
const response = await fetch('/api/games/live');
const data = await response.json();

if (data.success) {
  console.log('Live games:', data.data);
} else {
  console.error('Error:', data.message);
}

// 뉴스 조회
const newsResponse = await fetch('/api/news/crawl?limit=5&source=ESPN');
const newsData = await newsResponse.json();
```

### cURL
```bash
# 실시간 경기 조회
curl -X GET "https://mavs.kr/api/games/live"

# 뉴스 조회
curl -X GET "https://mavs.kr/api/news/crawl?limit=10"

# 크론 작업 실행
curl -X GET "https://mavs.kr/api/cron/crawl-news" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 데이터 모델

### Game
```typescript
interface Game {
  id: string;
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: GameStatus;
  scheduledAt: Date;
  quarter?: number;
  timeRemaining?: string;
  broadcasts: string[];
  stats?: GameStats;
  highlights: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### News
```typescript
interface News {
  id: string;
  title: string;
  titleKr?: string;
  content: string;
  contentKr?: string;
  summary?: string;
  source: NewsSource;
  sourceUrl: string;
  author?: string;
  imageUrl?: string;
  publishedAt: Date;
  crawledAt: Date;
  viewCount: number;
  tags: Tag[];
}
```

## 배포 및 모니터링

### 환경 변수
```bash
# 필수 환경 변수
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
DEEPL_API_KEY="your-deepl-key"
GOOGLE_TRANSLATE_API_KEY="your-google-key"
CRON_SECRET="your-cron-secret"

# 선택적 환경 변수
NBA_API_KEY="your-nba-key"
RATE_LIMIT_WINDOW_MS="900000"
RATE_LIMIT_MAX_REQUESTS="100"
```

### 크론 작업 설정
```bash
# Vercel Cron Jobs
# 30분마다 뉴스 크롤링
*/30 * * * * curl -X GET "https://mavs.kr/api/cron/crawl-news" \
  -H "Authorization: Bearer $CRON_SECRET"

# 5분마다 경기 업데이트
*/5 * * * * curl -X GET "https://mavs.kr/api/cron/update-games" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### 모니터링
- **성능**: 응답 시간 < 2초 목표
- **가용성**: 99.9% 업타임 목표
- **에러율**: < 1% 목표

## 지원

API 관련 문의사항이나 버그 리포트는 다음으로 연락해주세요:
- **이메일**: api-support@mavs.kr
- **GitHub**: https://github.com/mavs-kr/api-issues

---

**최종 업데이트**: 2024년 1월
**API 버전**: v1.0

