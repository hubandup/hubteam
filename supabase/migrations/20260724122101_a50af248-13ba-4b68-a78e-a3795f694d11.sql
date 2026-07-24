
-- Drop redundant heavy RLS policy: trigger sync_client_contact_team_to_profile_trg
-- already inserts a matching profile team member row, so the "Project profile members"
-- policy covers client contacts too.
DROP POLICY IF EXISTS "Client contacts on team can view projects" ON public.projects;

-- Missing indexes causing sequential scans on hot paths
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_project_team_members_member ON public.project_team_members (member_type, member_id);
CREATE INDEX IF NOT EXISTS idx_project_clients_client_id ON public.project_clients (client_id);
CREATE INDEX IF NOT EXISTS idx_project_agencies_agency_id ON public.project_agencies (agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_members_user_id ON public.agency_members (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_archived_created_at ON public.projects (archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_created ON public.activity_log (action_type, created_at DESC);
