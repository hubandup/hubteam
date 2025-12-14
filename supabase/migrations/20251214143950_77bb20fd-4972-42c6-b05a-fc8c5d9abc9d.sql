-- Drop the overly permissive policy that allows any authenticated user
DROP POLICY IF EXISTS "require_authentication_clients" ON public.clients;

-- Create a RESTRICTIVE policy that requires authentication
-- This ensures ALL other policies only apply to authenticated users
CREATE POLICY "require_authentication_clients" 
ON public.clients 
AS RESTRICTIVE
FOR ALL 
USING (auth.uid() IS NOT NULL);