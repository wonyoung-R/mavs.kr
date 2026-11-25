프로젝트: mavs.kr | 환경: local | 담당: Ethan → 김비서/QA

> 2026-10-03 업데이트: 무료 공개 역사 자료를 수집하여 기존 Supabase의 `records` 스키마에 적재했습니다. 아래 내용은 초기 로컬 JSON 계약의 기록이며, 현재 적재·DB·조회·권한·한계는 [Supabase 적재 문서](records-supabase.md)를 따릅니다. `neutral`은 확인되지 않으면 `null`을 허용합니다. 실제 서비스 조회는 DB에서 필요한 범위만 읽으며 전체 역사 JSON을 브라우저에 전달하지 않습니다.

# 기록 데이터와 질의 계약

실제 역사 기록·저장/공개 이용권은 아직 확보되지 않았습니다. 앱은 운영 DB, 기존 ESPN 캐시, 외부 API를 자동으로 조회하지 않습니다. `data/records/dataset.json`이 없으면 empty 상태를 반환합니다. 검증 실패 데이터는 화면에 전달하지 않습니다. 테스트 데이터는 tests/records에만 있고 제품으로 내보내지 않습니다.

## 로컬 입력

`src/lib/records/types.ts`의 RecordDataset v1이 JSON 계약입니다. 내부 안정 ID와 sourceGameId를 구분하며, 모든 경기에는 DAL과 상대 팀을 지정합니다. 정규시즌·플레이오프·플레이인·컵결승·프리시즌·서머리그는 별도 competition입니다. 일반 Cup 경기는 regular/cup=true로 기록하여 중복 적재하지 않습니다. 시즌은 시작 연도(2010=2010–11)입니다. MIN_SECONDS는 초 단위 정수이며 표시할 때 분으로 변환합니다. 모든 기본 통계 키를 명시해야 합니다. 실제 0과 null을 구분하며 DNP/inactive/unknown에는 null 통계를 사용합니다. 팀 전용 리바운드/턴오버는 별도 nullable 필드입니다.

로컬 데이터의 storage/display 권리 evidence가 없으면 검증 실패입니다. commercial=false 자료는 수익화 승인 근거가 아닙니다. 권리 boolean은 입력자가 제공한 선언이며 법적 권리 검증을 대체하지 않습니다. 출처 URL은 HTTPS, 인증정보/쿼리/fragment/제어문자 없는 링크만 허용합니다. JSON과 evidence에 비밀정보를 넣지 마세요.

검증만: `node_modules/.bin/tsx scripts/records/import.ts /absolute/local.json --validate`

최초 로컬 적재: `node_modules/.bin/tsx scripts/records/import.ts /absolute/local.json --import`

CLI는 네트워크를 사용하지 않습니다. 파일을 덮어쓰지 않고 이미 적재됐으면 EEXIST로 중단합니다. 자동 수집·백필·운영 DB 적용·갱신 스케줄은 제공하지 않습니다. 실제 적재는 해당 자료의 사용 승인 범위 안에서만 실행하세요.

## 검색

`parseQuery(query,dataset)`는 ok/unsupported/ambiguous를 구분합니다. `executeQuery(query,dataset)`는 rows, summaries, total, coverage, incomplete를 반환합니다. 선수 이름·한글 표기·alias는 적재된 선수 목록으로만 해석하며 동명이인은 거부합니다. 없는 선수를 임의로 생성하지 않습니다.

지원 예: `Dirk 2010-11 playoffs home points`, `노비츠키 2010-11 플레이오프 득점 30 이상`, `Dirk 2010 playoffs average points`, `Dirk vs Luka compare points`. 이름은 실제 로컬 데이터에 있어야 합니다. 시즌 미지정은 적재된 DAL 정규시즌 전체를 조회하지만 통산 완전성을 선언하지 않습니다. 기본 지표는 PTS, 기본 순서는 내림차순, 기본 반환 한도 50(최대 200)입니다. sum/average/count/compare, home/away/neutral, 상대팀, 단일 지표 threshold, top N을 지원합니다. 비교는 선수별 경기 평균입니다. 선수는 DAL 소속 해당 경기만 계산하고 상대 선수 전체 커리어로 확장하지 않습니다.

클러치·연속기록·날짜 범위·복수 조건·팀 승패·파생 지표·PBP 질의는 unsupported입니다. 모르는 조건은 버리지 않습니다. MIN 조건값은 분으로 입력하고 내부 초로 변환합니다. 슛률은 아직 제공하지 않으며 입력 분모 없는 비율을 생성하지 않습니다.

집계에 null이 있으면 sum/average 값은 null입니다. threshold가 null을 제외한 경우도 incomplete=true를 유지합니다. count는 커버리지 완전성과 해당 지표 결손이 검증될 때만 숫자로 확정합니다. 반환 total은 적재 자료에서 일치한 행 수이며 역사 전체 경기 수가 아닙니다.

## 커버리지와 한계

expected 분모가 없으면 complete를 선언할 수 없습니다. observed는 실제 적재된 완료 경기 또는 통계행/필드수와 대조합니다. complete 통계는 각 경기 양팀 행 존재를 검사합니다. 다만 게임 장부의 역사적 정확성·DNP 명단 완전성·모든 시즌 수록 여부는 외부 전수 대조와 증거 검수가 필요합니다. 검증기는 저장 파일의 정합성을 확인하며 공급자 누락을 자동으로 알아낼 수 없습니다. 시즌 미지정 질의는 항상 incomplete입니다.

`prisma/records.prisma`는 독립적인 제안 스키마입니다. Season/Team/Player/Stint/Game/양팀 통계/Source/Mapping/Coverage/Observation/Correction을 정의합니다. 기존 prisma/schema.prisma를 변경하지 않았고 운영 DB에 적용하지 않았습니다. JSON 경로는 schema client 생성과 관계 없이 실행됩니다. URL/이름만으로 서로 다른 공급자 ID를 합치지 않습니다.

## 검증

`node_modules/.bin/tsx --test tests/records/query.test.ts`

`RECORDS_DATABASE_URL=postgresql://localhost:5432/records node_modules/.bin/prisma validate --schema prisma/records.prisma`

Prisma validate는 DB 연결/마이그레이션을 실행하지 않습니다. 테스트는 합성 자료로 null/0/DNP, 한영 동일 질의, 조건/집계, unknown count, 동명이인, alias 특수문자, rights, URL, phantom coverage를 검증합니다. 전 역사 데이터·권리·전수 범위는 테스트의 검증 대상이 아닙니다.

## 승인된 로컬 BALLDONTLIE 패키지 변환

`importBalldontliePackage`는 네트워크 없는 순수 변환 함수입니다. 입력 패키지는 `{source, games: [...], stats: [...], teamStats?: [...]}`이며 source는 위의 권리·출처 manifest입니다. games/stats는 공급자 응답의 data 배열을 직접 로컬에서 포장합니다. 공급자 account/token/헤더를 패키지에 넣지 않습니다. 원본 JSON 출력이나 오류값 반사는 하지 않습니다.

`node_modules/.bin/tsx scripts/records/import.ts /absolute/approved-bdl.json --validate --format bdl`

`--import --format bdl`는 완성된 임시 파일을 링크로 최초 공개하며 기존 dataset을 덮어쓰지 않습니다. 이 과정에서 자기 임시 파일만 정리합니다. 실제 자료 사용승인은 별도입니다. 단순 endpoint 접근권한이 권리 manifest의 근거가 되지 않습니다.

`bdl:game:123`, `bdl:team:14`, `bdl:player:44`처럼 개체형별 내부 ID를 만들어 provider 숫자 ID가 서로 섞이지 않게 합니다. 교차 공급자 동일인 대응은 검수 전 자동 병합하지 않습니다. 모든 경기는 로컬 검수된 competition과 neutral boolean 명시가 필수입니다. postseason=false만으로 정규시즌을 추정하거나 중립 정보 누락을 홈 경기로 추정하지 않습니다. postseason과 명시 유형이 충돌하면 거부하며 ist_stage Championship/Final은 cup_final만 허용합니다. 원본 데이터에 없는 분류는 검수 근거를 확보한 뒤 로컬 패키지에 주석으로 부여해야 합니다. status_state가 있으면 status보다 우선하고 Final/Final OT/Completed는 final로 변환하며 suspended를 포함한 알 수 없는 경기 상태는 거부합니다.

0점이며 출전시간이 양수인 행은 played로 보존합니다. 출전시간 0/누락은 자동 DNP 판정하지 않고 unknown으로 보존하며 기존 source 통계를 지우지 않습니다. unknown은 집계에서 제외되고 결과는 incomplete입니다. explicit dnp/inactive 행은 null 통계로 정규화하지만 양수 통계와 충돌하면 입력을 거부합니다. 빈값/`-`/`--`/`N/A`는 null입니다. 상대팀 선수도 입력된 범위에서 보존합니다. 미제공 DNP·팀 합계·게임을 만들어내지 않습니다. 팀 합계는 별도 teamStats 입력이 있을 때만 보존하며 선수 합산으로 대체하지 않습니다. 모든 변환 coverage는 expected=null/unverified입니다.
