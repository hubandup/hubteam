-- Create storage bucket for FAQ images
INSERT INTO storage.buckets (id, name, public)
VALUES ('faq-attachments', 'faq-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for faq-attachments bucket
CREATE POLICY "Public can view FAQ attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'faq-attachments');

CREATE POLICY "Authenticated users can upload FAQ attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'faq-attachments' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update their FAQ attachments"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'faq-attachments' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete FAQ attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'faq-attachments' 
  AND auth.role() = 'authenticated'
);