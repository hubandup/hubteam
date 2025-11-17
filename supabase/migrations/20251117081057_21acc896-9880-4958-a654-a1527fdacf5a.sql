-- Fix storage policies for post-media bucket
-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own media" ON storage.objects;

-- Ensure bucket is public
UPDATE storage.buckets SET public = true WHERE id = 'post-media';

-- Allow everyone (authenticated and anonymous) to view media
CREATE POLICY "Public can view post media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'post-media');

-- Allow authenticated users to upload media
CREATE POLICY "Authenticated users can upload media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own media
CREATE POLICY "Users can delete their own media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);