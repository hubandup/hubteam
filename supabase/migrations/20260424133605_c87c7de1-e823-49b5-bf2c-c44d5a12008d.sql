-- Extend commercial_notes to fully replace meeting_notes structure
ALTER TABLE public.commercial_notes
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS meeting_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;