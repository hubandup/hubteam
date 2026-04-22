-- Table historique des suggestions de relance générées par l'IA
CREATE TABLE public.commercial_followup_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_id UUID NOT NULL REFERENCES public.commercial_tracking(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tone TEXT NOT NULL DEFAULT 'friendly',
  recipient_email TEXT,
  recipient_name TEXT,
  subject TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  angles JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_model_output TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_followup_suggestions_tracking ON public.commercial_followup_suggestions(tracking_id, created_at DESC);
CREATE INDEX idx_followup_suggestions_client ON public.commercial_followup_suggestions(client_id, created_at DESC);

ALTER TABLE public.commercial_followup_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can view followup suggestions"
ON public.commercial_followup_suggestions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Admin and team can insert followup suggestions"
ON public.commercial_followup_suggestions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Admin and team can delete followup suggestions"
ON public.commercial_followup_suggestions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team'::app_role));