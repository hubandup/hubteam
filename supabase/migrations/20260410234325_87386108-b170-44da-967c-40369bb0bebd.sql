
-- ============================================================
-- CRITICAL: Remove all require_authentication_* bypass policies
-- ============================================================

-- 1. USER_ROLES — PRIVILEGE ESCALATION FIX
DROP POLICY IF EXISTS "require_authentication_user_roles" ON public.user_roles;

-- 2. INVOICES
DROP POLICY IF EXISTS "require_authentication_invoices" ON public.invoices;

-- 3. PROJECTS
DROP POLICY IF EXISTS "require_authentication_projects" ON public.projects;

-- 4. PROJECT_CLIENTS
DROP POLICY IF EXISTS "require_authentication_project_clients" ON public.project_clients;

-- 5. PROJECT_AGENCIES
DROP POLICY IF EXISTS "require_authentication_project_agencies" ON public.project_agencies;

-- 6. PROJECT_TEAM_MEMBERS
DROP POLICY IF EXISTS "require_authentication_project_team_members" ON public.project_team_members;

-- 7. TASKS
DROP POLICY IF EXISTS "require_authentication_tasks" ON public.tasks;

-- 8. TASK_COMMENTS
DROP POLICY IF EXISTS "require_authentication_task_comments" ON public.task_comments;

-- 9. TASK_AGENCIES
DROP POLICY IF EXISTS "require_authentication_task_agencies" ON public.task_agencies;

-- 10. AGENCY_CONTACTS
DROP POLICY IF EXISTS "require_authentication_agency_contacts" ON public.agency_contacts;

-- 11. AGENCY_MEMBERS
DROP POLICY IF EXISTS "require_authentication_agency_members" ON public.agency_members;

-- 12. CLIENT_CONTACTS
DROP POLICY IF EXISTS "require_authentication_client_contacts" ON public.client_contacts;

-- 13. PROSPECT_CATEGORIES
DROP POLICY IF EXISTS "require_authentication_prospect_categories" ON public.prospect_categories;

-- ============================================================
-- Add missing team write policies where only SELECT existed
-- ============================================================

-- agency_contacts: team needs write access (currently only admin has ALL, team has SELECT)
DROP POLICY IF EXISTS "Team can manage agency_contacts" ON public.agency_contacts;
CREATE POLICY "Team can manage agency_contacts"
  ON public.agency_contacts FOR ALL
  USING (has_role(auth.uid(), 'team'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team'::app_role));

-- project_agencies: team needs write access (currently only admin has ALL, team has SELECT)
DROP POLICY IF EXISTS "Team can manage project_agencies" ON public.project_agencies;
CREATE POLICY "Team can manage project_agencies"
  ON public.project_agencies FOR ALL
  USING (has_role(auth.uid(), 'team'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team'::app_role));

-- task_agencies: team needs write access (currently only admin has ALL, team has SELECT)
DROP POLICY IF EXISTS "Team can manage task_agencies" ON public.task_agencies;
CREATE POLICY "Team can manage task_agencies"
  ON public.task_agencies FOR ALL
  USING (has_role(auth.uid(), 'team'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team'::app_role));
