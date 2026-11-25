-- Pending: apply to the application PostgreSQL database after approval.
-- Verify that the DATABASE_URL login is the table owner or the trusted mavs_app role below.
BEGIN;

CREATE TYPE public."TourLeadStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CONTACTED', 'ON_HOLD');

CREATE TABLE public.tour_leads (
  "id" TEXT PRIMARY KEY,
  "submissionKey" CHAR(64) NOT NULL CHECK ("submissionKey" ~ '^[0-9a-f]{64}$'),
  "name" VARCHAR(80) NOT NULL,
  "phone" VARCHAR(16) NOT NULL CHECK ("phone" ~ '^[+]?[0-9]{7,15}$'),
  "email" VARCHAR(254),
  "instagram" VARCHAR(30),
  "partySize" INTEGER NOT NULL CHECK ("partySize" BETWEEN 1 AND 99),
  "intent" VARCHAR(20) NOT NULL CHECK ("intent" IN ('적극', '상담 후 결정', '관심')),
  "inquiry" VARCHAR(1000),
  "attribution" TEXT,
  "consentVersion" VARCHAR(80) NOT NULL,
  "consentedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "marketingConsent" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" public."TourLeadStatus" NOT NULL DEFAULT 'NEW',
  "adminNote" VARCHAR(2000) NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);

CREATE UNIQUE INDEX "tour_leads_submissionKey_key" ON public.tour_leads ("submissionKey");
CREATE INDEX "tour_leads_createdAt_id_idx" ON public.tour_leads ("createdAt", "id");
CREATE INDEX "tour_leads_status_createdAt_id_idx" ON public.tour_leads ("status", "createdAt", "id");

ALTER TABLE public.tour_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tour_leads FROM PUBLIC;

DO $roles$
DECLARE
  api_role TEXT;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.tour_leads FROM %I', api_role);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mavs_app') THEN
    GRANT SELECT, INSERT, UPDATE ("status", "adminNote", "updatedAt") ON TABLE public.tour_leads TO mavs_app;
    CREATE POLICY tour_leads_app ON public.tour_leads TO mavs_app USING (TRUE) WITH CHECK (TRUE);
  END IF;
END;
$roles$;

COMMIT;
