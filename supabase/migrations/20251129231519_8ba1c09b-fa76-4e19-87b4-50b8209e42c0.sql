-- Drop the overly permissive policy that allows all authenticated users to do everything
DROP POLICY IF EXISTS "require_authentication_agencies" ON public.agencies;

-- Drop duplicate policies
DROP POLICY IF EXISTS "Agency members can update their agency" ON public.agencies;
DROP POLICY IF EXISTS "Only admins can manage agencies" ON public.agencies;

-- Keep only the correct policy for agency users to update their own agency
-- (the "Agency users can update their own agency" policy is correct and stays)