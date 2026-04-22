CREATE TABLE IF NOT EXISTS public.slack_excuses_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  excuse TEXT NOT NULL,
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slack_excuses_history_posted_at ON public.slack_excuses_history(posted_at DESC);

ALTER TABLE public.slack_excuses_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and team can view excuses history"
ON public.slack_excuses_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'));