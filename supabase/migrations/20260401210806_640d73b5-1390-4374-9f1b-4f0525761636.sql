CREATE POLICY "Clients can download presentation files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'agency-attestations'
  AND has_role(auth.uid(), 'client'::app_role)
  AND (storage.filename(name) LIKE 'presentation_%')
);