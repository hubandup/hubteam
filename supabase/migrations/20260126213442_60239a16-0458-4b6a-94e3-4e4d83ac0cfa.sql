-- Allow any authenticated user to see projects where they are explicitly added as a profile team member
-- (This enables "Projet > Équipe > Ajouter > Équipe" to drive visibility in "Projets")

DROP POLICY IF EXISTS "Project profile members can view projects" ON public.projects;
CREATE POLICY "Project profile members can view projects"
ON public.projects
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.project_team_members ptm
    WHERE ptm.project_id = projects.id
      AND ptm.member_type = 'profile'::public.team_member_type
      AND ptm.member_id = auth.uid()
  )
);

-- Also allow those same explicit project members to see tasks for that project
DROP POLICY IF EXISTS "Project profile members can view tasks" ON public.tasks;
CREATE POLICY "Project profile members can view tasks"
ON public.tasks
FOR SELECT
USING (
  tasks.project_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.project_team_members ptm
    WHERE ptm.project_id = tasks.project_id
      AND ptm.member_type = 'profile'::public.team_member_type
      AND ptm.member_id = auth.uid()
  )
);
