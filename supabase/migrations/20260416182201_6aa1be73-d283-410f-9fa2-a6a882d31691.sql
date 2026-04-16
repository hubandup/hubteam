-- Drop the narrow client policy and create a broad one: anyone who can see the project can see its project_clients
DROP POLICY IF EXISTS "Clients can view their project_clients" ON public.project_clients;

-- Anyone with access to the project (team member OR agency member OR admin/team role) can view project_clients
CREATE POLICY "Users with project access can view project_clients"
ON public.project_clients
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'team'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.project_team_members ptm
    WHERE ptm.project_id = project_clients.project_id
      AND ptm.member_type = 'profile'
      AND ptm.member_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.project_agencies pa
    JOIN public.agency_members am ON am.agency_id = pa.agency_id
    WHERE pa.project_id = project_clients.project_id
      AND am.user_id = auth.uid()
  )
  OR (
    has_role(auth.uid(), 'client'::app_role)
    AND client_id = client_id_for_user(auth.uid())
  )
);

-- Also ensure clients table is readable by agency users (already exists but confirm) and by clients linked via project membership
-- Add a policy so any user with project access can view the linked client record
CREATE POLICY "Users with project access can view linked clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT pc.client_id
    FROM public.project_clients pc
    WHERE
      EXISTS (
        SELECT 1 FROM public.project_team_members ptm
        WHERE ptm.project_id = pc.project_id
          AND ptm.member_type = 'profile'
          AND ptm.member_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.project_agencies pa
        JOIN public.agency_members am ON am.agency_id = pa.agency_id
        WHERE pa.project_id = pc.project_id
          AND am.user_id = auth.uid()
      )
  )
);