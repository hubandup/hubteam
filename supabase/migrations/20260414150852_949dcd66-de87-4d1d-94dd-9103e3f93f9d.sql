CREATE TABLE public.lagostina_affiliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week TEXT NOT NULL,
  month TEXT,
  influencer_count INTEGER,
  reach_millions NUMERIC,
  budget_mois NUMERIC,
  engagement_rate NUMERIC,
  emv NUMERIC,
  conversion_rate NUMERIC,
  cost_per_reach NUMERIC,
  cpm NUMERIC,
  impressions_globales NUMERIC,
  reel_engagement NUMERIC,
  stories_clics_vues NUMERIC,
  stories_clics_mentions NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_affiliation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read affiliation data"
  ON public.lagostina_affiliation FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert affiliation data"
  ON public.lagostina_affiliation FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete affiliation data"
  ON public.lagostina_affiliation FOR DELETE TO authenticated USING (true);