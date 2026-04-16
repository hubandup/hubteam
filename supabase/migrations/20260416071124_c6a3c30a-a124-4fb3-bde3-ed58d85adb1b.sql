-- Fix profiles: allow all authenticated users to read their own profile (needed for RLS subqueries)
-- This policy already exists as "Users can view their own profile", so no change needed there.
-- But agency/client users need to read their own email for RLS subqueries on other tables.
-- The existing policy covers this. Let's ensure it works by checking the USING clause.

-- Fix lagostina_affiliation: restrict INSERT/DELETE to admin/team roles instead of always true
DROP POLICY IF EXISTS "Authenticated users can delete affiliation data" ON public.lagostina_affiliation;
DROP POLICY IF EXISTS "Authenticated users can insert affiliation data" ON public.lagostina_affiliation;

CREATE POLICY "Admin and team can insert affiliation data"
ON public.lagostina_affiliation
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team'::app_role)
);

CREATE POLICY "Admin and team can delete affiliation data"
ON public.lagostina_affiliation
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team'::app_role)
);