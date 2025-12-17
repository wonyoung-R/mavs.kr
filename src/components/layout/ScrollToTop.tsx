'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * 페이지 변경 시 자동으로 최상단으로 스크롤하는 컴포넌트
 * 홈페이지(/) 제외
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // 홈페이지가 아닌 경우에만 최상단으로 스크롤
    if (pathname !== '/') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [pathname]);

  return null;
}

