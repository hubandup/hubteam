
-- Create a secure config table for cron secret (accessible only via service_role/SQL)
CREATE TABLE IF NOT EXISTS public.cron_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE public.cron_config ENABLE ROW LEVEL SECURITY;

-- Deny all access via API (only accessible via SQL/service_role)
CREATE POLICY "deny_all_cron_config" ON public.cron_config
  FOR ALL USING (false);
