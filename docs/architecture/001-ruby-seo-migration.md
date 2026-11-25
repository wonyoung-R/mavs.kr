# ADR 001: 공개 조회를 Rails 서버 HTML로 단계적으로 전환

- 날짜: 2026-10-06
- 상태: 구현 채택, 공개 조회·로컬 데이터 복사·HTTP 검증 완료. 운영 목적지와 전환은 미확정
- 범위: MAVS.KR 공개 기록·게시글 조회, 검색 메타데이터, 기존 기능 연결 경계
- 실행 안내: [Ruby README](../../ruby/README.md)

## 배경과 결정

사용자는 mavs.kr을 검색 최적화된 Ruby 프로젝트로 전환하고, 기존 Supabase 데이터도 전체 이관하기를 요청했다. 먼저 기존 데이터 의미와 URL을 보존하는 Rails 8.1.4 / Ruby 3.4 공개 조회 서버를 만든다. 기록 검색·집계는 Ruby 서비스로 옮기고, 페이지 본문과 탐색 링크를 ERB에서 렌더한다. 공개 뉴스·커뮤니티·칼럼·분석도 서버 HTML로 제공한다.

Ruby라는 언어 자체가 검색 노출이나 순위를 보장하지 않는다. 이 결정의 SEO 근거는 **첫 HTML에 실제 본문을 제공하고, URL·메타데이터·상태 코드를 일관되게 관리하는 것**이다. Rails Action View는 controller가 전달한 데이터로 HTML 응답을 만든다. Google도 JavaScript 콘텐츠 처리의 장기적 접근으로 서버 렌더링·정적 렌더링 등을 안내한다. [Rails Action View](https://guides.rubyonrails.org/action_view_overview.html), [Google 렌더링 안내](https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering).

Next도 서버 렌더링을 지원하므로 언어 교체가 유일한 SEO 해법이라는 주장은 하지 않는다. 여기서는 사용자가 요청한 Ruby 전환 안에서 URL·데이터·운영 경계를 명확히 하고, 공개 조회 기능부터 검증 가능하게 옮긴다. UI를 새로 디자인하거나 조회 결과를 다시 정의하는 작업은 포함하지 않는다.

## 애플리케이션 경계

| 요청 | 담당 |
|---|---|
| `/`, `/search`, `/seasons`, `/players`, `/records`, `/compare`, `/history`, `/data`, `/games/:id`, `/players/:id` | Rails. 기록 10개 화면, 한국어와 `/en` 경로 |
| `/seasons/:season/:competition` | Rails 시즌 상세 URL. 기존 query URL도 조회 가능 |
| `/api/records/coverage`, `/scope`, `/query` | Rails의 기존 records API 계약 |
| `/news`, `/comm`, `/column`, `/analysis` 및 공개 상세 | Rails 조회. 게시글 카테고리에 따른 canonical 경로 사용 |
| 로그인·OAuth·프로필·작성/편집·admin·기존 API/cron·`/fan` | 기존 Next. `LEGACY_APP_ORIGIN`으로 307 연결 |
| `/robots.txt`, `/sitemap.xml`, `/sitemaps/*.xml` | Rails |
| `/media/:bucket/*object` | 명시한 export manifest의 공개 파일만 Rails가 제공 |

기존 Next 소스와 실행 경로를 유지한다. 운영에서는 Next의 별도 접근 가능한 origin을 지정해야 하며, 로컬 기본값은 3000번 포트다. Ruby는 로컬 3002번 포트를 사용한다. 307은 기존 메서드와 요청을 유지하는 연결이며 인증·작성 기능의 Ruby 포팅이 아니다. **이 단계는 전체 Ruby 전환 완료를 뜻하지 않는다.**

## SEO 응답 계약

1. **본문과 링크:** JavaScript 실행 없이 경기 점수·박스스코어·선수 기록·검색 결과·게시글 본문을 읽을 수 있어야 한다. 검색/필터는 GET form, 페이지 이동은 실제 `a href`를 사용한다. 서버와 크롤러에 다른 본문을 주지 않는다.
2. **title·설명·h1:** 경기 날짜·대진·점수, 선수명, 시즌·대회가 title과 설명에 반영된다. 본문 h1과 페이지의 실제 대상을 일치시키며 모든 상세에 같은 일반 제목을 반복하지 않는다. 검색 결과의 최종 title 표시를 강제할 수 있다는 의미는 아니다. [Google title 지침](https://developers.google.com/search/docs/appearance/title-link).
3. **canonical:** 상세 ID는 한 번만 URL 인코딩한다. `nba:game:…`의 링크는 `%3A`이며 `%253A`를 생성하지 않는다. 시즌별 상세와 게시글 카테고리의 대표 URL을 정하고 목록 페이지 번호를 보존한다. canonical은 대표 URL을 알리는 신호이며 Google의 선택을 강제하는 명령이 아니다. [Google canonical 지침](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
4. **언어:** 기록의 한국어·영어 페이지는 각각 자기 canonical을 갖고 `ko`, `en`, `x-default` alternate를 함께 제공한다. 두 언어에서 서로를 가리킨다. 게시글을 실제 번역하지 않은 상태에서 존재하지 않는 영어 URL을 만들지 않는다. [Google hreflang 지침](https://developers.google.com/search/docs/specialty/international/localized-versions).
5. **사이트맵:** 페이지·경기·선수·시즌·게시글을 나눈 sitemap을 index에서 연결한다. 상세 URL을 포함하고 `lastmod`는 실제 변경 시각이 있는 경우에만 쓴다. 언어별 URL과 alternate는 HTML과 일치시킨다. 사이트맵 제출만으로 크롤링·색인이 보장되지는 않는다. [Google sitemap 안내](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview).
6. **상태 코드:** 없는 상세는 실제 404, 잘못된 입력은 400, DB/공개 데이터 이용 불가는 503을 반환한다. 오류 본문에 200을 붙여 정상 기록처럼 보이게 하지 않는다. [Google HTTP 상태 코드 안내](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes).
7. **검색·조합 필터:** 자유 검색·비교와 많은 조합을 만드는 상대/장소 필터 등에는 `noindex, follow`를 적용한다. API와 오류에도 noindex를 둔다. robots.txt 차단은 noindex를 대신하지 않는다. noindex를 검색엔진이 읽어야 하는 HTML을 동시에 크롤링 차단하지 않는다. [Google noindex 지침](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
8. **구조화 데이터:** 확인된 경기·선수·게시글·사이트 정보로 SportsEvent, Person, Article/NewsArticle, BreadcrumbList 등을 만든다. 경기장·이미지·저자처럼 없는 값은 만들어 넣지 않는다. JSON-LD 삽입 시 HTML 문맥을 안전하게 escape한다. 구조화 데이터만으로 리치 결과 노출을 보장하지 않는다.

## 데이터와 조회 의미 보존

Rails 서비스는 기존 PostgreSQL `records` 스키마의 immutable release를 읽는다. 한 요청에서 release를 고정해 카탈로그와 상세가 서로 다른 버전을 섞지 않게 한다. 공개 게시글은 기존 `public` 테이블을 조회한다. 조회 서버가 스키마를 생성하거나 데이터 이관을 자동 실행하지 않는다.

기록 포팅의 불변 조건:

- 한국어·영문·별칭 검색, 시즌·정규/PO·상대·임계값·비교 언급 순서와 오류 메시지 계약을 유지한다. 해석할 수 없는 조건을 버리고 더 넓은 검색을 실행하지 않는다.
- DAL 재적 경기만 선수의 DAL 통계에 포함한다. 실제 0과 NULL, DNP, Inactive, 참여 불명을 구분한다. 결측값을 0으로 보정하지 않는다.
- 경기별 원본 G/F/C를 POS로 보존한다. 팀의 `starter=true`가 정확히 5명이고 전원 출전한 경우에만 Starter/Bench를 확정한다. Starter G→F→C, Bench 출전시간 내림차순, 미출전 선수 마지막 정렬을 유지한다.
- 홈·원정은 원본 지정 팀을 따르며, 중립구장 여부가 없으면 별도 미확인으로 남긴다. 제공된 선수 득점과 팀 합계 불일치를 표시하며 원본 팀 합계를 바꾸지 않는다.
- coverage, 공급자·수집일·변환 버전·권리 근거를 유지한다. 확보한 경기 수를 공식 통산 전체 기록으로 표현하지 않는다.
- 기존 인덱스·조건 SQL·최대 200행 페이지와 서버 집계를 유지한다. 새 언어라는 이유만으로 인덱스를 중복 생성하지 않는다.

## 지연과 캐시

비용과 DB 왕복을 줄이는 수단은 조회 범위 제한과 release 단위 캐시다. 언어 교체만으로 원격 DB 지연이 없어지지 않는다. Rails의 저수준 캐시를 조회 서비스에 적용한다. [Rails 캐시 가이드](https://guides.rubyonrails.org/caching_with_rails.html).

- 현재 카탈로그는 60초, 고정 release 카탈로그·조회·검색·순위·비교는 86,400초다. 캐시 키는 DB URL 자체를 노출하지 않고 식별 해시와 release·정규화 조건을 사용한다.
- 실패·없는 release·잘못된 입력·없는 상세와 해석 불가 검색 결과를 정상 데이터처럼 장기 보관하지 않는다.
- HTML과 최신 API에는 공유 캐시 60초/SWR 300초를 제공한다. 명시한 유효 release API는 1년 immutable이다. 공개 포인터 전환 직후의 stale 응답 가능성을 문서화한다.
- Rails 파일 캐시는 각 인스턴스의 `tmp/cache`에 저장된다. 여러 인스턴스의 공유 캐시, 실제 CDN HIT와 지역별 지연은 운영 구성에서 별도 확인해야 한다.
- DB 연결 풀은 프로세스당 2개, 연결/풀 대기 5초, 읽기 트랜잭션 SQL 제한 5초다. Puma 기본 스레드 4개와 총 프로세스 수를 함께 고려한다.

로컬 복원 DB에는 카탈로그의 DAL 선수 포함 여부 조회를 위한 `(release_id, team_id, player_id)` covering index를 추가했다. 크기는 2,932,736 bytes다. 동일 warm 조건 SQL은 82.099ms → 12.444ms, buffer blocks는 18,384 → 50, 개선 후 heap fetch는 0이었다. `restore-local.py restore`가 [local_read_indexes.sql](../../ruby/db/local_read_indexes.sql)과 `ANALYZE`를 자동 실행하므로 재현 절차에 추가 수동 단계는 없다. SQL에는 `127.0.0.1:55432/mavs_validation` 대상 확인이 있으며 원본 Supabase를 변경하지 않았다.

로컬 개발 서버의 5회 warm HTML 응답 중앙값은 경기 17ms, 선수 42ms, 시즌 14.8ms, 뉴스 3.5ms였다. 이 수치를 브라우저 렌더링/LCP, cold 요청, 운영/배포 CDN 성능으로 해석하지 않는다.

## Supabase 전체 이관 경계

공개 조회 포팅과 데이터 전체 이관은 별개의 완료 기준을 갖는다. 2026-10-06 export는 61개 테이블 225,439행, 기록 release 2개, 3개 bucket의 공개 파일 53개(46,723,941 bytes)를 확보했다. `database.dump`는 31,131,503 bytes, SHA-256 `640b27a456d19568a6fa199a82b82a50d3faa94a096672d82bff2fa2f2100cec`다. private export 디렉터리와 재현 명령은 [Ruby README](../../ruby/README.md#supabase-이관과-미디어)에 기록했다. **로컬 전체 데이터 복사·검증은 완료했고, 운영 전환과 Auth 서비스 이관은 미완료다.**

원본 PostgreSQL 17.6과 호환되는 17 계열 도구로 export했다. 로컬 PostgreSQL 17.9의 독립 클러스터 `127.0.0.1:55432`에 복원한 61개 테이블 모두 행 수·전체 행 내용 MD5가 일치했고, 파일 53개 모두 바이트·SHA-256이 일치했다. FK 62개도 모두 validated 상태다. 검증 결과는 `data/migrations/local-validation/verification-*.json`에 남겼다. 기존 `localhost:5432` PostgreSQL 15는 보존한다. 로컬 55432는 운영 목적지가 아니다. 원본 DB는 READ ONLY snapshot과 pg_dump로 읽었으며 source 데이터·설정은 변경하지 않았다. 테이블 체크섬은 덤프와 같은 snapshot을 사용하지만 PostgreSQL sequence 값에는 MVCC 일관성 제한이 있다.

복원 시 source owner/ACL을 그대로 복사하지 않는다. PostgreSQL은 `pg_restore --no-owner --no-acl`로 원본 소유권/권한 복원을 제외할 수 있다. 실제 대상 역할과 서비스별 권한은 목적지 환경에 맞게 검토한다. 이 옵션 자체가 적절한 권한을 자동 설계해 주지는 않는다. [PostgreSQL 17 pg_restore 문서](https://www.postgresql.org/docs/17/app-pgrestore.html).

로컬 호환 복원은 최초 생성된 custom archive를 직접 변경하지 않고 별도 TOC 목록을 사용한다. 사용하지 않는 vector·빈 Vault 확장 서비스와 Supabase 관리 event trigger 6개는 제외한다. `vault.secrets`는 0행과 열 구조를 보존하되 nonce 암호화 기본값을 구현하지 않으며, 비어 있지 않은 Vault는 이 경로에서 거부한다. 이 차이는 `restore-exclusions.json`에 남긴다. 행·파일 검증이 성공해도 이러한 서비스 기능까지 동일하게 복원했다는 의미는 아니다.

복원 검증은 manifest와 각 테이블의 행 수·체크섬, 각 파일의 바이트·SHA-256을 비교한다. 검증 후 별도 최소권한 공개 조회 계정과 Ruby 환경 연결을 구성했다. Rails의 실제 접속은 `mavs_validation` DB의 `mavs_public_reader`로 확인했고, 이 계정의 `auth.users`/`public.User.email` SELECT 및 `public.News` INSERT/UPDATE/DELETE 권한은 모두 없다. `public.User`에서는 공개 표시에 필요한 id/name/username만 허용한다. 기존 클러스터·DB·환경 파일을 덮어쓰지 않는 중단 조건을 유지한다.

Google OAuth 사용자 126개는 기존 사용자 ID와 애플리케이션 계정 대응을 보존해야 한다. OAuth 설정, callback URL, 인증 세션 전환은 DB 덤프의 대체물이 아니다. 매핑 불명 계정을 삭제하거나 임의로 병합해 숫자를 맞추지 않는다. Supabase의 Auth/Storage 서비스 설정이나 동작은 SQL 테이블 복사만으로 옮겨지지 않는다.

파일은 object key·공개 여부·바이트·해시를 확인한다. Rails가 제공하는 파일은 `MIGRATED_MEDIA_ROOT/manifest.json`에 `public: true`로 명시한 것뿐이며, export 루트 밖으로 향하는 실제 경로·symlink나 private 파일은 제공하지 않는다. 설정된 원본 Storage origin과 manifest가 일치하는 URL만 공개 HTML에서 로컬 경로로 변환하고 원본 DB URL은 보존한다. HTML/SVG는 다운로드로 제공해 문서로 실행하지 않는다. 이 동작에는 export 루트와 원본 origin의 실제 설정이 필요하다. Docker 이미지에 DB 덤프·계정 export·미디어 원본·자격증명을 포함하지 않는다.

운영 목적지, DNS/HTTPS, DB 계정과 백업 복구, Google 로그인, 게시글 쓰기, 파일 참조, 기존 Next 연결이 확인된 뒤 전환 여부를 결정한다. 아직 원본 삭제·운영 배포·도메인 전환은 하지 않았다.

## 검증과 남은 작업

포팅 초기 기준선으로 기록 순수 로직 테스트 18개/109 assertions를 통과했다. 당시 line coverage는 검색 97.8%, 라인업 100%다. 기존 TS와 정규화 실데이터 검색 37개 및 팀 라인업 7,912개를 비교해 차이가 없었다. 한영 28개 standalone ERB 렌더에서 경기 26행·10 Starter·POS/출전시간 정렬·합계·페이지 이동을 확인했다. 최종 Ruby 서비스·캐시·SEO·미디어 테스트는 **74개/2,317 assertions PASS**다. 같은 로컬 복원 DB에서 수행한 TypeScript/Ruby repository 49개 비교도 모두 통과했으며 두 release와 정상·빈 결과·오류 조건을 포함한다.

복원 DB를 사용한 실제 로컬 HTTP는 **67/67 PASS(순차 GET 82회)**다. 핵심 경로 28개와 기존 404 발생 경로 2개 등을 포함했다. 사이트맵은 games 7,912·players 808·seasons 142·articles 503·pages 14개 URL을 확인했고, 공개 게시글 503개는 뉴스 469·커뮤니티 30·칼럼 3·분석 1개다. 3개 bucket의 미디어 4개 HTTP 표본도 SHA-256이 일치했다. 최종 보고서는 `data/migrations/local-validation/http-1791297388933-2f34a11d.json`이다. Ruby 3002와 기존 Next 3000은 로컬 확인용으로 실행 중이다.

운영 전환의 남은 확인 항목은 OAuth 계정 대응, 목적지 환경의 권한·서비스 구성, 기존 Next origin과 인증·쓰기 연결, Docker production 부트와 배포 환경 지연이다. 로컬 데이터 복원과 HTTP 검증 성공만으로 운영 환경의 정합성과 성능을 보장하지 않는다. Dockerfile은 실행 구성 초안이며 실제 빌드·배포 결과를 주장하지 않는다.

이 단계의 장점은 공개 콘텐츠가 크롤러와 사용자에게 같은 HTML로 전달되고, 기록 데이터의 의미를 바꾸지 않은 채 URL·캐시 정책을 검증할 수 있다는 점이다. 비용은 전환 기간의 두 애플리케이션 운영, 기존 Next origin 관리, 별도의 인증·쓰기 기능 포팅 작업이다. 루비 전환을 완료하려면 남은 기능의 native 구현과 이관 검증을 추가로 수행해야 한다.
