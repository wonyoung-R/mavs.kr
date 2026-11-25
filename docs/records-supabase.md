# MAVS.KR 역사 기록 적재·조회

2026-10-03 KST. 사용자가 승인한 무료 데이터 수집·기록 스키마 구현·기존 Supabase 적재 작업.

## 실제 적재 결과

기존 Supabase 프로젝트 `nycoldtrqbkevvgoajlq`에 새 `records` 스키마를 생성했다. 기존 `public`의 뉴스·회원·게시판 테이블은 이 마이그레이션의 대상이 아니다. 저장돼 있던 인증정보로 접속했으며 새 로그인, 유료 API, 구독, 패키지 설치 없이 진행했다.

| 항목 | 적재 수 |
|---|---:|
| 시즌 | 46 (1980–81 ~ 2025–26) |
| 정규시즌 경기 | 3,707 |
| 플레이오프 경기 | 249 |
| 전체 경기 | 3,956 |
| 매버릭스 소속으로 등장한 선수 | 404 |
| 상대팀 포함 선수 목록 | 3,302 |
| 선수 경기 기록 | 92,120 |
| 양 팀 경기 기록 | 7,912 |
| 선수 심화 통계 포함 행 | 53,295 |
| 팀 심화 통계 포함 행 | 5,192 |
| 시즌·대회·필드별 coverage | 3,404 |

현재 공개 버전: `r_874077cc8f884010548fb51b`(경기별 G/F/C 포함). 이전 공개 버전 `r_a21cf51e49045e94449df4ba`도 보존한다. 원본 정규화 자료를 동일하게 다시 입력하면 SHA256으로 기존 버전을 재사용한다. 최초 적재 직후 전체 PostgreSQL 물리 사용량은 133,221,523 bytes(약127.1MiB). 적재 전 약18.5MiB였다. 포지션 포함 새 버전 적재 직후에는250,956,947bytes(약239.3MiB)다. 이번 재시도는 동일 입력의 이전 실측 증가량119MB를 근거로 예상 증가180MiB를 명시했다. 용량 검사 기준은 전체450MiB/이번 추가350MiB로 두었으며 새 유료 상품을 생성하지 않았다. 요금제의 월별 전체 전송량/기존 청구 내역을 조회한 것은 아니다.

## 원천과 재현

- 데이터: [Eoin Moore NBA historical dataset](https://www.kaggle.com/datasets/eoinamoore/historical-nba-data-and-player-box-scores)
- 고정 버전: 515, 공급자 갱신 시각 2026-06-15T11:08:10.51Z.
- 공개 메타데이터는 `CC0: Public Domain`으로 표시한다. 이 공급자 선언과 NBA.com 유래라는 설명을 보존했다. 상업 이용 권리의 독립 확인을 주장하지 않는다.
- 7개 CSV: Games, TeamHistories, Players, TeamStatistics, PlayerStatistics, TeamStatisticsExtended, PlayerStatisticsExtended.
- 모두 로그인 없는 공개 다운로드. 인증/접근 확인 응답이나 로그인 리디렉션에서는 수집기가 중단한다. 402 유료 요구도 실행하지 않는다.
- 다운로드 파일, 수집 시각, 바이트, SHA256, 공급자 버전은 `data/records/raw/kaggle/`에 보관한다. 대용량 원본은 Git 제외.
- 최초 정규화 자료·관측 로그·커버리지 보고서는 `data/records/normalized/`, 포지션을 보존한 새 버전은 `data/records/normalized-lineup-20261003/`에 있다. Supabase에는 DAL 출전 경기의 양 팀 기록만 적재한다.

```bash
npm run records:collect -- --files Games.csv TeamHistories.csv Players.csv TeamStatistics.csv PlayerStatistics.csv TeamStatisticsExtended.csv PlayerStatisticsExtended.csv --max-download-mb 500
npm run records:normalize
npm run records:db -- import
npm run records:db -- check
```

`import`는 기본 검증/dry-run이다. 실제 적재는 아래처럼 명시한다. 공급자 버전이 바뀌면 기존 파일을 자동 덮어쓰지 않으며 원본을 새 버전 디렉터리로 분리하는 검토가 필요하다. 현 수집기는 이번 고정 버전 재현용이며 상시 자동 수집 스케줄은 생성하지 않았다.

```bash
npm run records:db -- apply --apply
npm run records:db -- import --import --max-db-mb 450 --max-added-mb 350
npm run records:db -- verify
npm run records:verify-live
```

이번 G/F/C 버전은 `npm run records:db -- import --input data/records/normalized-lineup-20261003/dataset.json --max-db-mb 450 --max-added-mb 350 --estimated-added-mb 180 --import`로 적재했다. 새로운 원천 데이터에 이 예상 용량을 그대로 재사용하지 않는다.

## 저장 구조와 공개 경계

실제 스키마의 기준은 `scripts/records/sql/001_records.sql`과 추가 마이그레이션 `002_lineup_position.sql`이다. `prisma/records.prisma`는 초기 제안 보관본으로 실제 DB에 push하지 않는다.

| 테이블 | 역할 |
|---|---|
| releases / current_release | 데이터 내용 해시·행 수·공개 버전 포인터 |
| sources / source_artifacts | 공급자·권리 선언·원본 파일 해시·정정 전후와 증거 |
| teams / players | 안정적 NBA ID·별칭·팀 역사·선수 기초정보 |
| games | 시즌 시작연도·대회·날짜·양팀·점수·당시 팀명·원천 ID |
| player_game_stats | 경기당 선수 한 행, 실제 참여 상태, 선발 여부, nullable `starter_position` G/F/C, 기본 통계·심화 JSON |
| team_game_stats | 경기당 양 팀 각각 한 행, 팀 전용 리바운드/턴오버 포함 |
| coverage | 시즌·정규/PO·테이블·지표별 관측 범위와 검수 상태 |

`release_id`가 모든 관계의 경계다. 한 트랜잭션에서 테이블 적재·참조/점수/권한 검증 후 공개 포인터를 변경한다. 실패하면 기존 공개 버전을 유지한다. 동일 입력은 중복 적재하지 않는다. 지표는 정수 열로 저장하고 nullable 값과 실제0을 구분한다. 심화값은 공급자 원래 필드명과 수치를 보존하며 서로 다른 지표의 단위를 임의 통일하지 않는다.

`records`는 PostgREST 공개 스키마에 추가하지 않았다. anon/authenticated/service_role에 직접 테이블 권한을 부여하지 않고 RLS를 활성화했다. 서버만 기존 DATABASE_URL로 매개변수화된 읽기 SQL을 실행한다. 읽기는 READ ONLY와 SQL 5초 제한을 적용하는 고정 batch transaction이다. 네트워크 왕복 중 만료되던 interactive transaction의 8초 제한은 사용하지 않는다. SQL 실행 제한은 유지하며 네트워크 지연 자체를 없애는 변경은 아니다. DB URL·서비스 키는 응답이나 로그에 출력하지 않는다.

## 조회와 캐시

기본 카탈로그는 DAL 선수·팀·시즌·요약 coverage만 전달한다. 시즌 페이지는 선택한 시즌 경기 목록, 선수 페이지는 최대200행, 경기 상세만 양팀 선수/팀 박스스코어를 전달한다. SQL에서 선수별/시즌별/대회별 조건과 정렬·집계·LIMIT를 적용한다. 선수 집계는 DAL 소속 경기만 계산한다.

- 카탈로그: 서버 메모리60초, 최대4개 버전.
- 범위 조회·검색·순위·비교: 공개 버전+정규화 조건, 300초, 최대64개/직렬화10MiB. 동시 요청 공유, 실패는 보관하지 않음.
- Next 서버 Data Cache: 최신 카탈로그60초, 명시한 release의 카탈로그·범위·검색·순위·비교24시간. 조회 조건과 DB 연결 식별 해시로 분리하고 실패·없는 ID·해석 불가 질의는 저장하지 않는다. Next 전용 어댑터이므로 CLI 조회는 기존 저장소를 직접 사용한다.
- 최신 포인터는 메모리 캐시와 Next의 stale-while-revalidate가 겹치므로 공개 직후 반복 조회에 이전 버전이 약1~2분과 재검증 시간 동안 남을 수 있다. 만료 후 첫 요청도 기존 값을 반환할 수 있다. 특정 release 조회는 버전이 섞이지 않는다.
- 조회 API: 최신 포인터 조회60초 CDN, 명시한 유효 releaseId는1년 immutable. 없는 버전404·잘못된 버전400·오류는no-store.
- 페이지는 동적 SSR을 유지하면서 데이터 조회 결과를 캐시한다. `force-dynamic`은 `unstable_cache`까지 우회하므로 기록 라우트에서 제거했다. [Next Data Cache 문서](https://nextjs.org/docs/app/api-reference/functions/unstable_cache)를 기준으로 구현했다.
- 실제 배포 CDN HIT와 ISR 동작은 아직 운영 환경에서 검증하지 않았다. Storage JSON 업로드 경로는 이번 구현에 포함되지 않았으며 전체 사이트가 정적으로 배포됐다는 뜻이 아니다.

실제 DB 범위 조회 payload 측정: 카탈로그117,380 bytes, 2010정규시즌149,317 bytes, 선수200경기265,420 bytes, 한 경기181,381 bytes. 전체 원본 정규화 JSON162,367,576 bytes를 브라우저로 전달하지 않는다. 로컬에서 Sydney DB에 접근한 첫 검색은 약3.6–4.9초였으며 이는 목표 성능 달성 결과가 아니다. 동일 조건의 한영 반복 검색은 서버 캐시에서25ms로 반환됐다. 이 수치는 단일 로컬 실행 결과이며 배포 성능 보장이 아니다. DB 인접 실행 리전의 효과는 배포 후 추가 측정해야 한다.

2026-10-03 추가 최적화에서는 카탈로그6개·경기5개·선수4개·시즌2개 SELECT를 각1개 CTE 조회로 합쳤다. 동일 연결 조건(`connection_limit=2`)에서 카탈로그를 먼저 읽은 뒤 범위 캐시가 없는 경기 조회는4,058→1,355ms, 선수200행 2페이지는4,307→1,771ms였다. 결과 전체 해시가 변경 전후 일치했다. DB 내부 실행은 표본 경기2.277ms/선수18.930ms로, 로컬↔Sydney 왕복 비중이 컸다. 기존 복합 인덱스가 사용되므로 추가 인덱스는 만들지 않았다. 경기 페이지 전달 객체는 관련 선수·팀·출처·coverage만 남겨186,488→65,629bytes로 줄였다(동일 로컬 정규화 표본, 통계24행·포지션10개 보존).

새 release 적재 후 로컬 프로덕션 서버(`next start`,3001)에서 HTML 본문 수신 완료까지 측정했다. 경기 상세 첫 측정4,295ms/반복26·23ms, 선수200경기 페이지 첫 측정1,899ms/반복70·56ms였다. 서버 재시작 후 같은 경기의 첫 응답409ms/반복18·21ms, 선수 첫 응답93ms/반복58·60ms로 디스크 Data Cache 유지도 확인했다. 경기 HTML123KB는 POS와스타터10명을 포함하며, 위65KB는 HTML 전체가 아닌 전달 객체 크기다. 첫 측정은 DB 연결 자체까지 완전히 초기화한 벤치마크가 아니며, 운영 CDN·사용자 체감 렌더링 성능을 의미하지 않는다.

새 버전 공개 직후 실제 HTTP에서503을 관측했고 DB 통계 갱신 후 정상화했다. 적재기는 새 행을 넣은 뒤 테이블별 `ANALYZE`, 공개 포인터 변경 뒤 `ANALYZE records.current_release`를 같은 트랜잭션에서 수행한다. 갱신 후 신규 current 카탈로그SQL201.303ms/실제조회1,588ms, 공개 포인터의 예상·실제 행 수 모두1을 확인했다. 503의 단일 원인을 실행 계획만으로 확정하지는 않았다.

새 release는 아직 행 수 통계가 없어 검증 JOIN이 대규모 Nested Loop로 오판될 수 있다. 적재 검증은 기대 경기측 집합과 `EXCEPT` 비교로 바꾸었고, 잘못된 팀/경기/점수는 계속 차단한다. 기본 사전 용량 추정은 입력 JSON의2배다. 실패 후 재시도처럼 동일 데이터의 실측 근거가 있을 때만 `--estimated-added-mb`로 예상 증가량을 명시할 수 있다. 이 옵션은 검사 기준을 바꾸지 않으며10개 배치(최대1만 행)마다·각 테이블 끝·공개 포인터 변경 직전에 실제 DB 크기를 검사한다. 검사 사이의 순간 초과까지 막는 디스크 할당 제한은 아니므로 추정치에 여유를 둬야 한다. 중단 시 트랜잭션은 롤백하지만 할당된 디스크 공간은 즉시 줄어들지 않을 수 있다.

## 경기별 포지션과 정렬

`PlayerStatistics.csv.startingPosition`의 G/F/C를 경기-선수 행의 `starter_position`에 보존하고, 선발 여부와 독립적으로 POS 열에 표시한다. 92,120행 중38,577행에 값이 있다(G21,792/F12,691/C4,094). 원본에 없는53,543행은 NULL/`—`를 유지한다. 이 값은 경기별 원본 표기이며 선수의 통산 주 포지션이나 실제 매 순간의 역할을 뜻하지 않는다.

양 팀별 선발 표시가 정확히5명이고 모두 출전이 확인된 경우에만 Starter/Bench를 확정한다. 해당 조건을 만족하는 경기측은1,347개이며, 오래된 자료 등 나머지6,565개는 역할을 미확인으로 표시한다. POS는 역할 미확인 행에도 원본 값이 있으면 표시한다. 순서는 Starter(G→F→C), Bench(출전시간 내림차순), DNP/Inactive이며 원본이 불충분하면 선발5명을 임의 생성하지 않는다. 홈/원정은 경기 원천의 지정 팀을 표시하고, 중립구장 여부 미확인과 구분한다.

향후 포지션별 집계는 경기별 `starter_position`으로 필터/그룹화하되 출전 확인 행을 기준으로 계산하고 NULL 그룹·해당 시즌의 포지션 제공률을 함께 보여줘야 한다. 포지션 누락이 벤치/특정 연도에 편중돼 있으므로 현재 자료로 모든 가드/포워드/센터의 완전한 통산 집계를 주장할 수 없다. 향후 집계 UI나 전용 인덱스는 아직 추가하지 않았다.

## 데이터 품질과 제한

- 경기 장부에 대한 독립 전수 대조는 아직 하지 않았다. `complete`를 선언하지 않고 관측 범위를 표시한다. PO0건 시즌도 장부상0과 미검수 상태를 구분한다.
- 실제0, null, DNP/DND/NWT, 출전 확인 불가를 구분한다. 출전 확인 불가1,506행은 출전 선수 집계에서 제외한다. 누락 DNP명단을 만들지 않는다.
- 팀 ID가 비어 있던3,735행은 원천의 홈/원정 표시와 경기 당시 도시·팀명을 정확히 일치시켜 연결했다.
- 모순된 리바운드/슛 세부값은 관련 필드만null 처리했다. 한 경기측 개인+/-가 모두0인데 최종 점수차가 있는 경우도 미확인으로 처리하고 원본을 남겼다.
- 원천 충돌3행은 격리했다. `observations.json`은 제외·필드 보류·ID대응·합계 대조의 근거를 보존한다.
- 2010-10-29 MEM@DAL의 잘못된90-90 최종점수는 [구단 공식 미디어 가이드](https://www.mavs.com/wp-content/uploads/2020/12/2021-mediaguide.pdf)의90-91로 정정했다. 경기와MEM팀행 각1개 변경은 corrections.json과 DB source_artifact에 저장한다.
- 선수 제공득점 합계와 팀점수가 다른38개 경기측을 관측했다. 이 중18개는 출전미확인 행도 없는 경우이며, 나머지20개는 출전미확인 행을 포함한다. 박스스코어에 선수합계/팀점수/차이 및 누락·출전불명 인원을 표시한다. 팀 합계를 선수 합계로 대체하지 않는다.
- 원천에 확정적인 중립 구장 분류가 없어 현재 neutral은 모두null. 홈/원정/중립 필터는 비활성화하고 분류 미확인을 알린다. 원천의 지정홈/원정팀 자체는 게임에 보존한다.
- 원천 날짜의 타임존 표기가 모호하므로 UTC팁오프를 만들어 넣지 않았다. 시즌은 gameId에 포함된 시즌 연도로 분리하여 버블 일정에도 달력 연도를 잘못 적용하지 않는다.
- 프리시즌129경기/플레이인2경기는 이번 정규·PO 집계에서 제외했다. 일반컵4경기는 정규시즌3707경기에 포함하고 중복 적재하지 않는다. PBP는 수집하지 않았다.

## 검증

`records:test`67건, `records:test-data`7건(합계74건), TypeScript 검사 및 원본7개 파일 해시 검증 통과. 실제 Supabase 행수·참조·점수·공개접근 제한 검증 통과. 같은 파일 재적재는 `imported:false`로 기존 버전을 재사용하여 중복 없음 확인. live-verification은 자연어 검색6건을 로컬 계산과 대조하고 시즌82경기·선수200행 제한·점수 정정·노비츠키2011PO21경기582득점을 검증한다. 비교 선수 표시 순서가 DB 정렬에 따라 달라지던 문제도 실데이터 대조에서 발견하여 질문의 등장 순서로 고정했다.

2026-10-03 로컬 점검에서 누락된 `@next/swc-darwin-arm64@16.0.10` 바이너리를 기존 버전으로 복구했고 Next 실행과 production 빌드에 성공했다. 경기·선수 상세의 URL 인코딩을 한·영 라우트 경계에서 한 번 복원하여 존재하는 ID의 404와 canonical URL 이중 인코딩을 수정했다. 당시 라우트 회귀 테스트를 포함한 `records:test` 50건이 통과했고, 이후 캐시·정렬·포지션·용량 검증을 추가했다. 3,956경기·404 DAL 선수의 ID 4,360개 링크 변환 및 선수/팀 기록의 경기 참조를 전수 확인했다.

로컬 서버 실행 후 `node scripts/records/verify-pages.mjs`로 한·영 화면 28개를 순차 검사한다. 현재 적재본의 고정 표본을 사용하며 점수·표 행수·선수명·없는 ID의 not-found 처리를 검사한다. 스트리밍 응답은 HTTP 200 안에도 404를 담을 수 있으므로 RSC 오류 digest와 실제 HTML 내용을 함께 검사한다. API는 정상/잘못된 입력/release/cache 조건 12개 URL을 별도 확인했다. 이 검증은 HTTP 응답 기준이며 브라우저 클릭·hydration·모바일 시각 검증을 포함하지 않는다. 사이트 코드는 로컬 변경 상태이며 운영 배포는 실행하지 않았다.

G/F/C 새 버전의 최종3000서버 검증도28/28 통과했다. 최신 경기는 양팀 Starter5명·G/G/F/F/C·Bench출전시간순·DNP하단을 확인했다. 2011파이널은 양팀 각Unknown9명/DNP3명으로 선발을 오확정하지 않았고, POS15행을 포함한전체24행이 원본과 일치했다. API release/포지션 확인,67개TypeScript테스트·7개Python테스트,타입검사와production빌드도 통과했다. 임시 성능측정3001서버는 종료하고 사용자 확인용3000서버는 유지했다.
