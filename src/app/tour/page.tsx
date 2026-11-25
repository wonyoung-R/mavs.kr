import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { HOME_BLUE } from '@/components/landing/wordmark';
import { getTourLeadConsent, isTourLeadConfigured } from '@/lib/tour-lead';
import TourItinerary from './TourItinerary';
import TourLeadForm from './TourLeadForm';
import TourMotion from './TourMotion';
import { experiences, faqs, games, tour, tourImages } from './tour-data';
import styles from './tour.module.css';

const title = `${tour.title} | MAVS.KR`;
const description = '2027년 1월 29일부터 2월 4일까지, 댈러스 매버릭스 홈경기 세 번과 댈러스·포트워스·알링턴을 함께하는 5박 7일 팬투어.';
const shareImage = { url: tourImages.hero, width: 1536, height: 1024, alt: '댈러스 매버릭스 홈경기장 콘셉트 이미지' };

export const metadata: Metadata = {
  metadataBase: new URL('https://www.mavs.kr'),
  title,
  description,
  alternates: { canonical: '/tour' },
  openGraph: { type: 'website', locale: 'ko_KR', url: '/tour', title, description, images: [shareImage] },
  twitter: { card: 'summary_large_image', title, description, images: [shareImage] },
};

export default function TourPage() {
  const consent = getTourLeadConsent();
  const registrationAvailable = isTourLeadConfigured();

  return (
    <main className={styles.tour} style={{ '--tour-blue': HOME_BLUE } as CSSProperties} data-tour>
      <a className={styles.skip} href="#tour-title">본문 바로가기</a>
      <section className={styles.hero} aria-labelledby="tour-title" data-tour-hero>
        <div className={styles.heroImage} aria-hidden="true">
          <Image
            src={tourImages.hero}
            alt=""
            fill
            preload
            unoptimized
            sizes="100vw"
            data-tour-hero-image
          />
        </div>
        <div className={styles.heroCanvas} aria-hidden="true" data-tour-hero-canvas />
        <header className={styles.header}>
          <Link className={styles.brand} href="/" aria-label="MAVS.KR 홈">MAVS.KR</Link>
          <nav aria-label="MAVS.KR 메뉴">
            <Link href="/tour" aria-current="page">FAN TOUR</Link>
          </nav>
        </header>
        <div className={`${styles.heroContent} ${styles.gutter}`}>
          <h1 id="tour-title" tabIndex={-1}>매버릭스를 만나러,<br />댈러스로.</h1>
          <p className={styles.heroDate}>{tour.date} <span>·</span> {tour.highlights}</p>
          <div className={styles.heroActions}>
            <p>{tour.price} <small>/ 1인</small></p>
            <a className={styles.button} href="#tour-apply" data-tour-hero-cta>투어 안내 받기</a>
          </div>
          <p className={styles.priceNote}>* 상기 비용은 항공요금 및 현지 사정으로 변동될 수 있으며, 변동시 사전 안내 후 진행됩니다.</p>
        </div>
      </section>

      <section className={styles.experiences} aria-label="팬투어에서 만나는 장면">
        {experiences.map((experience) => (
          <figure className={styles.experience} data-tour-experience key={experience.image}>
            <div className={styles.experienceMedia} data-tour-reveal>
              <Image src={experience.image} alt={`${experience.alt} 콘셉트`} fill sizes="(max-width: 800px) 100vw, 60vw" />
            </div>
            <figcaption>{experience.title}</figcaption>
          </figure>
        ))}
      </section>

      <section className={styles.games} aria-label="매버릭스 홈경기 세 경기" data-tour-games>
        <div className={styles.gamesPin} data-tour-games-pin>
          {games.map((game) => (
            <article className={styles.game} key={game.opponent} data-tour-game>
              <div className={styles.gameImage} data-tour-game-image aria-hidden="true">
                <Image src={game.image} alt="" fill sizes="100vw" />
              </div>
              <div className={`${styles.gameCopy} ${styles.gutter}`} data-tour-game-copy>
                <time dateTime={game.isoDate}>{game.date}</time>
                <h2>DALLAS <span>vs</span> {game.opponent}</h2>
              </div>
            </article>
          ))}
        </div>
      </section>

      <TourItinerary />

      <section className={`${styles.stay} ${styles.gutter}`} aria-labelledby="tour-hotel">
        <figure className={styles.stayPhotos} data-tour-reveal>
          <div className={styles.stayExterior}>
            <Image src={tourImages.hotel} alt="호텔 외관 콘셉트" fill sizes="(max-width: 800px) 78vw, 39vw" />
          </div>
          <div className={styles.stayRoom}>
            <Image src={tourImages.room} alt="호텔 객실 콘셉트" fill sizes="(max-width: 800px) 53vw, 27vw" />
          </div>
        </figure>
        <div>
          <h2 id="tour-hotel">{tour.hotel}</h2>
          <p className={styles.note}>AAC 와 도보 15분 내의 거리에 있는 호텔에서.</p>
        </div>
      </section>

      <section className={`${styles.priceSection} ${styles.gutter}`} aria-labelledby="tour-price">
        <div className={styles.priceLead}>
          <div className={styles.priceCopy}>
            <h2 id="tour-price">{tour.price}</h2>
            <p>1인 기준 · {tour.highlights}</p>
            <p className={styles.priceNote}>*상기 비용은 항공 요금 및 현지 사정으로 변동될 수 있으며, 변동 시 사전 안내 후 진행됩니다.</p>
          </div>
          <div className={styles.skyline} data-tour-reveal>
            <Image src={tourImages.skyline} alt="해질 무렵 댈러스 스카이라인 콘셉트" fill sizes="(max-width: 800px) 90vw, (max-width: 1400px) 36vw, 500px" />
          </div>
        </div>
        <div className={styles.faq}>
          <h3>자주 묻는 질문</h3>
          {faqs.map(({ question, answer }) => (
            <details key={question}>
              <summary>{question}<span className={styles.toggle} aria-hidden="true" /></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="tour-apply" className={`${styles.apply} ${styles.gutter}`} aria-labelledby="tour-apply-title" tabIndex={-1}>
        <div className={styles.applyIntro}>
          <h2 id="tour-apply-title">함께가요, 댈러스.</h2>
          <p>등록해주시면, 카카오톡으로 연락드리겠습니다.</p>
        </div>
        <TourLeadForm consent={consent} available={registrationAvailable} />
      </section>

      <aside className={styles.mobileCta} aria-label="팬투어 사전 관심 등록" data-tour-mobile-cta>
        <span>{tour.price} <small>/ 1인</small></span>
        <a className={styles.button} href="#tour-apply">관심 등록</a>
      </aside>
      <TourMotion />
    </main>
  );
}
