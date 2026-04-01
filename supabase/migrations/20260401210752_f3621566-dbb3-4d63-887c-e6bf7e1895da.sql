CREATE POLICY "Clients can read presentation documents"
ON public.agency_attestations
FOR SELECT
TO authenticated
USING (
  attestation_type = 'presentation'
  AND has_role(auth.uid(), 'client'::app_role)
);