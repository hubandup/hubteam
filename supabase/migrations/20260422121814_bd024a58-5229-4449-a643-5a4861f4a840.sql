-- ============================================
-- Suivi commercial: enum statut
-- ============================================
DO $$ BEGIN
  CREATE TYPE public.commercial_status AS ENUM ('to_contact', 'to_followup', 'do_not_followup', 'client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- Table principale: commercial_tracking (1 par client)
-- ============================================
CREATE TABLE IF NOT EXISTS public.commercial_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  status public.commercial_status NOT NULL DEFAULT 'to_contact',
  company_logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.commercial_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commercial_tracking"
  ON public.commercial_tracking FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_commercial_tracking_updated_at
  BEFORE UPDATE ON public.commercial_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Contacts additionnels
-- ============================================
CREATE TABLE IF NOT EXISTS public.commercial_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id UUID NOT NULL REFERENCES public.commercial_tracking(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  job_title TEXT,
  email TEXT,
  phone TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commercial_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage commercial_contacts"
  ON public.commercial_contacts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_commercial_contacts_updated_at
  BEFORE UPDATE ON public.commercial_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Notes / commentaires
-- ============================================
CREATE TABLE IF NOT EXISTS public.commercial_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id UUID NOT NULL REFERENCES public.commercial_tracking(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commercial_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage commercial_notes"
  ON public.commercial_notes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_commercial_notes_updated_at
  BEFORE UPDATE ON public.commercial_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_commercial_notes_tracking ON public.commercial_notes(tracking_id, created_at DESC);

-- ============================================
-- Étapes de rendez-vous
-- meeting_type: first_contact (avec source_type=linkedin/event/network), hub_date, rdv1, rdv2, custom
-- ============================================
CREATE TABLE IF NOT EXISTS public.commercial_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id UUID NOT NULL REFERENCES public.commercial_tracking(id) ON DELETE CASCADE,
  meeting_type TEXT NOT NULL,
  label TEXT,
  source_type TEXT, -- linkedin, event, network (uniquement pour first_contact)
  meeting_date TIMESTAMPTZ,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commercial_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage commercial_meetings"
  ON public.commercial_meetings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_commercial_meetings_updated_at
  BEFORE UPDATE ON public.commercial_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Questionnaire (key-value pour rester flexible + ajout de questions)
-- ============================================
CREATE TABLE IF NOT EXISTS public.commercial_questionnaire (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id UUID NOT NULL REFERENCES public.commercial_tracking(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  question_label TEXT NOT NULL,
  answer TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tracking_id, question_key)
);
ALTER TABLE public.commercial_questionnaire ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage commercial_questionnaire"
  ON public.commercial_questionnaire FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_commercial_questionnaire_updated_at
  BEFORE UPDATE ON public.commercial_questionnaire
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- URLs à scrapper pour relances IA
-- ============================================
CREATE TABLE IF NOT EXISTS public.commercial_scrape_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id UUID NOT NULL REFERENCES public.commercial_tracking(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT,
  last_scraped_at TIMESTAMPTZ,
  last_scrape_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commercial_scrape_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage commercial_scrape_urls"
  ON public.commercial_scrape_urls FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_commercial_scrape_urls_updated_at
  BEFORE UPDATE ON public.commercial_scrape_urls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Targets (étoiles partagées par toute l'équipe)
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  starred_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view targets"
  ON public.client_targets FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can add targets"
  ON public.client_targets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can remove targets"
  ON public.client_targets FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- Storage bucket pour logos commercial tracking (réutilise client-logos en public)
-- ============================================