
-- Create new prospection_contacts table (completely separate from CRM)
CREATE TABLE public.prospection_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  job_title TEXT DEFAULT '',
  linkedin_url TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'added_linkedin',
  notes TEXT DEFAULT '',
  owner_id UUID REFERENCES auth.users(id),
  linked_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prospection_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "require_auth_prospection_contacts" ON public.prospection_contacts
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage prospection_contacts" ON public.prospection_contacts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can manage prospection_contacts" ON public.prospection_contacts
  FOR ALL USING (has_role(auth.uid(), 'team'::app_role));

-- Updated at trigger
CREATE TRIGGER update_prospection_contacts_updated_at
  BEFORE UPDATE ON public.prospection_contacts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.prospection_contacts;

-- Index on stage for kanban queries
CREATE INDEX idx_prospection_contacts_stage ON public.prospection_contacts(stage);
CREATE INDEX idx_prospection_contacts_owner ON public.prospection_contacts(owner_id);
