-- Drop the restrictive SELECT policy for agency users
DROP POLICY IF EXISTS "Agency users can view their agencies" ON public.agencies;

-- Add a new policy allowing agency users to view ALL agencies
CREATE POLICY "Agency users can view all agencies"
ON public.agencies
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'agency'::app_role));