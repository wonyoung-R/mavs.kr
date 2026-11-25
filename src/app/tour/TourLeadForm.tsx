'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import styles from './tour.module.css';

type TourConsent = {
  controller: string;
  contact: string;
  retention: string;
  version: string;
};

const intents = ['적극', '상담 후 결정', '관심'];
const trackingKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

export default function TourLeadForm({ available, consent }: { available: boolean; consent: TourConsent | null }) {
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const successHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (success) successHeading.current?.focus();
  }, [success]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || success || !available || !consent) return;

    const inputs = new FormData(event.currentTarget);
    const query = new URLSearchParams(window.location.search);
    const utm = Object.fromEntries(trackingKeys.flatMap((key) => {
      const value = query.get(key);
      return value ? [[key, value.slice(0, 120)]] : [];
    }));
    let referrer = '';
    if (document.referrer) {
      const origin = new URL(document.referrer).origin;
      if (origin !== window.location.origin) referrer = origin;
    }

    submitting.current = true;
    setPending(true);
    setError('');

    try {
      const response = await fetch('/api/tour/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inputs.get('name'),
          phone: inputs.get('phone'),
          partySize: Number(inputs.get('partySize')),
          intent: inputs.get('intent'),
          email: inputs.get('email'),
          instagram: inputs.get('instagram'),
          inquiry: inputs.get('inquiry'),
          privacyConsent: inputs.has('privacyConsent'),
          consentVersion: consent.version,
          marketingConsent: inputs.has('marketingConsent'),
          website: inputs.get('website'),
          utm,
          referrer,
        }),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        setError(typeof result.message === 'string' ? result.message : '등록을 저장하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setSuccess(true);
    } catch {
      setError('등록을 저장하는 중 연결이 끊겼습니다. 입력한 내용으로 다시 시도해 주세요.');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <div>
      {success ? (
        <div className={styles.success} role="status">
          <h3 ref={successHeading} tabIndex={-1}>관심 등록이 완료되었습니다.</h3>
          <p>등록하신 연락처로 상세 일정과 예약 절차를 안내드립니다.</p>
        </div>
      ) : (
        <form
          className={styles.form}
          method="post"
          action="/api/tour/lead"
          onSubmit={submit}
          aria-describedby="tour-registration-note"
          aria-busy={pending}
        >
          <fieldset disabled={pending} className={styles.formFields}>
            <legend className={styles.srOnly}>참가자 정보</legend>
            <label className={styles.field}>
              <span>이름</span>
              <input name="name" autoComplete="name" maxLength={80} required />
            </label>
            <label className={styles.field}>
              <span>연락처</span>
              <input name="phone" type="tel" autoComplete="tel" maxLength={30} required />
            </label>
            <label className={styles.field}>
              <span>참가 인원</span>
              <input name="partySize" type="number" inputMode="numeric" min={1} max={99} step={1} defaultValue={1} required />
            </label>
            <label className={styles.field}>
              <span>참가 의향</span>
              <select name="intent" defaultValue="" required>
                <option value="" disabled>선택해 주세요</option>
                {intents.map((intent) => <option key={intent}>{intent}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>이메일 <small>(선택)</small></span>
              <input name="email" type="email" autoComplete="email" maxLength={254} />
            </label>
            <label className={styles.field}>
              <span>인스타그램 ID <small>(선택)</small></span>
              <input name="instagram" maxLength={31} autoCapitalize="none" spellCheck={false} />
            </label>
            <label className={`${styles.field} ${styles.wide}`}>
              <span>문의사항 <small>(선택)</small></span>
              <textarea name="inquiry" maxLength={1000} rows={3} />
            </label>
            <div className={styles.honeypot} aria-hidden="true">
              <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
            </div>
          </fieldset>
          {consent && (
            <fieldset className={styles.consents} disabled={pending}>
              <legend className={styles.srOnly}>개인정보 및 마케팅 동의</legend>
              <label>
                <input type="checkbox" name="privacyConsent" required aria-describedby="tour-privacy-terms" />
                개인정보 수집·이용에 동의합니다. (필수)
              </label>
              <details className={styles.consentDetails}>
                <summary>개인정보 수집·이용 안내</summary>
                <div id="tour-privacy-terms">
                  <p><strong>수집 주체</strong> {consent.controller}</p>
                  <p><strong>수집 항목</strong> 이름, 연락처, 참가 인원, 참가 의향, 동의 기록과 유입 정보. 이메일, 인스타그램 ID, 문의 내용은 입력한 경우에만 저장합니다.</p>
                  <p><strong>이용 목적</strong> 팬투어 관심 등록 확인, 문의 응답, 일정과 예약 절차 안내.</p>
                  <p><strong>보유 기간</strong> {consent.retention}</p>
                  <p><strong>문의 및 동의 철회</strong> {consent.contact}</p>
                  <p>동의를 거부할 수 있으며, 필수 동의를 거부하면 관심 등록을 접수할 수 없습니다.</p>
                </div>
              </details>
              <label>
                <input type="checkbox" name="marketingConsent" />
                MAVS.KR 팬투어 소식과 마케팅 정보 수신에 동의합니다. (선택)
              </label>
            </fieldset>
          )}
          <div className={styles.formEnd}>
            <button className={styles.button} type="submit" disabled={pending || !available || !consent}>
              {pending ? '등록 중…' : '사전 관심 등록하기'}
            </button>
            {(!available || !consent) && <p className={styles.note}>현재 관심 등록 접수를 준비 중입니다.</p>}
            {error && <p className={styles.formError} role="alert">{error}</p>}
          </div>
        </form>
      )}
      <p className={`${styles.note} ${styles.registrationNote}`} id="tour-registration-note">관심 등록은 예약이나 결제 확정이 아닙니다.</p>
    </div>
  );
}
