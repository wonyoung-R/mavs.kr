import 'server-only';

import { createHmac } from 'node:crypto';
import { getTourPrisma } from '@/lib/db/tour-prisma';

export type TourLeadSubmission = {
  name: string;
  phone: string;
  email: string;
  instagram: string;
  partySize: number;
  intent: string;
  inquiry: string;
  consentVersion: string;
  marketingConsent: boolean;
  attribution: string;
};

export function getTourLeadConsent() {
  const controller = process.env.TOUR_LEAD_CONTROLLER?.trim();
  const contact = process.env.TOUR_LEAD_PRIVACY_CONTACT?.trim();
  const retention = process.env.TOUR_LEAD_RETENTION?.trim();
  const version = process.env.TOUR_LEAD_CONSENT_VERSION?.trim();
  return controller && contact && retention && version && version.length <= 80
    ? { controller, contact, retention, version }
    : null;
}

function getDedupeSecret() {
  const secret = process.env.TOUR_LEAD_DEDUPE_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

export function isTourLeadConfigured() {
  return Boolean(getTourLeadConsent() && process.env.TOUR_DATABASE_URL?.trim() && getDedupeSecret());
}

export async function saveTourLead(lead: TourLeadSubmission) {
  const secret = getDedupeSecret();
  if (!secret) throw new Error('TOUR_LEAD_DATABASE_UNAVAILABLE');

  const { name, phone, email, instagram, partySize, intent, inquiry, consentVersion, marketingConsent, attribution } = lead;
  const submissionKey = createHmac('sha256', secret)
    .update(JSON.stringify([name, phone, email, instagram, partySize, intent, inquiry, consentVersion, marketingConsent]))
    .digest('hex');

  const { count } = await getTourPrisma().tourLead.createMany({
    data: {
      submissionKey,
      name,
      phone,
      email: email || null,
      instagram: instagram || null,
      partySize,
      intent,
      inquiry: inquiry || null,
      attribution: attribution || null,
      consentVersion,
      marketingConsent,
    },
    skipDuplicates: true,
  });

  if (count === 0) {
    // A retry can report success when this exact submission already exists.
    const saved = await getTourPrisma().tourLead.findUnique({ where: { submissionKey }, select: { id: true } });
    if (!saved) throw new Error('TOUR_LEAD_INSERT_NOT_CONFIRMED');
  }
}
