
-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage client_budget_data" ON public.client_budget_data;
DROP POLICY IF EXISTS "Team can manage client_budget_data" ON public.client_budget_data;
DROP POLICY IF EXISTS "Agency can manage client_budget_data" ON public.client_budget_data;
DROP POLICY IF EXISTS "Clients can view their budget data" ON public.client_budget_data;

-- Recreate with explicit PERMISSIVE type
CREATE POLICY "Admins can manage client_budget_data"
ON public.client_budget_data
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team can manage client_budget_data"
ON public.client_budget_data
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'team'))
WITH CHECK (public.has_role(auth.uid(), 'team'));

CREATE POLICY "Agency can manage client_budget_data"
ON public.client_budget_data
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'agency'))
WITH CHECK (public.has_role(auth.uid(), 'agency'));

CREATE POLICY "Clients can view their budget data"
ON public.client_budget_data
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'client')
  AND client_email_domain = split_part(
    (SELECT email FROM public.profiles WHERE id = auth.uid()),
    '@', 2
  )
);
