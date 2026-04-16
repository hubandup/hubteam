-- Allow agency users to view project_clients for projects linked to their agency
CREATE POLICY "Agency users can view project_clients of their projects"
ON public.project_clients
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'agency'::app_role)
  AND project_id IN (
    SELECT pa.project_id
    FROM public.project_agencies pa
    JOIN public.agency_members am ON am.agency_id = pa.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- Allow agency users to view clients linked to their projects (already covered by 'view all clients', kept for safety)
-- No change needed for clients table — agency role already has SELECT access.

-- Allow clients to view ALL project_clients rows of projects they are members of
-- (current policy only allows seeing their own client_id row, which prevents seeing co-clients but that's fine.
--  However the issue is that project_clients SELECT for clients only returns their own client row, which IS the linked client — should work.
--  Real issue is for agency users.)