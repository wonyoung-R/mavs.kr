'use client';

import { useEffect, useRef, useState } from 'react';
import { wordmarkSvg } from './wordmark';

/** The DOM stays usable while the optional WebGL layer loads or is unavailable. */
export default function CourtReveal() {
  const host = useRef<HTMLDivElement>(null);
  const [motionAllowed, setMotionAllowed] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionAllowed(!motion.matches);
    update();
    motion.addEventListener('change', update);
    return () => motion.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!element || !motionAllowed) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const timer = window.setTimeout(async () => {
      try {
        const { createCourtFluid } = await import('./court-fluid');
        if (disposed) return;
        cleanup = await createCourtFluid(element, wordmarkSvg());
        if (disposed) cleanup?.();
      } catch {
        // Keep the complete, accessible static homepage when WebGL is unavailable.
        if (!disposed) element.closest('main')?.setAttribute('data-reveal', 'unavailable');
      }
    }, 1400);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      cleanup?.();
    };
  }, [motionAllowed]);

  return <div ref={host} className="court-reveal-host" aria-hidden="true" />;
}
