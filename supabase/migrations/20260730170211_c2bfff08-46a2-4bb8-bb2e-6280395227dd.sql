ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS facturation_pro_purchase_id integer,
  ADD COLUMN IF NOT EXISTS purchase_match_method text,
  ADD COLUMN IF NOT EXISTS purchase_match_confidence text,
  ADD COLUMN IF NOT EXISTS purchase_matched_at timestamptz,
  ADD COLUMN IF NOT EXISTS purchase_match_confirmed boolean NOT NULL DEFAULT false;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_match_confidence_check;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_match_confidence_check
  CHECK (purchase_match_confidence IS NULL OR purchase_match_confidence IN ('certain', 'probable'));

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_match_method_check;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_match_method_check
  CHECK (purchase_match_method IS NULL OR purchase_match_method IN ('api_custom', 'supplier_amount', 'supplier_ref', 'manual'));

CREATE INDEX IF NOT EXISTS idx_purchase_orders_facturation_pro_purchase_id
  ON public.purchase_orders (facturation_pro_purchase_id)
  WHERE facturation_pro_purchase_id IS NOT NULL;