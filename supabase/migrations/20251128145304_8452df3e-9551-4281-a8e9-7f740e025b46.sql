-- Create client_sources table
CREATE TABLE IF NOT EXISTS public.client_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.client_sources ENABLE ROW LEVEL SECURITY;

-- Create policies for client_sources
CREATE POLICY "Everyone can view client_sources"
ON public.client_sources
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage client_sources"
ON public.client_sources
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add source_id column to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.client_sources(id) ON DELETE SET NULL;

-- Insert default sources
INSERT INTO public.client_sources (name, color) VALUES
  ('Recommandation', '#10b981'),
  ('Site web', '#3b82f6'),
  ('Réseaux sociaux', '#8b5cf6'),
  ('Publicité', '#f59e0b'),
  ('Événement', '#ec4899'),
  ('Autre', '#6b7280')
ON CONFLICT DO NOTHING;