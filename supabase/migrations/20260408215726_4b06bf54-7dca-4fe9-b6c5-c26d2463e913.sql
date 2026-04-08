
CREATE TABLE public.lagostina_personas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  priority TEXT NOT NULL,
  persona_name TEXT NOT NULL,
  persona_type TEXT,
  age_range TEXT,
  has_children TEXT,
  market_weight TEXT,
  motivators JSONB DEFAULT '[]',
  barriers JSONB DEFAULT '[]',
  preferred_media TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lagostina_personas"
ON public.lagostina_personas FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can manage lagostina_personas"
ON public.lagostina_personas FOR ALL TO authenticated
USING (has_role(auth.uid(), 'team'::app_role))
WITH CHECK (has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Clients can view lagostina_personas"
ON public.lagostina_personas FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'client'::app_role));

CREATE TABLE public.lagostina_activation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  priority TEXT NOT NULL,
  section TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lagostina_activation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lagostina_activation"
ON public.lagostina_activation FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can manage lagostina_activation"
ON public.lagostina_activation FOR ALL TO authenticated
USING (has_role(auth.uid(), 'team'::app_role))
WITH CHECK (has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Clients can view lagostina_activation"
ON public.lagostina_activation FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'client'::app_role));
