
CREATE TABLE public.lagostina_learnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  levier TEXT NOT NULL,
  works TEXT,
  does_not_work TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage lagostina_learnings"
  ON public.lagostina_learnings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Clients can view lagostina_learnings"
  ON public.lagostina_learnings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client'::app_role));

CREATE TABLE public.lagostina_glossary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  levier TEXT,
  recc_category TEXT,
  kpi_name TEXT NOT NULL UNIQUE,
  definition TEXT NOT NULL,
  source TEXT
);

ALTER TABLE public.lagostina_glossary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage lagostina_glossary"
  ON public.lagostina_glossary FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Clients can view lagostina_glossary"
  ON public.lagostina_glossary FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client'::app_role));
