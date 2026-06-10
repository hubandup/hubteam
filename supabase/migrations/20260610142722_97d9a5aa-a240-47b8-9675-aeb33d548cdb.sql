
CREATE POLICY "Authenticated can read bank-statements"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bank-statements');

CREATE POLICY "Authenticated can upload bank-statements"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bank-statements');

CREATE POLICY "Authenticated can delete bank-statements"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'bank-statements');
