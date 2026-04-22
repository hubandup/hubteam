ALTER TABLE public.commercial_followup_suggestions
  ADD COLUMN IF NOT EXISTS action_key text,
  ADD COLUMN IF NOT EXISTS action_label text;