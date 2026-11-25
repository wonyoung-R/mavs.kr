export const tourLeadStatuses = {
  NEW: '신규',
  IN_PROGRESS: '상담 중',
  CONTACTED: '안내 완료',
  ON_HOLD: '보류',
} as const;

export type TourLeadStatus = keyof typeof tourLeadStatuses;
export const tourAdminNoteLimit = 2000;

export type TourAdminLead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  instagram: string | null;
  partySize: number;
  intent: string;
  inquiry: string | null;
  attribution: string | null;
  consentVersion: string;
  consentedAt: string;
  marketingConsent: boolean;
  status: TourLeadStatus;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
};
