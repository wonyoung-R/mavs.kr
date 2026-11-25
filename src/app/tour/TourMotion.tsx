'use client';

import { useEffect, useRef } from 'react';

const unit = (value: number) => Math.max(0, Math.min(1, value));

function fade(start: number, end: number, progress: number) {
  const t = unit((progress - start) / (end - start));
  return t * t * (3 - 2 * t);
}

function paintGames(games: HTMLElement[], progress: number) {
  const fades = [fade(0.27, 0.41, progress), fade(0.59, 0.73, progress)];

  games.forEach((game, index) => {
    const incoming = fades[index - 1] ?? 1;
    const outgoing = fades[index] ?? 0;
    // Keep the outgoing image opaque until the next image completely covers it.
    const imageOpacity = outgoing === 1 ? 0 : incoming;
    const copyOpacity = fade(0.54, 0.86, incoming) * (1 - fade(0.12, 0.44, outgoing));
    const scale = 1 + unit((progress - (index * 0.32 - 0.09)) / 0.43) * 0.025;

    game.style.setProperty('--game-opacity', String(imageOpacity));
    game.style.setProperty('--game-copy-opacity', String(copyOpacity));
    game.style.setProperty('--game-scale', String(scale));
  });
}

function connectMotion(root: HTMLElement, enableHero: boolean, enableParallax: boolean) {
  const hero = root.querySelector<HTMLElement>('[data-tour-hero]');
  const heroImage = hero?.querySelector<HTMLImageElement>('[data-tour-hero-image]');
  const heroHost = hero?.querySelector<HTMLElement>('[data-tour-hero-canvas]');
  const track = root.querySelector<HTMLElement>('[data-tour-games]');
  const pin = track?.querySelector<HTMLElement>('[data-tour-games-pin]');
  const games = Array.from(pin?.querySelectorAll<HTMLElement>('[data-tour-game]') ?? []);
  const experiences = Array.from(root.querySelectorAll<HTMLElement>('[data-tour-experience]'));
  const reveals = root.querySelectorAll<HTMLElement>('[data-tour-reveal]');

  let frame: number | undefined;
  let heroPlane: ReturnType<typeof import('./hero-plane').createHeroPlane>;
  let heroLoading = false;
  let disposed = false;
  const nearby = new Set<Element>();

  function paint() {
    frame = undefined;
    if (document.hidden) return;

    const heroBounds = heroPlane && hero && nearby.has(hero) ? hero.getBoundingClientRect() : null;
    const gamesBounds = track && pin && nearby.has(track) ? track.getBoundingClientRect() : null;
    const gamesTravel = gamesBounds && pin ? Math.max(1, gamesBounds.height - pin.clientHeight) : 1;
    const viewport = window.innerHeight;
    const activeExperiences = enableParallax ? experiences.filter((element) => nearby.has(element)) : [];
    const offsets = activeExperiences.map((element) => {
      const { top, height } = element.getBoundingClientRect();
      const progress = unit(1 - (top + height / 2) / viewport);
      return `${(progress * 32 - 16).toFixed(2)}px`;
    });

    if (heroBounds && heroBounds.height > 0 && heroBounds.bottom > 0 && heroBounds.top < viewport) {
      heroPlane?.draw(unit(-heroBounds.top / heroBounds.height));
    }
    if (gamesBounds) paintGames(games, unit(-gamesBounds.top / gamesTravel));
    activeExperiences.forEach((element, index) => {
      element.style.setProperty('--experience-offset', offsets[index]);
    });
  }

  function schedule() {
    if (frame === undefined && !document.hidden) frame = requestAnimationFrame(paint);
  }

  async function prepareHero() {
    if (disposed || heroLoading || !enableHero || !heroImage || !heroHost) return;
    heroLoading = true;
    try {
      await heroImage.decode();
    } catch {
      if (!disposed) console.error('Tour hero image failed to load', heroImage.currentSrc || heroImage.src);
      return;
    }
    try {
      const { createHeroPlane } = await import('./hero-plane');
      if (disposed) return;
      if (!hero || !nearby.has(hero) || document.hidden) {
        heroLoading = false;
        return;
      }
      heroPlane = createHeroPlane(heroHost, heroImage, schedule);
      if (!heroPlane) heroHost.setAttribute('data-tour-hero-fallback', '');
      schedule();
    } catch {
      // The decoded HTML image remains the complete hero background.
      heroHost.setAttribute('data-tour-hero-fallback', '');
    }
  }

  const visibility = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        nearby.add(entry.target);
        if (entry.target === hero && !document.hidden) void prepareHero();
      } else {
        nearby.delete(entry.target);
      }
    });
    schedule();
  }, { rootMargin: '100px 0px' });

  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.setAttribute('data-tour-in-view', '');
      reveal.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });

  function onDocumentVisibility() {
    if (hero && nearby.has(hero) && !document.hidden) void prepareHero();
    schedule();
  }

  if (track && games.length === 3) {
    paintGames(games, 0);
    track.setAttribute('data-tour-motion', '');
    visibility.observe(track);
  }
  if (enableHero && hero) visibility.observe(hero);
  if (enableParallax) experiences.forEach((element) => visibility.observe(element));
  reveals.forEach((element) => reveal.observe(element));

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  document.addEventListener('visibilitychange', onDocumentVisibility);

  return () => {
    disposed = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
    visibility.disconnect();
    reveal.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('visibilitychange', onDocumentVisibility);
    heroPlane?.dispose();
    heroHost?.removeAttribute('data-tour-hero-fallback');
    track?.removeAttribute('data-tour-motion');
    games.forEach((game) => {
      game.style.removeProperty('--game-opacity');
      game.style.removeProperty('--game-copy-opacity');
      game.style.removeProperty('--game-scale');
    });
    experiences.forEach((element) => element.style.removeProperty('--experience-offset'));
    reveals.forEach((element) => element.removeAttribute('data-tour-in-view'));
  };
}

function observeMobileCta(root: HTMLElement) {
  const apply = root.querySelector('#tour-apply');
  const heroCta = root.querySelector('[data-tour-hero-cta]');
  const mobileCta = root.querySelector('[data-tour-mobile-cta]');
  if (!apply || !heroCta || !mobileCta) return;

  const visibility = new Map<Element, boolean>();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) visibility.set(entry.target, entry.isIntersecting);
    const show = visibility.get(apply) === false && visibility.get(heroCta) === false;
    mobileCta.toggleAttribute('data-tour-cta-visible', show);
    mobileCta.toggleAttribute('inert', !show);
  });
  observer.observe(apply);
  observer.observe(heroCta);

  return () => {
    observer.disconnect();
    mobileCta.removeAttribute('data-tour-cta-visible');
    mobileCta.removeAttribute('inert');
  };
}

export default function TourMotion() {
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = anchor.current?.closest<HTMLElement>('[data-tour]');
    if (!root || !('IntersectionObserver' in window)) return;
    const stopObservingCta = observeMobileCta(root);

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarse = window.matchMedia('(pointer: coarse)');
    const compact = window.matchMedia('(max-width: 767px)');
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const limitedHardware = navigator.hardwareConcurrency <= 4 || (memory !== undefined && memory <= 4);
    let disconnect: (() => void) | undefined;

    function update() {
      disconnect?.();
      disconnect = undefined;
      if (motion.matches || (coarse.matches && limitedHardware)) return;
      const desktop = !coarse.matches && !compact.matches;
      disconnect = connectMotion(root!, desktop, desktop);
    }

    const queries = [motion, coarse, compact];
    queries.forEach((query) => query.addEventListener('change', update));
    update();

    return () => {
      queries.forEach((query) => query.removeEventListener('change', update));
      disconnect?.();
      stopObservingCta?.();
    };
  }, []);

  return <span hidden ref={anchor} />;
}
