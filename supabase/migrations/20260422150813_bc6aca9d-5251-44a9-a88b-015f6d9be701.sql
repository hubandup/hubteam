ALTER TABLE public.target_relance_notifications
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'status_to_followup';
CREATE INDEX IF NOT EXISTS idx_relance_notif_event_type ON public.target_relance_notifications(event_type);
ALTER TABLE public.commercial_scrape_urls
  ADD COLUMN IF NOT EXISTS last_scrape_content text;
ALTER TABLE public.commercial_scrape_urls
  ADD COLUMN IF NOT EXISTS last_scrape_status text;