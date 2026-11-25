# MFFL 맛집 지도 연결 준비

구현 경로는 `/matzip`, 승인 대기 목록은 `/admin/matzip`이다. 이 문서는 설정과 SQL 적용 방법을 제공한다. 운영 DB 적용·배포·유료 API 신청은 실행하지 않았다.

## 필요한 설정

| 환경변수 | 용도 | 공개 여부 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 기존 Supabase 프로젝트 | 공개 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 조회와 사용자 인증 검증 | 공개 |
| `SUPABASE_SERVICE_ROLE_KEY` | 검증된 서버의 등록·심사 RPC | 서버 전용 |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 카카오 지도 JavaScript SDK | 공개·도메인 제한 |
| `KAKAO_REST_API_KEY` | 식당 검색·좌표 및 행정구역 확인 | 서버 전용 |
| `NAVER_BLOG_CLIENT_ID` | NAVER API HUB 블로그 검색 | 서버 전용 |
| `NAVER_BLOG_CLIENT_SECRET` | NAVER API HUB 인증 | 서버 전용 |

지도 키 이름은 프런트엔드 설정과 일치시킨다. 카카오 애플리케이션의 지도 API 활성화, JavaScript SDK 사용 도메인(로컬·운영) 등록이 필요하다. 키 값은 문서·브라우저 로그·저장소에 기록하지 않는다.

현재 네이버 신규 검색 API 신청 경로는 NAVER API HUB다. [이관 안내](https://developers.naver.com/notice/article/32530), [API HUB 신청/발급](https://guide.ncloud-docs.com/docs/apihub-migration), [블로그 API 명세](https://api.ncloud-docs.com/docs/naver-api-hub-search-blog)를 확인하고 요금·약관을 검토한 뒤 별도 승인하여 신청한다.

## Supabase 마이그레이션

승인 후 `prisma/migrations-pending/002_matzip.sql`을 의도한 Supabase 프로젝트의 SQL Editor에서 적용한다. 적용 전 프로젝트 ref·환경·백업을 확인한다. Prisma 스키마의 기존 모델과 별도로 Supabase REST API용 `public` 테이블 3개를 추가하며 기존 테이블은 수정하지 않는다. SQL은 최초 적용용이며 재실행은 실패하여 기존 테이블을 덮어쓰지 않는다.

- `matzip_regions`: 행정구역 이름 경로, 부모 관계, 1~4단계. 서버가 카카오 좌표→행정구역 결과로 등록한다. 현재 장소가 등록된 지역부터 선택 가능하다. 전국 모든 읍면동의 완전한 코드 목록을 선적재하지 않는다. 이름 경로는 공식 행정코드가 아니며 개편 시 재확인이 필요하다.
- `matzip_submissions`: 신청자, 검증한 상호·좌표·주소, 추천 메뉴, 승인 상태·검토 이력. 회원은 자신의 신청만 직접 조회할 수 있다. 직접 쓰기 권한은 없다.
- `matzip_places`: 승인한 신청을 복사한 공개 장소. 공개 API는 신청자·검토자 정보를 반환하지 않는다.

등록/승인 함수는 `service_role`에만 실행 권한이 있다. 등록 API는 Supabase `getUser(token)`으로 로그인 검증 후 카카오 검색 결과의 ID를 재확인한다. 좌표·주소·상태를 클라이언트에서 신뢰하지 않는다. 심사 API와 DB 함수는 모두 기존 관리자 계정 `mavsdotkr@gmail.com`을 확인한다. `User` 테이블의 사용자 편집 가능 필드나 클라이언트의 `isAdmin`만으로 승인할 수 없다. 관리자 계정 범위를 변경할 때 API와 SQL 함수 검증을 함께 수정해야 한다.

승인은 행 잠금·단일 DB 트랜잭션으로 장소 생성과 신청 상태 변경을 함께 처리한다. 동일 카카오 장소의 중복 공개와 중복 대기 신청을 차단하고, 사용자당 하루 10회 신청 제한을 DB에서 처리한다.

## API 계약

- `GET /api/matzip`: `{places, regions}`. 승인 장소 최대 1,000건, 지역 최대 10,000건. 규모가 늘면 페이지네이션/지도 영역 조회가 필요하다.
- `GET /api/matzip/search?q=지역+상호`: bearer 로그인 필요. 카카오 음식점 검색 상위 15개 `{places}`.
- `POST /api/matzip`: bearer 로그인 필요. `{kakao_place_id,place_name,search_query,menu,recommendation}` → `201 {submission:{id,status:'pending'}}`. `search_query`는 선택한 결과를 반환했던 원래 검색어(최대 80자)이며 서버가 같은 검색어로 장소 ID를 재확인한다. 동명 지점이 많아도 상호만 재검색해서 다른 지점을 선택하는 문제를 피한다.
- `GET /api/matzip/admin`: 관리자 bearer. 승인 대기 최대 200건 `{submissions}`.
- `PATCH /api/matzip/admin`: 관리자 bearer. `{id,action:'approve'|'reject',review_note?}` → `{ok:true}`. 반려 사유 필수.

승인할 때만 `지역 + 상호`를 `sort=sim&display=1`로 검색해 첫 글의 링크·제목을 저장한다. 검색 화면 최상위와 API 최상위가 같다고 보장하지 않는다. 블로그 본문/사진은 복제하지 않고 원문 링크를 제공한다. API 키 미설정/검색 장애 시 승인을 중단한다. 정상 검색 결과 0건이면 블로그 없이 승인하고 카드에 검색 결과 없음으로 표시한다. 승인 후 검색 순위를 지속 추적하는 자동화는 없다.

## 검증 및 출시 전 확인

로컬 mock 테스트: `node --import tsx --test tests/matzip/backend.test.ts`. 이 명령은 유료 외부 API를 호출하지 않는다.

운영 연결 후 관리자/일반회원/비로그인 3개 권한으로 신청 비공개·승인 권한·중복 승인 경합·지도 좌표·필터 계층을 확인한다. 카카오·티맵 앱 설치/미설치, iOS/Android, 카카오톡 내부 브라우저에서 목적지 전달 및 대체 안내를 실기기로 확인한다. 외부 앱의 자동 실행은 브라우저 정책에 영향을 받는다.

관리자 큐 200건과 공개 장소 1,000건을 넘기기 전에 페이지네이션을 추가한다. 반복 장소검색 호출에 대한 네트워크 수준 rate limit은 배포 환경에서 별도 설정해야 한다. 초기 단계는 로그인 제한과 API 제공자 쿼터를 사용한다.

## 이번 로컬 검증 결과

- 프로덕션 빌드와 TypeScript 검사 통과. 기존 baseline-browser-mapping 갱신 안내와 빌드 작업자의 localStorage 경고는 남아 있다.
- 백엔드 mock 테스트 10개 통과. 외부 API와 운영 DB를 변경하지 않는 테스트다.
- `/matzip` 서버 HTML의 등록 버튼·canonical·OG/Twitter 공유 이미지 확인.
- 코드 QA에서 같은 상호의 타 지역 지점을 재검색하는 오류를 수정했고, 원래 지역 포함 검색어를 보존하도록 회귀 검증했다. 시군구가 없는 지역의 필터 라벨도 보정했다.
- 브라우저 연결 도구가 사용 불가여서 시각 검증·모바일 터치 동작은 미검증이다. 지도 SDK 및 길찾기 앱 목적지 전달은 키 설정 후 실기기 검증이 필요하다.
- 로컬 환경에 카카오 지도/REST 키와 네이버 API HUB 인증 정보가 없어 외부 연동은 실행하지 않았다. Supabase SQL은 아직 적용하지 않았다.
