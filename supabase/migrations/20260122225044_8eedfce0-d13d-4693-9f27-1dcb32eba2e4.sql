-- Create email templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage email_templates"
  ON public.email_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can manage email_templates"
  ON public.email_templates FOR ALL
  USING (has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Agency can view email_templates"
  ON public.email_templates FOR SELECT
  USING (has_role(auth.uid(), 'agency'::app_role));

CREATE POLICY "require_authentication_email_templates"
  ON public.email_templates FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Create storage bucket for email images
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-images', 'email-images', true);

-- Storage policies for email images
CREATE POLICY "Authenticated users can upload email images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'email-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view email images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'email-images');

CREATE POLICY "Users can delete their own email images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'email-images' AND auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();