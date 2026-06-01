CREATE TABLE public.lagostina_google_ads_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id text NOT NULL,
  sheet_name text NOT NULL DEFAULT 'Sheet1',
  cell_range text NOT NULL DEFAULT 'A1:Z200',
  last_synced_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lagostina_google_ads_config TO authenticated;
GRANT ALL ON public.lagostina_google_ads_config TO service_role;

ALTER TABLE public.lagostina_google_ads_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team manage lagostina_google_ads_config"
ON public.lagostina_google_ads_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team'::app_role));

CREATE TRIGGER update_lagostina_google_ads_config_updated_at
BEFORE UPDATE ON public.lagostina_google_ads_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();