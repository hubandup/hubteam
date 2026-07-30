ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS quote_total_ht numeric;