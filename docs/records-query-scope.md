# 최근 경기·날짜·팀 승패 조회

2026-10-24. Rails 기록 서비스의 로컬 구현. 정기 수집·올시즌 데이터 적재·Codex 연결·운영 배포는 이번 변경에 포함하지 않는다.

## 사용할 수 있는 질문

| 질문 | 의미 |
|---|---|
| 최근 두 경기 결과 알려줘 | 적재된 DAL 완료 경기 중 최근 2개 |
| 지난 경기 결과 | 적재된 DAL 최근 완료 1경기 |
| 2010-11 시즌 몇 승 몇 패? | 해당 시즌 정규시즌 완료 경기의 DAL 승패 |
| 올시즌 댈러스 몇 승 몇 패야? | 기준 KST 날짜의 활성 시즌, 자료가 없으면 empty |
| 어제 경기 결과는? | 시작시각을 KST로 변환한 날짜가 어제인 경기 |
| 2026-10-01부터 2026-10-24까지 댈러스 승패 | 양 끝 날짜 포함 KST 경기 시작일 범위 |
| 노비츠키 최근 2경기 평균 득점 | 팀 최근 완료 2경기를 먼저 선택하고 선수 실제 출전 경기로 평균 |
| 노비츠키 2011년 플레이오프 최근 2경기 평균 득점 | 2010–11 플레이오프의 최근 팀 2경기 |
| Dirk 2011-04-01 to 2011-04-30 average points | KST 시작일 범위의 DAL 소속 선수 평균 |

이번 구현은 위와 같은 명시적인 한영 문법을 로컬에서 처리한다. 모든 임의 자연어를 이해하는 상태는 아니다. ‘최근 출전 2경기’는 팀 최근 경기와 다른 의미이므로 지원하지 않는다고 안내한다.

## 조회 계약

- 기존 QueryPlan 필드는 유지한다. 버전 4에 `intent`(`team_games`/`team_record`), `recentGames`(1–82), `dateFrom`/`dateTo`(쌍으로 입력하는 ISO 날짜)를 추가했다.
- 시즌·대회·장소·상대·날짜 조건을 적용한 팀 완료 경기에서 최근 N개를 고른 뒤 선수 기록을 연결한다. 표시 `limit`은 평균·승패 집계를 자르지 않는다.
- team 결과는 `gameRows`와 `teamSummary`(`games`, `wins`, `losses`, `unknown`)로 반환한다. 기존 선수 `rows`/`summaries`는 유지한다.
- 최근 경기 표의 `playerStats`는 DNP·inactive·unknown을 구분한다. 행이 없는 선수도 unknown으로 표시한다. 평균 분모는 실제 played 경기이고 NULL을 0으로 채우지 않는다.
- `unknownDateGames`, `unknownVenueGames`, `unknownPlayerGames`를 반환한다. 선수 미확인 수는 표시 limit 바깥의 전체 선택 범위도 검사한다. 관련 미확인 값이 있으면 incomplete로 표시한다.
- 날짜 조건은 `tipoff_utc AT TIME ZONE 'Asia/Seoul'`을 사용한다. 시작시각이 없는 경기의 날짜를 추측하지 않는다. 미확인 날짜 수는 다른 조건에 맞는 후보 경기 중 시작시각이 없는 수로, 요청한 날짜에 실제 해당한다고 단정하지 않는다.
- 최근 경기·선수 표는 시작시각이 있으면 KST 날짜로 통일하고, 없으면 원천 날짜임을 표시한다.
- 올시즌 기본 규칙은 KST 10월 이후 현재연도 시작 시즌, 그 전에는 전년도다. 2026-10-24에는 2026–27이다. 시즌 메타데이터 기반의 실제 개막·특수 일정 반영은 수집 연결 단계에서 보완한다. 저장된 가장 최신 시즌으로 대체하지 않는다.
- 자료가 없을 때 0승 0패 또는 실제 무경기라고 단정하지 않고, 무경기인지 미수집인지 확인되지 않았다고 표시한다.
- POST/서명 결과/GET API의 기존 경로를 사용한다. 새 지원 문법은 외부 모델 호출이 없으며 재조회도 모델을 호출하지 않는다. 기존 Jev 경로는 보존한다.

## 구현 위치

- `ruby/app/services/records/game_query.rb`: 명시적 자연어와 기간·최근 경기 해석
- `ruby/app/services/records/query_plan.rb`: 새 조건 검증 및 기존 계획 호환
- `ruby/app/services/records/repository_game_scope.rb`: 읽기 전용 SQL, 승패와 참여 상태
- `ruby/app/helpers/records_search_helper.rb`, `ruby/app/views/records/_search_games.html.erb`: 조건·날짜·결과·누락 안내

## 검증

- 기존 기준선: Rails 142 tests / 3,368 assertions PASS.
- 최종 전체 Rails 테스트: 159 tests / 3,548 assertions PASS, 실패·오류·skip 0. 신규 서비스·한영 화면·서명 결과·GET API 테스트를 포함한다. `zeitwerk:check` PASS. 기존 dynamic action 라우팅 deprecation 경고는 남아 있다.
- 별도 임시 PostgreSQL 17.9에 합성 자료만 적재해 실제 SQL 15개 검증 PASS: 최근 완료 선택, 승패, scheduled 제외, DNP/누락 때문에 과거 출전으로 대체하지 않음, 실제 출전 평균 분모, KST 자정 경계, 미확인 날짜·장소 경고, 날짜와 장소 동시 누락, 날짜 범위 평균, 표시 limit과 집계 분리, 계획 재조회.
- 기존 127.0.0.1:55432 검증 DB에는 접속되지 않았다. 실제 운영 데이터 전수 검증이나 브라우저 시각 검증을 수행한 결과는 아니다. 임시 검증 서버는 종료했다.
