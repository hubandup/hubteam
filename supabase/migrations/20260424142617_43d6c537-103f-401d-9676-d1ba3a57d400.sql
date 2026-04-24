
-- ============================================
-- 1. hubandup_context_cache
-- ============================================
CREATE TABLE IF NOT EXISTS public.hubandup_context_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL UNIQUE,
  summary text,
  last_scraped_at timestamptz,
  last_scrape_status text,
  last_scrape_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hubandup_context_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read hubandup_context_cache"
ON public.hubandup_context_cache FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage hubandup_context_cache"
ON public.hubandup_context_cache FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_hubandup_context_cache_updated_at
BEFORE UPDATE ON public.hubandup_context_cache
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pré-remplir les 3 URLs cibles
INSERT INTO public.hubandup_context_cache (source_url) VALUES
  ('https://www.hubandup.com/'),
  ('https://www.hubandup.com/a-propos'),
  ('https://www.hubandup.com/news')
ON CONFLICT (source_url) DO NOTHING;

-- ============================================
-- 2. google_alerts_cache
-- ============================================
CREATE TABLE IF NOT EXISTS public.google_alerts_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_url text NOT NULL UNIQUE,
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  fetch_status text,
  fetch_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_alerts_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read google_alerts_cache"
ON public.google_alerts_cache FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage google_alerts_cache"
ON public.google_alerts_cache FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_google_alerts_cache_updated_at
BEFORE UPDATE ON public.google_alerts_cache
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. app_config
-- ============================================
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read app_config"
ON public.app_config FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage app_config"
ON public.app_config FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_app_config_updated_at
BEFORE UPDATE ON public.app_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Valeurs par défaut Calendly (modifiables ensuite par admin)
INSERT INTO public.app_config (key, value, description) VALUES
  ('calendly_charles_email', 'charles@hubandup.com', 'Email de Charles Baulu (DG) pour attribution Calendly'),
  ('calendly_amandine_email', 'amandine@hubandup.com', 'Email d''Amandine Blanchard (Dir. Dev.) pour attribution Calendly'),
  ('calendly_charles_url', 'https://calendly.com/hubandup/rdv', 'URL Calendly de Charles'),
  ('calendly_amandine_url', 'https://calendly.com/amandine-hubandup/30min', 'URL Calendly d''Amandine (par défaut)')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 4. Enrichir commercial_scrape_urls
-- ============================================
ALTER TABLE public.commercial_scrape_urls
  ADD COLUMN IF NOT EXISTS last_scrape_error text,
  ADD COLUMN IF NOT EXISTS content_summary text;
