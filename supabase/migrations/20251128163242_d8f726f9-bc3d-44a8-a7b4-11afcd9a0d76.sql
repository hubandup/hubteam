-- Create agency_tags table for predefined tags
CREATE TABLE IF NOT EXISTS public.agency_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agency_tags ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read tags
CREATE POLICY "Everyone can view agency_tags"
  ON public.agency_tags
  FOR SELECT
  USING (true);

-- Only admins can manage tags
CREATE POLICY "Admins can manage agency_tags"
  ON public.agency_tags
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_agency_tags_updated_at
  BEFORE UPDATE ON public.agency_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();