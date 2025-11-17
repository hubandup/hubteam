-- Create storage bucket for feed PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feed-pdfs',
  'feed-pdfs',
  true,
  20971520, -- 20MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for feed-pdfs bucket
CREATE POLICY "Authenticated users can upload PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'feed-pdfs' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view PDFs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'feed-pdfs');

CREATE POLICY "Users can delete their own PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'feed-pdfs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add PDF URL column to user_posts
ALTER TABLE public.user_posts
ADD COLUMN IF NOT EXISTS pdf_url TEXT;

COMMENT ON COLUMN public.user_posts.pdf_url IS 'URL of attached PDF file for preview in feed';