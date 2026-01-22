-- Allow clients to read active agencies
DO $$
BEGIN
  -- Recreate policy idempotently
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'agencies'
      AND policyname = 'Clients can view active agencies'
  ) THEN
    EXECUTE 'DROP POLICY "Clients can view active agencies" ON public.agencies';
  END IF;
END $$;

CREATE POLICY "Clients can view active agencies"
ON public.agencies
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND active = true
);
