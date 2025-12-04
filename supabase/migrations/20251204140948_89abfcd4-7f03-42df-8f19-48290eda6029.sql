-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-logos' 
  AND (storage.foldername(name))[1] IS NULL 
  AND name LIKE (auth.uid()::text || '-%')
);

-- Allow authenticated users to update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'client-logos' 
  AND name LIKE (auth.uid()::text || '-%')
)
WITH CHECK (
  bucket_id = 'client-logos' 
  AND name LIKE (auth.uid()::text || '-%')
);

-- Allow authenticated users to delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-logos' 
  AND name LIKE (auth.uid()::text || '-%')
);