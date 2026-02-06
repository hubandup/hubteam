
-- Drop the existing restrictive policy for agency users
DROP POLICY IF EXISTS "Agency users can view their clients" ON public.clients;

-- Create a new policy that allows agency users to view ALL clients
CREATE POLICY "Agency users can view all clients"
ON public.clients
FOR SELECT
USING (has_role(auth.uid(), 'agency'::app_role));
