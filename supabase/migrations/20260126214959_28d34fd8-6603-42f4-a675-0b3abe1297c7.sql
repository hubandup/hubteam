-- Remove client RLS via project_clients (company association)
-- Client visibility is now exclusively through project_team_members (Équipe tab)

DROP POLICY IF EXISTS "Clients can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Clients can view their tasks" ON public.tasks;