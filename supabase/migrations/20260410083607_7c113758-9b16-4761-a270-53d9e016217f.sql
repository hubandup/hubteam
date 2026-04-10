
CREATE POLICY "Clients can view clients linked to their projects"
ON public.clients
FOR SELECT
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND id IN (
    SELECT pc.client_id
    FROM public.project_clients pc
    JOIN public.project_team_members ptm
      ON ptm.project_id = pc.project_id
      AND ptm.member_type = 'profile'
      AND ptm.member_id = auth.uid()
  )
);
