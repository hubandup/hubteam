-- Drop the old policy that uses agency_members
DROP POLICY IF EXISTS "Agency users can update their own agency" ON public.agencies;

-- Create new policy that checks if user email is in agency_contacts
CREATE POLICY "Agency users can update if they are a contact"
ON public.agencies
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'agency'::app_role) 
  AND EXISTS (
    SELECT 1 
    FROM public.agency_contacts ac
    JOIN public.profiles p ON p.email = ac.email
    WHERE ac.agency_id = agencies.id 
      AND p.id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'agency'::app_role) 
  AND EXISTS (
    SELECT 1 
    FROM public.agency_contacts ac
    JOIN public.profiles p ON p.email = ac.email
    WHERE ac.agency_id = agencies.id 
      AND p.id = auth.uid()
  )
);