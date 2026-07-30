ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS sent_pdf_path text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz;