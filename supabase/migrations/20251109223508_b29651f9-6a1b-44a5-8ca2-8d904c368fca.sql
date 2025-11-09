-- Add logo_url column to agencies table
ALTER TABLE public.agencies ADD COLUMN logo_url text;

-- Create agency_contacts table
CREATE TABLE public.agency_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on agency_contacts
ALTER TABLE public.agency_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for agency_contacts
CREATE POLICY "Admins can manage agency_contacts"
ON public.agency_contacts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can view agency_contacts"
ON public.agency_contacts
FOR SELECT
USING (has_role(auth.uid(), 'team'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_agency_contacts_updated_at
BEFORE UPDATE ON public.agency_contacts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create storage bucket for agency logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('agency-logos', 'agency-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for agency logos
CREATE POLICY "Agency logos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'agency-logos');

CREATE POLICY "Admins can upload agency logos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'agency-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update agency logos"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'agency-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete agency logos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'agency-logos' AND has_role(auth.uid(), 'admin'::app_role));