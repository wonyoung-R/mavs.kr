-- Pending only: review and apply to the intended Supabase project after approval.
BEGIN;

CREATE TABLE public.matzip_regions (
  id text PRIMARY KEY CHECK (length(id) <= 250),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  parent_id text REFERENCES public.matzip_regions(id),
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 4),
  CHECK ((level = 1) = (parent_id IS NULL))
);

CREATE TABLE public.matzip_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL REFERENCES auth.users(id),
  kakao_place_id text NOT NULL CHECK (kakao_place_id ~ '^[0-9]{1,30}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 150),
  address text NOT NULL CHECK (length(address) BETWEEN 1 AND 300),
  latitude double precision NOT NULL CHECK (latitude BETWEEN 33 AND 39.5),
  longitude double precision NOT NULL CHECK (longitude BETWEEN 124 AND 132),
  region_id text NOT NULL REFERENCES public.matzip_regions(id),
  menu text NOT NULL CHECK (length(menu) BETWEEN 1 AND 120),
  recommendation text NOT NULL CHECK (length(recommendation) BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  blog_url text CHECK (blog_url IS NULL OR blog_url ~ '^https?://'),
  blog_title text,
  review_note text CHECK (length(review_note) <= 1000),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'pending') = (reviewed_by IS NULL AND reviewed_at IS NULL))
);
CREATE UNIQUE INDEX matzip_pending_place ON public.matzip_submissions(kakao_place_id) WHERE status = 'pending';
CREATE INDEX matzip_submission_owner ON public.matzip_submissions(submitted_by, created_at DESC);
CREATE INDEX matzip_submission_queue ON public.matzip_submissions(status, created_at);

-- Only approved records are copied here; pending material never appears in this table.
CREATE TABLE public.matzip_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE REFERENCES public.matzip_submissions(id),
  kakao_place_id text NOT NULL UNIQUE,
  name text NOT NULL,
  address text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN 33 AND 39.5),
  longitude double precision NOT NULL CHECK (longitude BETWEEN 124 AND 132),
  region_id text NOT NULL REFERENCES public.matzip_regions(id),
  menu text NOT NULL,
  recommendation text NOT NULL,
  blog_url text CHECK (blog_url IS NULL OR blog_url ~ '^https?://'),
  blog_title text,
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX matzip_place_region ON public.matzip_places(region_id);

ALTER TABLE public.matzip_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matzip_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matzip_places ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.matzip_regions, public.matzip_submissions, public.matzip_places FROM anon, authenticated;
GRANT SELECT ON public.matzip_regions, public.matzip_places TO anon, authenticated;
GRANT SELECT ON public.matzip_submissions TO authenticated;
GRANT ALL ON public.matzip_regions, public.matzip_submissions, public.matzip_places TO service_role;
CREATE POLICY matzip_regions_read ON public.matzip_regions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY matzip_places_read ON public.matzip_places FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY matzip_submission_own_read ON public.matzip_submissions FOR SELECT TO authenticated USING (submitted_by = (SELECT auth.uid()));
-- Inserts intentionally go through the server: clients cannot forge coordinates or approve themselves.

CREATE FUNCTION public.matzip_submit(p_actor uuid, p_place jsonb, p_regions jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item jsonb; result uuid;
BEGIN
  -- Per-user lock makes the daily limit safe under concurrent requests.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text, 0));
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_actor) THEN
    RAISE EXCEPTION 'Unknown user';
  END IF;
  IF (SELECT count(*) FROM public.matzip_submissions WHERE submitted_by = p_actor AND created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'Daily submission limit' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.matzip_places WHERE kakao_place_id = p_place->>'kakao_place_id') THEN
    RAISE EXCEPTION 'Place already published' USING ERRCODE = '23505';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_regions) LOOP
    INSERT INTO public.matzip_regions(id, name, parent_id, level)
    VALUES (item->>'id', item->>'name', item->>'parent_id', (item->>'level')::smallint)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
  INSERT INTO public.matzip_submissions(submitted_by, kakao_place_id, name, address, latitude, longitude, region_id, menu, recommendation)
  VALUES (p_actor, p_place->>'kakao_place_id', p_place->>'name', p_place->>'address', (p_place->>'latitude')::double precision,
    (p_place->>'longitude')::double precision, p_place->>'region_id', p_place->>'menu', p_place->>'recommendation') RETURNING id INTO result;
  RETURN result;
END;
$$;

CREATE FUNCTION public.matzip_review(p_actor uuid, p_id uuid, p_action text, p_note text, p_blog_url text DEFAULT NULL, p_blog_title text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item public.matzip_submissions; result uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_actor AND lower(email) = 'mavsdotkr@gmail.com' AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Administrator required' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('approve', 'reject') THEN RAISE EXCEPTION 'Invalid review action'; END IF;
  IF p_action = 'reject' AND coalesce(length(trim(p_note)), 0) = 0 THEN RAISE EXCEPTION 'Rejection reason required'; END IF;
  SELECT * INTO item FROM public.matzip_submissions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR item.status <> 'pending' THEN RAISE EXCEPTION 'Submission already reviewed or missing' USING ERRCODE = 'P0002'; END IF;
  IF p_action = 'approve' THEN
    INSERT INTO public.matzip_places(submission_id, kakao_place_id, name, address, latitude, longitude, region_id, menu, recommendation, blog_url, blog_title)
    VALUES (item.id, item.kakao_place_id, item.name, item.address, item.latitude, item.longitude, item.region_id, item.menu, item.recommendation, p_blog_url, p_blog_title)
    RETURNING id INTO result;
  END IF;
  UPDATE public.matzip_submissions SET status = CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
    reviewed_by = p_actor, reviewed_at = now(), review_note = p_note, blog_url = p_blog_url, blog_title = p_blog_title WHERE id = p_id;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.matzip_submit(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.matzip_review(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.matzip_submit(uuid, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.matzip_review(uuid, uuid, text, text, text, text) TO service_role;
COMMIT;
