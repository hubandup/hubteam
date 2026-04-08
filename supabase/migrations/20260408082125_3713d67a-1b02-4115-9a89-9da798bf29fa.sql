
-- Team can manage (insert, update, delete) budget data
CREATE POLICY "Team can manage client_budget_data"
ON public.client_budget_data FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'team'))
WITH CHECK (public.has_role(auth.uid(), 'team'));

-- Agency can manage budget data
CREATE POLICY "Agency can manage client_budget_data"
ON public.client_budget_data FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'agency'))
WITH CHECK (public.has_role(auth.uid(), 'agency'));

-- Drop the SELECT-only policy for team since ALL covers it
DROP POLICY "Team can view client_budget_data" ON public.client_budget_data;
