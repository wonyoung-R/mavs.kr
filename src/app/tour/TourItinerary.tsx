'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { itinerary } from './tour-data';
import styles from './tour.module.css';

export default function TourItinerary() {
  const list = useRef<HTMLOListElement>(null);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [visibleDay, setVisibleDay] = useState(0);
  const activePhotos = itinerary[visibleDay].photos;

  useEffect(() => {
    const days = Array.from(list.current?.children ?? []);
    const desktop = window.matchMedia('(min-width: 801px)');
    let frame = 0;

    function updateDay() {
      frame = 0;
      if (!desktop.matches) return;
      const readingLine = window.innerHeight * 0.48;
      const current = days.findLastIndex((day) => day.getBoundingClientRect().top < readingLine);
      setVisibleDay(Math.max(0, current));
    }

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(updateDay);
    }

    updateDay();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, []);

  return (
    <section className={`${styles.itinerary} ${styles.gutter}`} aria-labelledby="tour-itinerary-title">
      <h2 id="tour-itinerary-title">7일, 오직 댈러스.</h2>
      <div className={styles.itineraryLayout}>
        <div className={styles.photoRail} aria-hidden="true">
          {activePhotos && (
            <div className={styles.railComposition} key={activePhotos[0].src}>
              {activePhotos.map((photo, index) => (
                <div className={index === 0 ? styles.railMain : styles.railInset} key={photo.src}>
                  <Image
                    src={photo.src}
                    alt=""
                    fill
                    sizes={index === 0 ? '(max-width: 800px) 1px, (max-width: 1400px) 39vw, 544px' : '200px'}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <ol className={styles.dayList} ref={list}>
            {itinerary.map((day, index) => {
              const dayNumber = String(index + 1).padStart(2, '0');
              const isOpen = openDay === index;
              const mainPhoto = day.photos?.[0];
              const secondPhoto = day.photos?.[1];
              return (
                <li className={styles.day} key={day.date}>
                  <h3>
                    <button
                      type="button"
                      className={styles.dayButton}
                      id={`tour-day-${dayNumber}`}
                      aria-expanded={isOpen}
                      aria-controls={`tour-day-${dayNumber}-details`}
                      onClick={() => {
                        setVisibleDay(index);
                        setOpenDay(isOpen ? null : index);
                      }}
                    >
                      <span className={styles.dayDate}>
                        <span>DAY {dayNumber}</span>
                        <time dateTime={`2027-${day.date.replace('.', '-')}`}>{day.date}</time>
                      </span>
                      <span className={styles.dayCopy}>
                        <span>{day.place}</span>
                        <span>{day.summary}</span>
                      </span>
                      {mainPhoto && (
                        <span className={styles.dayThumb}>
                          <Image src={mainPhoto.src} alt="" fill sizes="(max-width: 800px) 80px, 1px" />
                        </span>
                      )}
                      <span className={styles.toggle} aria-hidden="true" />
                    </button>
                  </h3>
                  <div
                    id={`tour-day-${dayNumber}-details`}
                    className={styles.dayDetails}
                    hidden={!isOpen}
                  >
                    <ul>
                      {day.details.map((detail) => <li key={detail}>{detail}</li>)}
                    </ul>
                    {isOpen && mainPhoto && (
                      <div className={styles.dayMobilePhotos}>
                        <div className={styles.railMain}>
                          <Image src={mainPhoto.src} alt={`${mainPhoto.alt} 콘셉트 이미지`} fill sizes="(max-width: 800px) 88vw, 1px" />
                        </div>
                        {secondPhoto && (
                          <div className={styles.railInset}>
                            <Image src={secondPhoto.src} alt={`${secondPhoto.alt} 콘셉트 이미지`} fill sizes="(max-width: 800px) 35vw, 1px" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className={styles.note}>항공 및 현지 사정에 따라 일정이 변경될 수 있습니다.</p>
        </div>
      </div>
    </section>
  );
}
