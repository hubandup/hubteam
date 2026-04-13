CREATE TABLE public.lagostina_top_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  clicks INTEGER,
  impressions INTEGER,
  ctr NUMERIC,
  cpc NUMERIC,
  conversions INTEGER,
  cost NUMERIC,
  revenue NUMERIC,
  roas NUMERIC,
  position_avg NUMERIC,
  week TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.lagostina_top_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users with lagostina access can read top keywords"
  ON public.lagostina_top_keywords FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true));

CREATE POLICY "Authenticated users with lagostina access can insert top keywords"
  ON public.lagostina_top_keywords FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true));

CREATE POLICY "Authenticated users with lagostina access can delete top keywords"
  ON public.lagostina_top_keywords FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true));