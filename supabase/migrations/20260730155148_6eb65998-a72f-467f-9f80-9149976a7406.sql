CREATE POLICY "Authenticated can read purchase order pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'purchase-orders');

CREATE POLICY "Authenticated can upload purchase order pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'purchase-orders');

CREATE POLICY "Authenticated can update purchase order pdfs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'purchase-orders')
WITH CHECK (bucket_id = 'purchase-orders');

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_quote
  ON public.purchase_orders (supplier_id, supplier_quote_ref);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_validation_date
  ON public.purchase_orders (validation_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_dossier
  ON public.purchase_orders (hubup_dossier_ref);