# MAVS.KR Ruby 공개 조회 서버

Ruby 3.4 / Rails 8.1.4 기반의 공개 기록·게시글 조회 서버다. 기존 URL과 기록의 의미를 보존하면서 서버에서 HTML을 생성한다. 전환 결정과 SEO 정책은 [ADR 001](../docs/architecture/001-ruby-seo-migration.md)에 정리했다.

## 현재 단계

2026-10-07 기준, 공개 조회 Ruby 구현과 로컬 데이터 복사·HTTP 검증, Jev 자연어 검색 연결을 완료했다. 원본 Next 애플리케이션과 Supabase는 삭제하지 않았고, 운영 도메인을 Ruby로 전환하거나 Docker 이미지를 배포하지 않았다. **전체 사이트의 Ruby 전환 완료 상태는 아니다.**

| 범위 | 구현 경계 |
|---|---|
| 기록 10개 화면 | 홈·검색·시즌·선수 목록·선수 상세·순위·비교·역사·데이터 안내·경기 상세를 Rails ERB로 제공. 한국어 기본 URL과 `/en` 유지 |
| 기록 API | `/api/records/coverage`, `/api/records/scope`, `/api/records/query`. camelCase JSON 및 release 계약 유지 |
| 공개 게시글 | `/news`, `/comm`, `/column`, `/analysis` 목록과 뉴스·커뮤니티·칼럼·분석 상세를 서버 HTML로 제공 |
| 로그인·작성·관리·수집 | 로그인, 인증, 프로필, 글쓰기/편집, admin, 기존 API/cron, `/fan`은 `LEGACY_APP_ORIGIN`의 Next로 307 연결 |
| 검색 메타데이터 | 페이지별 title·description·canonical, 기록 한영 hreflang, JSON-LD, sitemap index 및 상세 URL sitemap 구현 |
| Supabase 전체 데이터 이관 | 전체 export와 독립 로컬 PostgreSQL 데이터 복사·일치 검증 완료. 운영 전환과 Auth 서비스 이관은 미완료 |

완료한 export는 **61개 테이블, 225,439행, 기록 release 2개와 3개 bucket의 공개 파일 53개**다. 로컬 복원에서 61개 테이블의 행 수·전체 행 내용 MD5와 53개 파일의 바이트·SHA-256이 모두 일치했고 FK 62개가 모두 validated 상태임을 확인했다. 운영 목적지 전환, 인증·저장소 서비스 설정과 계정 대응은 별도 완료 기준이다.

## 로컬 실행

Ruby 3.4, Bundler 2.6.9와 PostgreSQL 클라이언트 개발 라이브러리가 필요하다. `Gemfile.lock`이 Rails 8.1.4, pg 1.7.0, Nokogiri 1.19.4, Puma 8.0.2를 고정한다. `pg`와 `nokogiri`는 Gemfile에서 소스 빌드를 지정한다.

저장소 루트에서 `ruby/`로 이동한 뒤 실행한다. 이미 설치된 의존성을 확인하려면 `bundle check`를 사용한다. 다음은 의존성 설치가 승인된 환경에서의 준비 예시다.

```sh
cd ruby
bundle config set --local path "$HOME/.cache/mavs-ruby/bundle"
bundle install
```

Bundler 설정은 프로젝트의 `.bundle/config`에만 적용한다. 경로에 공백이 없는 캐시 디렉터리를 사용한다. 현재 개발 장비의 `rbenv 3.4.0`은 development ABI라 미리 빌드된 PG/Nokogiri 확장을 로드하지 못했고, 공백이 있는 번들 경로에서는 Nokogiri 빌드도 실패했다. 해당 장비의 프로젝트용 경로는 `/Users/grizrider/Library/Caches/mavs-ruby/bundle-3.4.0`이다. 일반 환경에서는 위의 사용자별 경로와 정식 Ruby 3.4 릴리스를 사용하면 된다. 다른 프로젝트의 공용 Bundler 설정을 바꾸지 않는다.

필요한 환경값을 `ruby/.env.local`에 설정한다. DB URL과 비밀값은 문서·Git·이미지에 넣지 않는다.

| 변수 | 용도 / 기본값 |
|---|---|
| `DATABASE_URL` | 조회 대상 PostgreSQL 연결 문자열. 공개 조회에는 필요한 테이블만 SELECT 가능한 계정 권장 |
| `SITE_URL` | canonical·sitemap의 외부 기준 주소. 기본 `https://www.mavs.kr` |
| `LEGACY_APP_ORIGIN` | 남아 있는 Next 기능의 주소. 로컬 기본 `http://127.0.0.1:3000` |
| `PORT` | Ruby 포트, 기본 `3002` |
| `BINDING` | 기본 `127.0.0.1`. 컨테이너는 `0.0.0.0` |
| `RAILS_ENV` | 로컬 `development`, 운영 `production` |
| `SECRET_KEY_BASE` | production에서 필수. 로컬 개발용 기본값을 운영에 사용하지 않음 |
| `RAILS_MAX_THREADS` | Puma 스레드 수, 기본 `4`. DB 풀은 현재 프로세스당 `2` |
| `JEV_KEY` | TypeSafe Jev API 서버용 키. 루트 `.env.local`의 값도 사용. 값은 클라이언트·로그·공유 URL에 포함하지 않음 |
| `JEV_MODEL` / `JEV_ENABLED` | 기본 `jev-1.13.0`. `JEV_ENABLED=false`면 외부 해석 중지, 기본 조건 검색은 유지 |
| `JEV_DAILY_REQUEST_LIMIT` / `JEV_DAILY_INPUT_LIMIT` | 기본 40회 / 250,000 예약 입력량. 각 요청의 UTF-8 바이트+2,048을 보수적으로 예약. 청구 토큰 실측값이 아님 |
| `JEV_BUDGET_PATH` | 기본 `ruby/tmp/private/jev-budget.json`. 운영에서는 같은 호스트의 모든 worker가 공유하는 영속 볼륨 경로 지정 |
| `TRUST_PROXY_SSL` | 신뢰하는 HTTPS 종료 프록시 뒤에서만 `1`. 기본은 비활성 |
| `MIGRATED_MEDIA_ROOT` | 검증한 미디어 export 디렉터리. 아래 manifest 설명 참고 |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | 기존 공개 Storage URL의 origin. manifest에 있는 파일의 URL을 로컬 `/media/…`로 바꿀 때 필요하며 앞 변수가 우선 |

우선순위는 **프로세스 환경변수 → `ruby/.env.local` → 저장소 루트 `.env.local`**다. 테스트 환경은 `.env.local`을 자동으로 읽지 않는다. Ruby 전용 DB를 확인할 때는 상위 `.env.local`의 Supabase 연결로 조용히 되돌아가지 않도록 Ruby용 값을 명확히 설정한다.

```sh
bundle exec puma -C config/puma.rb
```

`bin/dev`도 같은 Puma 설정을 실행한다. rbenv 사용 시 프로젝트 명령에 `RBENV_VERSION=3.4.0 rbenv exec`를 붙일 수 있다. 기본 로컬 주소는 `http://127.0.0.1:3002`, 기존 Next는 `http://127.0.0.1:3000`이다.

로컬 HTTP 확인 예시:

```sh
curl -i http://127.0.0.1:3002/up
curl -i 'http://127.0.0.1:3002/games/nba%3Agame%3A0022501193'
curl -i 'http://127.0.0.1:3002/en/seasons/2010/playoffs'
curl -i http://127.0.0.1:3002/sitemap.xml
```

`/up`은 서버 생존 확인이다. DB와 현재 공개 release 확인에는 기록 페이지·coverage API도 조회해야 한다. DB 연결 실패는 비어 있는 정상 페이지로 숨기지 않고 503으로 표시한다.

## 조회·캐시 계약

SQL은 매개변수화하고 `BEGIN READ ONLY` 안에서 실행한다. 기본 연결 대기와 풀 대기는 5초, SQL `statement_timeout`은 5초, 풀 크기는 프로세스당 2개다. 전체 HTTP 지연이 항상 5초 이내라는 뜻은 아니다.

| 계층 | 정책 |
|---|---|
| Rails 현재 카탈로그 | 60초 |
| Rails 고정 release 카탈로그·scope·검색·순위·비교 | 86,400초. release와 정규화 조건, DB 식별 해시로 분리 |
| 공개 게시글 조회 | 60초 |
| 공개 HTML | 브라우저 `max-age=0`, 공유 캐시 `s-maxage=60`, `stale-while-revalidate=300`. CSRF 폼이 있는 홈·검색은 `private, no-store` |
| 현재 release API | `max-age=60`, `s-maxage=60`, `stale-while-revalidate=300` |
| 명시한 유효 release API | `max-age=31536000, immutable` |
| 오류·해석 불가 검색·없는 상세 ID | 캐시하지 않음. 의미에 따라 400/404/503 또는 기존 JSON 상태 반환 |

Rails는 현재 `tmp/cache` 파일 캐시를 사용한다. 인스턴스마다 독립적이며 여러 컨테이너 간 공유 캐시나 운영 CDN HIT를 검증한 상태는 아니다. 최신 포인터와 HTTP 캐시 때문에 갱신 직후 이전 release가 잠시 보일 수 있다. 고정 release 데이터는 수정하지 않고 새 release로 공개한다.

선수 경기 목록은 페이지당 최대 200개다. 시즌·선수·경기 범위 SQL과 집계를 유지하며 전체 원본 JSON을 브라우저로 보내지 않는다. `0`, `null/—`, DNP, Inactive, 출전 상태 미확인 및 coverage를 구분한다. 경기별 POS는 원본 G/F/C를 보존하며, 선발 표시가 정확히 5명이고 모두 출전한 팀만 Starter/Bench를 확정한다. 홈·원정 지정과 중립구장 미확인은 별도로 표시한다.

## Jev 자연어 검색

한국어·영어 검색 폼은 CSRF 토큰을 포함한 `POST /search` 또는 `/en/search`다. 익숙한 선수·시즌·지표 키워드는 로컬 규칙으로 처리하고, 지원하는 구어체 질문은 Jev Choice로 해석을 검증한다. 이미 검증된 해석과 SQL 결과는 캐시한다. 성공 시 303으로 7일 유효한 서명 참조 URL로 이동하므로 새로고침·뒤로 가기·공유 조회에서 API를 다시 호출하지 않는다. 만료·변조·캐시 유실 시 다시 검색하도록 안내한다.

`GET /search?q=…`와 `GET /api/records/query?q=…`는 외부 API를 호출하지 않는다. API의 새 `POST /api/records/query`는 동일 세션의 CSRF 토큰이 필요하며 `no-store`다. `releaseId`는 쿼리 또는 POST 본문 중 한 곳에서만 지정한다.

지원하는 조건은 알려진 선수, 한 시즌, 정규시즌/플레이오프, 상대, 홈/원정, 지표 한 개, 숫자 비교 한 개, 정렬·상위 N, 평균·합계·경기 수·2인 평균 비교다. **통산은 댈러스 소속 출전 기록**이다. `2011년 플옵`은 2010–11 시즌으로 해석하고, `올해`처럼 두 시즌으로 읽힐 수 있는 표현은 선택지를 보여 준다. 포지션별 집계·승패·날짜 범위·복수 지표 조건 등 아직 지원하지 않는 질문은 조건을 삭제하지 않고 수정을 요청한다. G/F/C 박스스코어 표시는 기존대로 유지한다.

`21시즌 루카의 평균기록 알려줘.`처럼 지표를 지정하지 않은 선수 1명의 평균 요청은 17개 박스스코어 지표와 3개 슈팅 성공률을 함께 표시한다. 정규시즌의 `21시즌`, `21년`, `21년도`, `2021년도`는 시작 연도 기준 **2021–22**, `20-21`은 **2020–21**로 해석하며 화면에 전체 시즌명을 표시한다. `년도에` 같은 조사와 붙여 쓰기도 처리한다. 플레이오프의 `21년도`는 해당 연도에 열린 **2020–21 플레이오프**, 명시적 `21년도 시즌`은 **2021–22 시즌**이다. 같은 명확한 질문은 Jev 호출 없이 처리한다. 평균은 50행 표시 한도와 무관하게 모든 해당 출전 경기를 대상으로 계산한다. 성공률은 총 성공 수/총 시도 수이며, 누락값과 0회 시도는 0으로 바꾸지 않는다. 전체 평균 프로필에 숫자 조건·상위 N·정렬을 함께 붙인 요청은 지원하지 않는다고 안내한다. 명시적인 단일 지표 평균 검색은 기존대로 동작한다.

평균 프로필은 득점·리바운드·어시스트를 우선 표시하고 출전시간·수비 기록, 한글 슈팅 3행 표, 세부 기록으로 구분한다. 계산·시즌 설명은 기본적으로 접고 누락 경고는 계속 표시한다. CSS URL은 파일 내용 해시로 버전을 붙여 변경된 스타일이 브라우저 캐시에 가려지지 않게 한다.

호출은 고정 HTTPS 주소 한 곳으로만 전송하고, 재시도·리디렉션을 하지 않으며 총 8초 안에 중단한다. 알려진 선수의 공개 식별 정보와 질문·후보 조건만 전송한다. 인증 정보·이메일·전화번호 패턴은 전각 문자를 정규화한 후 차단한다. 임의 SQL을 받아 실행하지 않는다. Jev 선택값·신뢰도·확률과 카탈로그 기반 QueryPlan을 검증한 뒤 기존 바인딩 SQL을 사용한다.

단일 호스트의 파일 잠금으로 전송 전에 일일 사용량을 예약하며 실패·타임아웃도 차감한다. UTC 자정에 초기화한다. IP 해시별 분당 5회, 동시 2회도 제한한다. 예산 파일 오류는 호출을 차단한다. **운영에서는 `JEV_BUDGET_PATH`를 영속 볼륨에 두고 모든 worker가 공유해야 한다.** 여러 독립 호스트에는 공용 원자적 저장소가 필요하다. `tmp` 정리나 배포로 파일이 사라지면 일일 사용량이 초기화되므로 해당 경로를 청소 대상에서 제외한다. 자동 결제·충전은 구현하지 않는다.

검색 질문·계획·서명 참조는 로그에서 필터링한다. 공유 참조의 질문은 서버 캐시에 최대 7일 보관하므로 개인정보를 입력하지 않는 사용 흐름으로 안내한다. 자세한 경계와 검증은 [ADR 002](../docs/architecture/002-jev-natural-search.md)를 참고한다.

## Supabase 이관과 미디어

원본은 PostgreSQL 17.6이다. 로컬 검증용 PostgreSQL 17.9 클러스터 `127.0.0.1:55432`에 전체 테이블을 복원하고 데이터·파일 일치 검증을 완료했다. 기존 `localhost:5432`의 PostgreSQL 15는 유지한다. **55432는 운영 목적지가 아니라 복원 검증용**이다.

| 완료된 export 항목 | 값 |
|---|---|
| manifest 생성 시각 | `2026-10-06T14:27:44.086Z` |
| 테이블 / 행 | 61 / 225,439 |
| 기록 release | 2개 |
| 공개 Storage 파일 / bucket | 53 / 3 |
| 파일 합계 | 46,723,941 bytes |
| `database.dump` | 31,131,503 bytes |
| dump SHA-256 | `640b27a456d19568a6fa199a82b82a50d3faa94a096672d82bff2fa2f2100cec` |
| 로컬 테이블 행 수 / 행 내용 MD5 일치 | 61 / 61 |
| 파일 바이트 / SHA-256 일치 | 53 / 53 |
| FK 검증 | 62개 모두 validated |

해당 private export 디렉터리는 `data/migrations/2026-10-06T14-24-15-281Z-9254b0891613`이다. 덤프·manifest·진단 로그에는 계정과 원본 데이터가 포함될 수 있으므로 Git/정적 assets에 넣지 않는다. `data/migrations/`는 Git에서 제외한다.

### 백업 재현과 로컬 검증 명령

저장소 루트에서 [export-supabase.mjs](../scripts/migration/export-supabase.mjs)를 사용한다. `--plan` 또는 인자 생략은 계획만 출력하고 DB/Storage에 연결하지 않는다. `--run`은 루트 `.env.local`의 `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`을 읽는다. 기존 프로세스 환경값이 있으면 우선하므로 실행 전에 대상 참조를 확인해야 한다. 현재 exporter의 `pg_dump` 경로는 `/opt/homebrew/opt/postgresql@17/bin/pg_dump`다.

```sh
node scripts/migration/export-supabase.mjs --plan
# 승인된 백업 재실행 시에만 사용. 기존 export를 덮어쓰지 않고 새 디렉터리를 생성한다.
node scripts/migration/export-supabase.mjs --run
```

exporter는 원본 DB를 READ ONLY / 공유 REPEATABLE READ snapshot으로 읽고 같은 snapshot으로 덤프와 테이블별 행 수·체크섬을 만든다. Storage는 snapshot의 메타데이터에 맞춰 바이트·가능한 ETag·SHA-256 및 디스크 재읽기를 확인한다. DB sequence는 PostgreSQL MVCC snapshot과 완전히 동기화되지 않는다는 제한을 manifest에 남긴다. 새 로그인·결제 요구, private bucket, 401/402/403 또는 리디렉션 응답에서는 파일 수집을 중단한다.

[restore-local.py](../scripts/migration/restore-local.py)는 원본에 연결하지 않고 고정된 loopback 검증 DB에만 작업한다. 다음은 **비어 있는 새 검증 환경**에서의 재현 순서이며, 이미 완료한 현재 복원에 중복 실행하지 않는다. 기존 클러스터·비어 있지 않은 DB·기존 Ruby 환경 파일은 덮어쓰지 않고 중단한다.

```sh
MAVS_EXPORT_DIR="$(pwd)/data/migrations/2026-10-06T14-24-15-281Z-9254b0891613"
python3 scripts/migration/restore-local.py init
python3 scripts/migration/restore-local.py restore --export "$MAVS_EXPORT_DIR"
python3 scripts/migration/restore-local.py verify --export "$MAVS_EXPORT_DIR"
# verify가 성공한 뒤 공개 조회용 로컬 최소권한 계정과 ruby/.env.local을 만든다.
python3 scripts/migration/restore-local.py configure-reader --export "$MAVS_EXPORT_DIR"
```

`PG17_BIN`으로 복원 도구 디렉터리를 지정할 수 있으며 기본값은 `/opt/homebrew/opt/postgresql@17/bin`이다. `verify`는 61개 테이블의 행 수·체크섬과 파일별 바이트·SHA-256을 manifest와 비교하고 `data/migrations/local-validation/verification-*.json`에 새 보고서를 저장한다. 이번 보고서의 `ok: true`와 모든 항목의 `match: true`를 확인했다. FK 62개가 모두 validated 상태인 것도 별도로 확인했다. 재현 시에는 새 보고서와 FK 검증을 다시 확인한다. 로컬 접속 비밀과 원본 진단 로그는 터미널에 출력하지 않는다.

`restore` 단계는 덤프 복원 뒤 [local_read_indexes.sql](db/local_read_indexes.sql)과 `ANALYZE`도 자동 실행한다. 추가 인덱스 `records_player_team_catalog_idx`는 `(release_id, team_id, player_id)`를 덮으며, SQL 자체가 대상 host/port/DB를 `127.0.0.1:55432/mavs_validation`으로 제한한다. Supabase 원본에 적용한 인덱스가 아니다. 따라서 재현 명령은 위의 4단계를 유지한다.

공개 조회 계정과 `ruby/.env.local` 연결도 구성했다. Rails의 실제 접속 대상은 `current_database = mavs_validation`, `current_user = mavs_public_reader`로 확인했다. 이 계정은 `auth.users`와 `public.User.email`을 SELECT할 수 없고 `public.News`에 INSERT/UPDATE/DELETE 권한도 없다. 기존 원본 Supabase 연결을 사용한다는 추정으로 검증을 대체하지 않았다.

현재 로컬 호환 복원은 원본 `database.dump`를 수정하지 않고 별도 `portable-toc.list`로 선택한다. 사용하지 않는 vector와 0행인 Vault의 확장 서비스를 설치하지 않으며, `vault.secrets` 열 구조만 보존한다. Vault nonce 암호화 기본값은 구현하지 않는다. Supabase 관리용 event trigger 6개도 로컬에서 활성화하지 않는다. 차이는 `restore-exclusions.json`에 기록한다. 따라서 이 복원은 **데이터 검증용**이며 Supabase 확장 서비스의 운영 대체 구현이 아니다. 비어 있지 않은 Vault는 이 경로로 복원하지 않고 중단한다.

이관 도구와 실행 기록이 확인해야 할 항목:

- 테이블 목록·행 수·덤프 해시와 복원 후 행 수/참조/시퀀스 검증. source owner·ACL은 그대로 복사하지 않고 대상 역할의 최소 권한을 따로 설정한다.
- Storage 파일의 바이트·해시·공개 여부와 object key 보존. private 파일은 웹 공개 경로로 옮기지 않는다.
- 기존 Google OAuth 계정 126개와 애플리케이션 계정의 대응 보존. OAuth client/secret·redirect URL·세션 정책은 별도 설정이며 DB 복원만으로 로그인 이전이 끝나지 않는다. 대응이 불명확한 계정은 삭제·임의 병합하지 않는다.
- 목적지, 인증, 미디어 링크, 쓰기 기능과 백업 복구 검증 후 운영 전환 판단. SQL과 파일을 복사한 사실만으로 Supabase 전체 이관 완료를 선언하지 않는다.

Ruby 미디어 URL은 `/media/:bucket/*object`다. `MIGRATED_MEDIA_ROOT` 바로 아래 `manifest.json`의 `files` 배열을 읽는다. 항목은 다음 구조이며, `public: true`인 항목만 제공한다.

```json
{
  "files": [
    {
      "key": "public-bucket/example.jpg",
      "path": "files/public-bucket/example.jpg",
      "public": true,
      "contentType": "image/jpeg"
    }
  ]
}
```

이는 형식 예시다. 실제 exporter는 object key의 SHA-256으로 `files/…` 저장 경로를 만들고 바이트·SHA-256을 함께 기록한다. export 디렉터리는 읽기 전용으로 마운트한다. 파일과 symlink의 실제 경로가 지정한 루트 내부여야 하며 manifest에서 허용되지 않은 파일은 404다.

`MediaArchive`는 설정된 원본 Supabase origin과 일치하고 manifest에 등록된 공개 파일만 `/media/…`로 바꾼다. 게시글 HTML의 `src`/`href`는 HTML 정제 후 변환한다. 원본 DB의 URL 값은 변경하지 않는다. 안전한 이미지·오디오·비디오 유형은 inline, HTML/SVG 및 그 외 유형은 `application/octet-stream` attachment로 내보내고 `nosniff`·sandbox CSP를 적용한다. 실제 앱에서 사용하려면 `MIGRATED_MEDIA_ROOT`와 원본 Storage origin 설정이 둘 다 필요하다.

## 테스트와 실행 구성

```sh
RAILS_ENV=test bundle exec rails test
```

현재 Ruby 테스트는 **142개/3,368 assertions PASS**이며 `zeitwerk:check`도 통과했다. 기록 서비스·캐시, SEO·미디어, Jev 경계·비용 예약·자연어·CSRF·서명 결과 조회, 두 자리 시즌과 종합 평균 프로필을 포함한다. Ruby 전환 당시 기존 TypeScript와 native Ruby repository를 **같은 로컬 복원 DB**에 연결한 49개 비교도 모두 일치했다. 두 release, 카탈로그, 경기·선수·시즌 범위, 순위, 비교, 한영 검색 및 빈 결과/오류 조건을 포함한 전환 기준선이다.

실제 Jev 연결은 소수의 공개 농구 질문으로 확인했다. 노비츠키 2010–11 플레이오프 30점 초과 6경기, 21경기 평균 27.7143점, 댈러스 정규시즌 통산 노비츠키 1,522경기/평균 20.7359점과 루카 422경기/평균 28.6469점 비교가 조회됐다. 실제 HTTP에서 POST→303→GET, 모호한 연도·복합 조건 안내, 반복 GET의 API 호출 0회를 확인했다. 표본에서 자연어 첫 조회 약 0.3–1초, 서명 결과 재조회 9–15ms였다. 로컬 표본이며 운영 지연이나 브라우저 렌더링 시간 보장은 아니다.

기록 순수 로직의 초기 기준선은 18개/109 assertions, 검색 line coverage 97.8%, 라인업 100%였다. 기존 TS와 정규화 실데이터 검색 37개 및 7,912개 팀 라인업도 일치했다. 한영 28개 ERB 변형에서 최신 경기 26행, Starter 10명, POS 순서, 128:149 합계, 200행 페이지 이동을 확인했다.

실제 로컬 HTTP 검증은 **67/67 PASS, 순차 GET 82회**다. 핵심 기록 경로 28개와 추가 상세·API·사이트맵·원래 404가 발생한 2개 경로 등을 확인했다. 미디어는 3개 bucket에서 4개 표본을 HTTP로 받아 원본 SHA-256과 비교했다. Jev 추가 후 재검증 보고서는 `data/migrations/local-validation/http-1791308506450-02f3e031.json`에 있다. 사이트맵 확인 수는 다음과 같다.

| 사이트맵 | URL 수 |
|---|---:|
| games | 7,912 = 경기 3,956 × 한영 |
| players | 808 = DAL 선수 404 × 한영 |
| seasons | 142 |
| articles | 503 = 뉴스 469 + 커뮤니티 30 + 칼럼 3 + 분석 1 |
| pages | 14 |

카탈로그 SQL은 동일한 warm 조건에서 인덱스 적용 전 **82.099ms → 12.444ms**로 줄었다. buffer blocks는 18,384 → 50, 개선 후 heap fetch는 0이었다. 추가 covering index 크기는 2,932,736 bytes다. 원본 데이터와 조회 결과는 보존했다.

로컬 개발 서버에서 각 페이지를 warm 상태로 5회 요청한 HTML 응답 중앙값:

| 화면 | 중앙값 |
|---|---:|
| 경기 상세 | 17ms |
| 선수 기록 | 42ms |
| 시즌 | 14.8ms |
| 뉴스 | 3.5ms |

이는 로컬 개발 서버·복원 DB의 반복 HTTP 응답 수치다. 브라우저 렌더링/LCP, cold 요청, 운영 서버나 CDN 성능을 뜻하지 않는다. 현재 Ruby는 `http://127.0.0.1:3002`, 기존 Next는 `http://127.0.0.1:3000`에서 확인할 수 있다. 실제 DB/파일 복원 검증은 위의 별도 보고서로 확인하며, 앱 테스트와 HTTP 검증은 운영 부하·Docker·배포 검증을 대신하지 않는다.

`Dockerfile`은 Ruby 3.4 slim-bookworm 기반의 두 단계 구성이다. 빌드 단계에만 C 컴파일러와 PG/XML 개발 패키지를 두고, 런타임은 uid/gid 10001로 실행한다. `.dockerignore`는 Ruby 코드와 정적 assets만 포함한다. `.env*`, Bundler 로컬 설정, 키, 미디어 export와 DB 백업은 이미지에 넣지 않는다. Node, DB 마이그레이션, `assets:precompile`은 필요하지 않다.

다음은 승인된 환경에서 사용할 이미지 빌드 예시다. 이번 문서 작성에서는 실행하지 않았다.

```sh
# 저장소 루트에서 실행. context는 반드시 ruby/.
docker build --tag mavs-ruby:local ./ruby
```

운영 실행 시 DB URL·secret은 런타임 secret/env로 주입하고, `SITE_URL`과 실제 Host가 일치하도록 HTTPS 프록시를 구성한다. production은 HTTPS를 강제하며 허용 Host도 `SITE_URL`에서 정한다. `LEGACY_APP_ORIGIN`은 사용자의 브라우저가 접근 가능한 별도 Next 주소여야 한다. 같은 Ruby 주소를 넣으면 리디렉션 루프를 막기 위해 503을 반환한다.

컨테이너의 `tmp/`와 `log/`는 쓰기 가능해야 한다. 미디어는 필요할 때만 별도 읽기 전용 볼륨으로 연결한다. 이 이미지에는 PostgreSQL 서버, Supabase Auth/Storage 서비스, 기존 Next 앱이 포함되지 않는다. 최초 실제 빌드에서 native extension 로드, production 부트, 프록시/Host, DB 조회, 미디어 경계, 307 연결을 검증한 뒤 운영 전환을 판단한다.
