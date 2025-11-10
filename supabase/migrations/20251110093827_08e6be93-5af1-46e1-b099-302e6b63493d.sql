-- Create activity_sectors table
CREATE TABLE IF NOT EXISTS public.activity_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create client_statuses table
CREATE TABLE IF NOT EXISTS public.client_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add activity_sector_id and status_id to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS activity_sector_id UUID REFERENCES public.activity_sectors(id),
ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES public.client_statuses(id);

-- Add attachment_url to meeting_notes table
ALTER TABLE public.meeting_notes
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Insert default activity sectors
INSERT INTO public.activity_sectors (name, color) VALUES
  ('Retail', 'hsl(210, 100%, 50%)'),
  ('Sécurité', 'hsl(0, 70%, 50%)'),
  ('Santé', 'hsl(120, 60%, 45%)'),
  ('Automobile', 'hsl(30, 90%, 50%)'),
  ('Institution', 'hsl(240, 60%, 55%)'),
  ('Industrie', 'hsl(180, 50%, 45%)'),
  ('Sport', 'hsl(270, 70%, 55%)'),
  ('Loisirs', 'hsl(300, 60%, 50%)')
ON CONFLICT (name) DO NOTHING;

-- Insert default client statuses
INSERT INTO public.client_statuses (name, color) VALUES
  ('À appeler', 'hsl(200, 70%, 50%)'),
  ('À rappeler', 'hsl(30, 80%, 55%)'),
  ('Bloqué', 'hsl(0, 60%, 50%)'),
  ('Rendez-vous', 'hsl(150, 60%, 50%)'),
  ('RDV Pitch', 'hsl(280, 70%, 55%)'),
  ('Reco en cours', 'hsl(50, 80%, 55%)'),
  ('Client', 'hsl(140, 70%, 45%)'),
  ('À fidéliser', 'hsl(320, 60%, 55%)'),
  ('Sans suite', 'hsl(0, 0%, 50%)')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS on new tables
ALTER TABLE public.activity_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_statuses ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity_sectors
CREATE POLICY "Everyone can view activity_sectors"
ON public.activity_sectors FOR SELECT
USING (true);

CREATE POLICY "Admins can manage activity_sectors"
ON public.activity_sectors FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for client_statuses
CREATE POLICY "Everyone can view client_statuses"
ON public.client_statuses FOR SELECT
USING (true);

CREATE POLICY "Admins can manage client_statuses"
ON public.client_statuses FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));