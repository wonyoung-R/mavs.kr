const CACHE_NAME = 'mavs-kr-v1';
const urlsToCache = [
  '/',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json'
];

// 설치 이벤트: 캐시에 리소스 저장
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('캐시 열기 완료');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('캐시 저장 실패:', err);
      })
  );
  // 즉시 활성화하여 이전 서비스 워커를 대체
  self.skipWaiting();
});

// 활성화 이벤트: 이전 캐시 정리
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('이전 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  // 즉시 클라이언트 제어권 획득
  return self.clients.claim();
});

// fetch 이벤트: 네트워크 우선, 실패 시 캐시 사용
self.addEventListener('fetch', event => {
  // GET 요청만 처리
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 응답이 유효한 경우 캐시에 저장
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패 시 캐시에서 찾기
        return caches.match(event.request).then(response => {
          return response || new Response('오프라인입니다', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

