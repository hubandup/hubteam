-- Allow agency users to update only their own agency
CREATE POLICY "Agency users can update their own agency"
ON public.agencies
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'agency'::app_role) 
  AND EXISTS (
    SELECT 1 
    FROM public.agency_members 
    WHERE agency_members.agency_id = agencies.id 
      AND agency_members.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'agency'::app_role) 
  AND EXISTS (
    SELECT 1 
    FROM public.agency_members 
    WHERE agency_members.agency_id = agencies.id 
      AND agency_members.user_id = auth.uid()
  )
);