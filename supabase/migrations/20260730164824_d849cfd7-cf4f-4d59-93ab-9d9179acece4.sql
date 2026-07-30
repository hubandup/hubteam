DO $$ BEGIN
  CREATE TYPE public.supplier_sync_status AS ENUM ('pending','synced','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS facturation_pro_id integer,
  ADD COLUMN IF NOT EXISTS civility text,
  ADD COLUMN IF NOT EXISTS siret text,
  ADD COLUMN IF NOT EXISTS sync_status public.supplier_sync_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_error text;

CREATE INDEX IF NOT EXISTS idx_suppliers_facturation_pro_id ON public.suppliers (facturation_pro_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_sync_status ON public.suppliers (sync_status);

ALTER TABLE public.purchase_categories
  ADD COLUMN IF NOT EXISTS facturation_pro_category_id integer;