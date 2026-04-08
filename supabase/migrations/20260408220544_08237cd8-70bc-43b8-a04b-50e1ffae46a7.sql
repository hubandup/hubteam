
-- Table influence hebdomadaire
CREATE TABLE public.lagostina_influence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week TEXT NOT NULL,
  influencer_count INTEGER,
  influencer_count_obj INTEGER,
  reach_millions NUMERIC,
  reach_millions_obj NUMERIC,
  engagement_rate NUMERIC,
  engagement_rate_obj NUMERIC,
  vtf NUMERIC,
  vtf_obj NUMERIC,
  conversion_rate NUMERIC,
  conversion_rate_obj NUMERIC,
  cost_per_reach NUMERIC,
  cost_per_reach_obj NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_influence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lagostina_influence_select" ON public.lagostina_influence
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "lagostina_influence_admin_insert" ON public.lagostina_influence
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role_safe(auth.uid()) IN ('admin', 'team'));

CREATE POLICY "lagostina_influence_admin_update" ON public.lagostina_influence
  FOR UPDATE TO authenticated
  USING (public.get_user_role_safe(auth.uid()) IN ('admin', 'team'));

CREATE POLICY "lagostina_influence_admin_delete" ON public.lagostina_influence
  FOR DELETE TO authenticated
  USING (public.get_user_role_safe(auth.uid()) IN ('admin', 'team'));

-- Table revue de presse
CREATE TABLE public.lagostina_press (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  media_name TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  tonality TEXT NOT NULL DEFAULT 'neutral',
  estimated_reach INTEGER,
  journalist_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_press ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lagostina_press_select" ON public.lagostina_press
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "lagostina_press_admin_insert" ON public.lagostina_press
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role_safe(auth.uid()) IN ('admin', 'team'));

CREATE POLICY "lagostina_press_admin_update" ON public.lagostina_press
  FOR UPDATE TO authenticated
  USING (public.get_user_role_safe(auth.uid()) IN ('admin', 'team'));

CREATE POLICY "lagostina_press_admin_delete" ON public.lagostina_press
  FOR DELETE TO authenticated
  USING (public.get_user_role_safe(auth.uid()) IN ('admin', 'team'));
