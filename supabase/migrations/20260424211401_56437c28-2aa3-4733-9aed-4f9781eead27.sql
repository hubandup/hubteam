DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['quotes','invoices','task_comments','project_clients','client_statuses']
  LOOP
    -- Force REPLICA IDENTITY FULL so old/new rows are available in payloads
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    -- Add to realtime publication if not already present
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;