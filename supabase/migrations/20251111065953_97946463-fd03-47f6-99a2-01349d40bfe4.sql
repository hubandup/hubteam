-- Create function to update timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create design settings table
CREATE TABLE public.design_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  heading_font TEXT NOT NULL DEFAULT 'Instrument Sans',
  body_font TEXT NOT NULL DEFAULT 'Roboto',
  light_primary TEXT NOT NULL DEFAULT '210 100% 30%',
  light_secondary TEXT NOT NULL DEFAULT '210 60% 50%',
  light_background TEXT NOT NULL DEFAULT '0 0% 100%',
  dark_primary TEXT NOT NULL DEFAULT '60 100% 70%',
  dark_secondary TEXT NOT NULL DEFAULT '210 60% 60%',
  dark_background TEXT NOT NULL DEFAULT '220 15% 15%',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.design_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for design settings
CREATE POLICY "Everyone can read design settings"
ON public.design_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert design settings"
ON public.design_settings
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update design settings"
ON public.design_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_design_settings_updated_at
BEFORE UPDATE ON public.design_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default design settings
INSERT INTO public.design_settings (heading_font, body_font) VALUES ('Instrument Sans', 'Roboto');