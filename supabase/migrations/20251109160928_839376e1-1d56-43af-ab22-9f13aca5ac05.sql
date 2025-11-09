-- Create storage bucket for client logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('client-logos', 'client-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for client logos
CREATE POLICY "Public can view client logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-logos');

CREATE POLICY "Admins can upload client logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'client-logos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Team can upload client logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'client-logos' 
  AND has_role(auth.uid(), 'team'::app_role)
);

CREATE POLICY "Admins can delete client logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'client-logos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Team can delete client logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'client-logos' 
  AND has_role(auth.uid(), 'team'::app_role)
);