'use client';

import Link from 'next/link';
import CourtReveal from './CourtReveal';
import { HOME_BLUE, WORDMARK_PATHS, WORDMARK_VIEWBOX } from './wordmark';
import styles from './landing.module.css';

const instagram = 'https://www.instagram.com/mavs.kr/';

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? 'M5 19 19 5M5 5h14v14' : 'M3 12h17m-7-7 7 7-7 7'} stroke="currentColor" strokeWidth="1.5" /></svg>;
}

export default function LandingHome({ youtubeUrl }: { youtubeUrl?: string }) {

  return (
    <main className={styles.home} style={{ '--ink': HOME_BLUE } as React.CSSProperties}>
      <a className={styles.skip} href="#home-links">바로가기 메뉴로 이동</a>
      <div className={styles.court} aria-hidden="true">
        {/* Generated hardwood and the existing official team artwork remain separate. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.courtImage} src="/images/home/dallas-court.webp" alt="" fetchPriority="high" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.courtLogo} src="/images/logos/mavericks.svg" alt="" />
      </div>
      <div className={styles.paper} />
      <div className={styles.wordmarkWrap}>
        <h1 className={styles.wordmark} aria-label="MAVS.KR">
          <svg data-wordmark viewBox={WORDMARK_VIEWBOX} role="img" aria-label="MAVS.KR" fill="currentColor" fillRule="evenodd">
            {WORDMARK_PATHS.map((d, i) => <path key={i} d={d} style={{ '--letter': i } as React.CSSProperties} />)}
          </svg>
        </h1>
      </div>
      <CourtReveal />
      <header className={styles.header} style={{ color: HOME_BLUE, mixBlendMode: 'normal' }}>
        <Link href="/" className={styles.brand} aria-label="MAVS.KR 홈">MAVS.KR</Link>
        <div className={styles.headerNote}>DALLAS BASKETBALL.<br />KOREAN PERSPECTIVE.</div>
      </header>
      <div className={styles.intro}>
        <p>댈러스의 모든 순간,<br />우리의 시선으로.</p>
      </div>
      <div className={styles.interactionHint} aria-hidden="true"><span className={styles.hintDot} style={{ background: HOME_BLUE }} /><span className={styles.mouseHint}>MOVE TO FIND YOUR COURT</span><span className={styles.touchHint}>TOUCH TO FIND YOUR COURT</span></div>
      <footer className={styles.footer} style={{ color: HOME_BLUE, mixBlendMode: 'normal' }}>
        <p>A HOME FOR<br className={styles.mobileBreak} /> MAVERICKS FANS.</p>
        <nav id="home-links" aria-label="MAVS.KR 바로가기" className={styles.footerLinks}>
          <a href={youtubeUrl ?? 'https://www.youtube.com/@mavsnba9284'} target="_blank" rel="noopener noreferrer">YOUTUBE<Arrow diagonal /></a>
          <a href={instagram} target="_blank" rel="noopener noreferrer">INSTAGRAM<Arrow diagonal /></a>
          <Link href="/stat">STAT ARCHIVE<Arrow /></Link>
          <Link href="/matzip">MFFL 맛집 지도<Arrow /></Link>
          <Link href="/tour">FAN TOUR<Arrow /></Link>
        </nav>
        <span className={styles.est}>DALLAS ↔ KOREA</span>
      </footer>
    </main>
  );
}
