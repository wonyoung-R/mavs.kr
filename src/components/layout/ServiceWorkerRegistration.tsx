'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('Service Worker 등록 완료!', reg.scope);

            // 업데이트 확인
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('새로운 Service Worker가 사용 가능합니다. 페이지를 새로고침하세요.');
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.error('Service Worker 등록 실패:', err);
          });
      });
    }
  }, []);

  return null;
}

