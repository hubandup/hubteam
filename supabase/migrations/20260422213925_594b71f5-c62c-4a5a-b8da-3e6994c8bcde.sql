CREATE TABLE IF NOT EXISTS public.hubandup_site_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  title text,
  content text NOT NULL,
  scraped_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hubandup_site_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can read hubandup cache"
ON public.hubandup_site_cache
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

CREATE INDEX idx_hubandup_cache_scraped_at ON public.hubandup_site_cache(scraped_at);