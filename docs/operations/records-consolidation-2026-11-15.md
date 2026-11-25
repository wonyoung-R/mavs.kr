# 기록 DB 통합 결과 — 2026-11-15 KST

## 완료 범위

`ztlqbnmfppcndprmenti`의 `records` 스키마를 기존 `nycoldtrqbkevvgoajlq` 프로젝트에 통합했다. 운영과 로컬의 `RECORDS_DATABASE_URL`, `RECORDS_WRITER_DATABASE_URL`을 대상으로 전환하고, 기존 운영 배포의 같은 소스로 재배포했다. 로컬 작업 중인 다른 기능을 업로드하거나 Git 커밋·푸시하지 않았다.

이번 범위는 기록 DB다. 일반 앱용 `DATABASE_URL`은 기존 `ztlqbnmfppcndprmenti`의 앱 전용 역할 연결을 유지한다. 원본 프로젝트를 종료하려면 일반 앱 데이터와 연결의 별도 통합이 필요하다. Auth·Storage·뉴스·게시판 데이터는 복사하거나 변경하지 않았다.

## 데이터 보존과 검증

- 양쪽 `records`의 읽기 전용·일관된 snapshot 백업을 생성하고 SHA256을 기록했다. 백업·접속 정보·배포 이력은 Git에서 제외된 `data/migrations/records-consolidation-20261114T164325Z/`에 비공개 보관한다.
- 기존 역사 자료 16개 테이블/버전 묶음의 행 수·내용 해시가 일치했다. 대상의 과거 자료를 재적재하지 않고 003/004 스키마 확장과 누락 버전·자료만 추가했다.
- 물리 테이블 14개·조회 VIEW 8개·인덱스 23개·제약조건 104개와 identity sequence를 로컬 복원에서 검증했다. 성능용 `records_player_team_catalog_idx`도 보존했다.
- 실제 운영 적용은 역할 생성·스키마 확장·차분 COPY·권한·공개 포인터·내용 해시 검사를 한 트랜잭션에 넣었다. 적용 후 실제 대상 물리 테이블 14개의 해시를 원본과 다시 대조했다.
- 대상의 기존 `public` 테이블 12개는 적용 전후 행 수·내용 해시가 같았다.
- 공개 버전 6개, 현재 3,968경기·92,437개 선수 경기 기록을 보존했다. 공개 포인터는 `r_859a4a1db9c6ea1e4ed96cfe`다.

## 권한과 수집 전환

읽기 역할은 `mavs_public_reader` 그룹을 상속한 `mavs_records_reader`이며 기본 트랜잭션이 읽기 전용이다. 쓰기 권한을 명시적으로 요청해도 거절되는 것을 실제 대상에서 확인했다. `mavs_records_writer`는 records RLS 정책으로 수집에 필요한 권한만 갖고 일반 앱의 `public.User`를 읽을 수 없다. anon/authenticated/service_role은 records 스키마·테이블을 직접 조회할 수 없다.

원본의 모든 기록 물리 테이블에 짧은 잠금을 획득해 기존 쓰기 트랜잭션을 배출하고, 활성 수집이 없는 상태에서 원본 writer 로그인과 DML/sequence 사용 권한을 중단했다. 원본 기록 읽기와 데이터는 보존했다. 구 배포가 원본에 다시 쓰는 것을 막기 위해 원본 writer는 중단 상태로 유지한다.

현재 객체의 접근 차단은 실제 검증했다. Supabase의 전역 default grants를 건드리지 않았으므로 미래에 records 테이블·뷰를 추가할 때도 anon/authenticated/service_role의 권한을 명시적으로 회수하고 검증해야 한다.

## 실제 검증 결과

| 검사 | 결과 |
|---|---|
| 감사·이관 준비 단위 검사 | 16/16 통과 |
| 실제 역할 생성 wrapper를 새 로컬 cluster에 적용 | 통과 |
| idle-in-transaction writer가 있으면 동결을 중단하고 역할 변경하지 않음 | 통과 |
| 실제 대상 reader/collector 역할의 pooler 로그인·RLS·쓰기 격리 | 통과 |
| reader ORM으로 현재 카탈로그·2010 정규시즌 82경기·노비츠키 2011 PO 582점·검색 | 통과 |
| 대상 writer로 기존 수집 스크립트 실행 | status=ok, imported=false |
| 운영 `/api/records/scope?kind=season&season=2010&competition=regular` | 200 ready, 82경기 |
| 운영 수집 API 비인증/인증 실행 | 401 / 200 ok, imported=false |
| 재수집 후 공개 버전 유지·중복 적재 없음 | 확인 |

운영 `/stat`은 기존 준비중 화면을 유지한다. `/api/records/coverage`는 현재 배포에서 404다. 이관 전후 배포 파일 목록에 해당 라우트 산출물이 없는 것을 확인했으며, 이번 DB 이관에서 코드나 패키징을 확장하지 않았다. 핵심 scope 조회와 수집 API는 정상 검증했다.

기존 Vercel CLI의 sensitive 변수 갱신이 키 변경 오류를 반환하여, 공식 REST API로 기존 변수의 **value만** 수정했다. 변수 삭제·재생성이나 보안 설정 완화는 하지 않았다. 기존 운영 소스 재배포 ID는 `dpl_BTBCRGtZHsyhyE9NdvfFjmhxsinv`다.

## 도구와 복구

- `scripts/migration/records-transfer-audit.py`: 프로젝트 식별·읽기 전용 연결·동일 snapshot dump·공유 과거 자료 비교.
- `scripts/migration/records-transfer-prepare.py`: 격리된 로컬 DB 두 개에서 차분 SQL 생성·리허설. 운영 접속 기능 없음.
- `scripts/migration/records-transfer-wrapper-test.py`: 새 로컬 cluster에서 실제 역할 생성·트랜잭션 wrapper·동결 경합 검사 후 local server 종료.
- `scripts/migration/records-transfer-cutover.py`: 리허설·packet hash·최종 데이터/DDL 확인 후 명시적 `--apply`로 이관. 실패 시 원본 writer 권한 복구. 이미 적용한 DB는 재적용을 거절한다.

즉시 복구 시 비공개 백업의 이전 읽기/쓰기 URL과 배포 ID를 사용하고 원본 writer 권한을 복구한다. 대상에서 이후 새로운 경기나 정정 자료가 공개됐다면 먼저 그 차분을 보존·대조해야 하며, 오래된 원본 포인터로 바로 되돌리지 않는다. 대상 데이터나 원본 프로젝트를 삭제하는 단계는 수행하지 않았다.

## 코드의 전용 연결 계약

기록 조회는 `getRecordsDatabaseUrl()`이 반환하는 **`RECORDS_DATABASE_URL`만** 사용한다. 앱용 `DATABASE_URL`로의 fallback은 제거한다. 기록 수집·쓰기 CLI는 `getRecordsWriterDatabaseUrl()`을 통해 **`RECORDS_WRITER_DATABASE_URL`만** 사용한다. 두 값은 공백을 제거하고 대상 Supabase 프로젝트 `nycoldtrqbkevvgoajlq`를 확인한다. 다른 프로젝트의 URL은 접속 정보가 없는 일반 오류로 거절한다. 격리된 로컬 검증 연결은 허용한다.

서버 기록 조회는 앱의 공유 Prisma 인스턴스 대신 `getRecordsPrisma()`의 전용 reader client를 사용한다. `benchmark-read.ts`도 reader URL의 `connection_limit`만 조정하고, `verify-live.ts`와 함께 종료 시 전용 reader를 정리한다. 앱용 연결 환경변수나 공유 client에는 영향을 주지 않는다.

`scripts/records/database.mjs`의 `check`·`verify`는 reader, 명시적 쓰기 플래그가 있는 `apply`·`import`는 writer 연결을 요구한다. dry-run은 DB 연결 없이 유지한다. 이 CLI의 구형 001/002 적용·전체 적재 방식은 003 이후 layered schema에 쓰지 못하도록 `records.release_layers` 존재 여부를 확인해 중단한다. 최신 layered schema의 기록 갱신은 `sync-season.ts`/현재 season-sync 파이프라인을 사용한다. 새 연결 계약 검증은 코드·로컬 테스트 범위이며 이 변경 자체로 운영 DB 쓰기·배포를 수행하지 않는다.

`verify-live.ts`에는 과거 단일 normalized JSON 전체 건수와 현재 공개 카탈로그 건수가 같다는 검사가 남아 있다. 공개 버전 구성이 확장된 현재 데이터의 전체 검증 도구로 사용하려면 별도 기준 자료를 마련해야 한다. 이번 변경은 전용 reader 사용·연결 정리에 한정한다.

코드 전환 검증: 기록 테스트 116개·타입 검사·프로덕션 빌드 통과. 이관 대상 DB에 읽기 전용으로 접속해 3,968경기·92,437개 선수 경기 기록 및 노비츠키 2011 플레이오프 582점 검색을 확인했다. 기존 프로젝트의 direct/pooler URL(마지막 DNS 점 포함)과 다른 원격 호스트를 거절하며, 로컬 검증은 루프백 주소만 허용한다. 새 코드는 아직 커밋·푸시·배포하지 않았다. 로컬 빌드에는 구형 CLI의 넓은 파일 탐색 패턴 경고와 baseline-browser-mapping 갱신 안내가 남아 있다.
