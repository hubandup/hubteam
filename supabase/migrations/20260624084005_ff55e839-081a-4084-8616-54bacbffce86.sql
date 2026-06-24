
CREATE TABLE public.lagostina_budget_synthesis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  levier text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  s1_planned numeric NOT NULL DEFAULT 0,
  s1_spent numeric NOT NULL DEFAULT 0,
  s1_credit numeric,
  s2_budget numeric NOT NULL DEFAULT 0,
  total_year numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lagostina_budget_synthesis TO authenticated;
GRANT ALL ON public.lagostina_budget_synthesis TO service_role;

ALTER TABLE public.lagostina_budget_synthesis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lagostina synthesis readable by authorized"
ON public.lagostina_budget_synthesis FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'team'::app_role)
  OR EXISTS (SELECT 1 FROM public.lagostina_access la WHERE la.user_id = auth.uid() AND la.granted = true)
);

CREATE POLICY "Lagostina synthesis editable by admin/team"
ON public.lagostina_budget_synthesis FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team'::app_role));

CREATE TRIGGER update_lagostina_budget_synthesis_updated_at
BEFORE UPDATE ON public.lagostina_budget_synthesis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.lagostina_budget_synthesis (levier, sort_order, s1_planned, s1_spent, s1_credit, s2_budget, total_year) VALUES
  ('Relations Presse', 1, 30000, 28000, 2000, 25000, 55000),
  ('Influence', 2, 195000, 160000, 35000, 90000, 285000),
  ('Médiatisation', 3, 250000, 87800, 162200, 85000, 335000),
  ('Landing Page', 4, 0, 0, NULL, 4690, 4690),
  ('Maestria & basta', 5, 0, 0, NULL, 0, 0),
  ('Honoraires', 6, 26350, 10900, 15450, 20288, 57538);
