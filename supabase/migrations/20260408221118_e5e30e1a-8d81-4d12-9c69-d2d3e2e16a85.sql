
-- Media KPIs table
CREATE TABLE public.lagostina_media_kpis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL,
  kpi_name TEXT NOT NULL,
  week TEXT NOT NULL,
  actual NUMERIC,
  objective NUMERIC,
  budget_spent NUMERIC,
  budget_allocated NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_media_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage lagostina_media_kpis"
ON public.lagostina_media_kpis FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'));

CREATE POLICY "Clients can view lagostina_media_kpis"
ON public.lagostina_media_kpis FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'client'));

-- Consumer table
CREATE TABLE public.lagostina_consumer (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  scope TEXT,
  value_current TEXT,
  vs_reference TEXT,
  vs_brand TEXT,
  comment TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_consumer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage lagostina_consumer"
ON public.lagostina_consumer FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'));

CREATE POLICY "Clients can view lagostina_consumer"
ON public.lagostina_consumer FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'client'));

-- R&R table
CREATE TABLE public.lagostina_rnr (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  product_name TEXT NOT NULL,
  week TEXT NOT NULL,
  avg_score NUMERIC,
  review_count INTEGER,
  comments_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_rnr ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage lagostina_rnr"
ON public.lagostina_rnr FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'));

CREATE POLICY "Clients can view lagostina_rnr"
ON public.lagostina_rnr FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'client'));

-- Contenus table
CREATE TABLE public.lagostina_contenus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  ready BOOLEAN DEFAULT false,
  quality_assessment TEXT DEFAULT 'not_assessed',
  variations TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_contenus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage lagostina_contenus"
ON public.lagostina_contenus FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'));

CREATE POLICY "Clients can view lagostina_contenus"
ON public.lagostina_contenus FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'client'));

-- Social mix table
CREATE TABLE public.lagostina_social_mix (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_social_mix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage lagostina_social_mix"
ON public.lagostina_social_mix FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'));

CREATE POLICY "Clients can view lagostina_social_mix"
ON public.lagostina_social_mix FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'client'));

-- Content learnings table
CREATE TABLE public.lagostina_content_learnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  learning TEXT NOT NULL,
  associated_metric TEXT,
  action TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_content_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage lagostina_content_learnings"
ON public.lagostina_content_learnings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'));

CREATE POLICY "Clients can view lagostina_content_learnings"
ON public.lagostina_content_learnings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'client'));
