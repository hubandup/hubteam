CREATE TABLE public.lagostina_tiktok_top_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text NOT NULL,
  ad_name text NOT NULL,
  content_url text,
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  ctr numeric,
  conversions bigint DEFAULT 0,
  cvr numeric,
  spend_usd numeric,
  cpc_usd numeric,
  cpa_usd numeric,
  roas_finalisation numeric,
  period_start date,
  period_end date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lagostina_tiktok_top_ads TO authenticated;
GRANT ALL ON public.lagostina_tiktok_top_ads TO service_role;

ALTER TABLE public.lagostina_tiktok_top_ads ENABLE ROW LEVEL SECURITY;

-- Reuse the same access policy as other lagostina_* tables: admin/team always, and clients/agencies with explicit access
CREATE POLICY "Lagostina top ads readable by authorized users"
ON public.lagostina_tiktok_top_ads
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'team'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.lagostina_access la WHERE la.user_id = auth.uid()
  )
);

CREATE POLICY "Lagostina top ads manageable by admin/team"
ON public.lagostina_tiktok_top_ads
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team'::app_role));