'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import type { Place } from '@/lib/matzip/types';
import styles from './matzip.module.css';

// The SDK is loaded only on the map page, without adding a client dependency.
declare global { interface Window { kakao?: any } }

export default function MatzipMap({ places, selected, onSelect }: { places: Place[]; selected: string | null; onSelect: (id: string) => void }) {
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ready && window.kakao?.maps) return;
    const timer = setTimeout(() => setFailed(true), 12000);
    return () => clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (!ready || !host.current) return;
    const sdk = window.kakao.maps;
    if (!map.current) map.current = new sdk.Map(host.current, { center: new sdk.LatLng(36.3, 127.8), level: 13 });
    const bounds = new sdk.LatLngBounds();
    const markers = places.map(place => {
      const point = new sdk.LatLng(place.latitude, place.longitude);
      bounds.extend(point);
      const marker = new sdk.Marker({ position: point, map: map.current, title: place.name });
      sdk.event.addListener(marker, 'click', () => onSelect(place.id));
      return marker;
    });
    if (places.length === 1) { map.current.setCenter(bounds.getSouthWest()); map.current.setLevel(4); }
    else if (places.length) map.current.setBounds(bounds);
    else { map.current.setCenter(new sdk.LatLng(36.3, 127.8)); map.current.setLevel(13); }
    const clusterer = new sdk.MarkerClusterer({ map: map.current, averageCenter: true, minLevel: 7, markers });
    return () => { clusterer.clear(); markers.forEach(marker => marker.setMap(null)); };
  }, [places, ready, onSelect]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const place = places.find(item => item.id === selected);
    if (place) {
      map.current.setLevel(4);
      map.current.panTo(new window.kakao.maps.LatLng(place.latitude, place.longitude));
    }
  }, [selected, ready, places]);

  const load = () => window.kakao?.maps?.load(() => { setReady(true); setFailed(false); });
  return <div className={styles.mapFrame}>
    {key && <Script id="matzip-kakao-map" src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=clusterer`} onReady={load} onError={() => setFailed(true)} />}
    <div ref={host} className={styles.map} aria-label="대한민국 맛집 지도" />
    {(!key || failed) && <div className={styles.mapFallback}><span aria-hidden="true">↗</span><strong>지도 연결을 준비하고 있어요.</strong><p>아래 목록에서 맛집과 길찾기를 확인할 수 있습니다.</p></div>}
    {key && !ready && !failed && <div className={styles.mapFallback} role="status">지도를 불러오는 중입니다…</div>}
    <div className={styles.mapTag}>MFFL FOOD MAP <span>대한민국</span></div>
  </div>;
}
