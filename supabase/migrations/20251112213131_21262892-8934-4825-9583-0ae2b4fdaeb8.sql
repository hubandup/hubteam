-- Add Facturation.PRO integration fields to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS facturation_pro_id text UNIQUE,
ADD COLUMN IF NOT EXISTS facturation_pro_synced_at timestamp with time zone;

-- Add Facturation.PRO integration fields to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS facturation_pro_id text UNIQUE,
ADD COLUMN IF NOT EXISTS facturation_pro_pdf_url text,
ADD COLUMN IF NOT EXISTS invoice_date timestamp with time zone;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_facturation_pro_id ON public.clients(facturation_pro_id);
CREATE INDEX IF NOT EXISTS idx_invoices_facturation_pro_id ON public.invoices(facturation_pro_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);

-- Add comment to document the fields
COMMENT ON COLUMN public.clients.facturation_pro_id IS 'ID du client dans Facturation.PRO pour synchronisation bidirectionnelle';
COMMENT ON COLUMN public.invoices.facturation_pro_id IS 'ID de la facture dans Facturation.PRO';
COMMENT ON COLUMN public.invoices.facturation_pro_pdf_url IS 'URL du PDF de la facture sur Facturation.PRO';