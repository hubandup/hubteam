DROP POLICY IF EXISTS "Clients can view linked active agencies" ON public.agencies;
CREATE POLICY "Clients can view all active agencies" ON public.agencies
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'client'::app_role) AND active = true);