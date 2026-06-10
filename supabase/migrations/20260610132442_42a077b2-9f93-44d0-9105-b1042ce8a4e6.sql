ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS kdrive_file_id text,
  ADD COLUMN IF NOT EXISTS kdrive_folder text,
  ADD COLUMN IF NOT EXISTS fiscal_year text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_invoices_kdrive_file_id
  ON public.supplier_invoices(kdrive_file_id)
  WHERE kdrive_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_fiscal_year
  ON public.supplier_invoices(fiscal_year);