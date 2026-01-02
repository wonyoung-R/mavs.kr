# PWA (Progressive Web App) 설정 가이드

MAVS.KR은 Progressive Web App으로 설정되어 있어, 사용자가 모바일 기기에서 네이티브 앱처럼 사용할 수 있습니다.

## 📱 PWA 기능

- ✅ 홈 화면에 추가 가능
- ✅ 오프라인 지원 (Service Worker)
- ✅ 앱처럼 실행 (Standalone 모드)
- ✅ 매버릭스 블루 테마 색상 적용
- ✅ iOS 및 Android 지원

## 🗂️ 파일 구조

```
public/
├── manifest.json          # PWA 매니페스트 파일
├── sw.js                  # Service Worker 파일
└── icons/
    ├── icon-192.png       # 192x192 아이콘
    └── icon-512.png       # 512x512 아이콘

src/
├── app/
│   └── layout.tsx        # PWA 메타 태그 설정
└── components/
    └── layout/
        └── ServiceWorkerRegistration.tsx  # Service Worker 등록
```

## 🔧 설정 내용

### 1. Manifest 파일 (`public/manifest.json`)

PWA의 기본 정보를 정의합니다:

```json
{
  "name": "MAVS.KR - 댈러스 매버릭스 한국 팬 커뮤니티",
  "short_name": "MAVS.KR",
  "description": "댈러스 매버릭스 한국 팬들을 위한 커뮤니티",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#00538C",
  "theme_color": "#00538C",
  "icons": [...]
}
```

### 2. Service Worker (`public/sw.js`)

오프라인 지원 및 캐싱을 담당합니다:

- **캐싱 전략**: 네트워크 우선, 실패 시 캐시 사용
- **자동 업데이트**: 새 버전 감지 시 자동 활성화
- **오프라인 지원**: 기본 리소스 캐싱

### 3. HTML 메타 태그 (`src/app/layout.tsx`)

```tsx
<head>
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#00538C" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black" />
  <link rel="apple-touch-icon" href="/icons/icon-192.png" />
</head>
```

## 🎨 아이콘 관리

### 아이콘 재생성

로고가 변경되었거나 아이콘을 업데이트해야 할 때:

```bash
npm run generate:icons
```

이 명령어는 `public/images/logos/mavericks.svg` 파일을 사용하여:
- `public/icons/icon-192.png` (192x192)
- `public/icons/icon-512.png` (512x512)

두 개의 PNG 아이콘을 생성합니다.

### 아이콘 요구사항

- **크기**: 192x192, 512x512 픽셀
- **형식**: PNG
- **배경**: 매버릭스 블루 (#00538C)
- **Maskable**: 안전 영역(중앙 80%) 고려

## 🧪 테스트 방법

### 개발 환경에서 테스트

1. **개발 서버 실행**
   ```bash
   npm run dev
   ```

2. **브라우저 개발자 도구 확인**
   - Chrome/Edge: F12 → Application 탭
   - **Manifest**: manifest.json 내용 확인
   - **Service Workers**: 등록 상태 확인
   - **Storage**: 캐시된 리소스 확인

3. **Lighthouse 테스트**
   ```bash
   # Chrome DevTools > Lighthouse 탭
   # 또는 CLI 사용
   npx lighthouse http://localhost:3000 --view
   ```

### 모바일에서 테스트

#### Android (Chrome)

1. Chrome 브라우저에서 사이트 접속
2. 메뉴(⋮) → "홈 화면에 추가" 선택
3. 홈 화면 아이콘 확인
4. 앱처럼 실행되는지 확인

#### iOS (Safari)

1. Safari에서 사이트 접속
2. 공유 버튼(□↑) → "홈 화면에 추가" 선택
3. 홈 화면 아이콘 확인
4. 앱처럼 실행되는지 확인

## 🚀 배포 시 주의사항

### HTTPS 필수

PWA는 **HTTPS**가 필수입니다 (localhost 제외):

- ✅ Vercel, Netlify 등은 자동 HTTPS 제공
- ✅ 프로덕션 환경에서만 Service Worker 작동
- ✅ HTTP에서는 Service Worker가 등록되지 않음

### Service Worker 업데이트

Service Worker를 업데이트할 때:

1. **캐시 버전 변경** (`sw.js`의 `CACHE_NAME` 수정)
   ```javascript
   const CACHE_NAME = 'mavs-kr-v2'; // v1 → v2
   ```

2. **배포 후 확인**
   - 사용자는 다음 방문 시 새 버전 자동 다운로드
   - 이전 캐시는 자동 삭제됨

### Manifest 파일 검증

배포 전 확인:

- [Web App Manifest Validator](https://manifest-validator.appspot.com/)
- [PWA Builder](https://www.pwabuilder.com/)

## 🔍 문제 해결

### Manifest가 감지되지 않을 때

1. **파일 경로 확인**
   ```bash
   curl http://localhost:3000/manifest.json
   ```

2. **HTML head 태그 확인**
   - 개발자 도구 > Elements > `<head>` 확인
   - `<link rel="manifest">` 태그 존재 여부 확인

3. **브라우저 캐시 삭제**
   - Ctrl+Shift+R (Windows/Linux)
   - Cmd+Shift+R (Mac)

### Service Worker가 등록되지 않을 때

1. **콘솔 에러 확인**
   - 개발자 도구 > Console 확인
   - Service Worker 등록 오류 메시지 확인

2. **HTTPS 확인**
   - 프로덕션에서는 HTTPS 필수
   - 개발 환경에서는 localhost 허용

3. **파일 경로 확인**
   ```bash
   curl http://localhost:3000/sw.js
   ```

### 아이콘이 표시되지 않을 때

1. **파일 존재 확인**
   ```bash
   ls -lh public/icons/
   ```

2. **파일 권한 확인**
   ```bash
   chmod 644 public/icons/*.png
   ```

3. **아이콘 재생성**
   ```bash
   npm run generate:icons
   ```

## 📚 참고 자료

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev: PWA](https://web.dev/progressive-web-apps/)
- [Next.js: Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

## 🔄 업데이트 이력

- **2025-01-02**: 초기 PWA 설정 완료
  - Manifest 파일 생성
  - Service Worker 구현
  - 아이콘 생성 스크립트 추가
  - iOS 및 Android 지원 설정

