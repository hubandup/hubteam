
CREATE TABLE public.lagostina_sea_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  campaign text NOT NULL,
  roas numeric,
  cpc numeric,
  ctr numeric,
  impressions integer,
  conversions numeric,
  budget_spent numeric,
  budget_allocated numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, campaign)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lagostina_sea_campaigns TO authenticated;
GRANT ALL ON public.lagostina_sea_campaigns TO service_role;

ALTER TABLE public.lagostina_sea_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lagostina_sea_campaigns_select" ON public.lagostina_sea_campaigns
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'team'::app_role)
  OR EXISTS (SELECT 1 FROM lagostina_access WHERE user_id = auth.uid() AND granted = true)
);

CREATE POLICY "lagostina_sea_campaigns_write" ON public.lagostina_sea_campaigns
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'team'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'team'::app_role)
);

CREATE TRIGGER update_lagostina_sea_campaigns_updated_at
BEFORE UPDATE ON public.lagostina_sea_campaigns
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
