-- Add HT amount column to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS amount_ht numeric(12,2);

-- Sync log table
CREATE TABLE IF NOT EXISTS public.facturation_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  trigger text NOT NULL DEFAULT 'manual',
  synced_invoices integer NOT NULL DEFAULT 0,
  skipped_invoices integer NOT NULL DEFAULT 0,
  auto_created_clients integer NOT NULL DEFAULT 0,
  total_invoices integer NOT NULL DEFAULT 0,
  missing_customer_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_ht numeric(14,2),
  total_ttc numeric(14,2),
  error text,
  duration_ms integer
);

GRANT SELECT ON public.facturation_sync_log TO authenticated;
GRANT ALL ON public.facturation_sync_log TO service_role;

ALTER TABLE public.facturation_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view facturation sync log"
ON public.facturation_sync_log FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_facturation_sync_log_ran_at ON public.facturation_sync_log(ran_at DESC);