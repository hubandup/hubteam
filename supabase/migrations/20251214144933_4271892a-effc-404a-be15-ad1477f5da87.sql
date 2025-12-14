-- Drop the existing permissive policy and recreate as RESTRICTIVE
DROP POLICY IF EXISTS "require_authentication_profiles" ON public.profiles;

-- Create a RESTRICTIVE policy that requires authentication for ALL operations
-- This ensures no profile data is accessible without authentication
CREATE POLICY "require_authentication_profiles" 
ON public.profiles 
AS RESTRICTIVE
FOR ALL 
USING (auth.uid() IS NOT NULL);
