ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS purchase_terms text,
  ADD COLUMN IF NOT EXISTS purchase_terms_version text,
  ADD COLUMN IF NOT EXISTS purchase_terms_effective_date date;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS terms_version text;