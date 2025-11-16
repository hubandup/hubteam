DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'clients' 
      AND policyname = 'Clients can view their own client record'
  ) THEN
    CREATE POLICY "Clients can view their own client record"
    ON public.clients
    FOR SELECT
    USING (
      has_role(auth.uid(), 'client'::app_role)
      AND email = (
        SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()
      )
    );
  END IF;
END $$;