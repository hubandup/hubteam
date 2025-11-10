-- Add base authentication requirement policies to all tables with PII
-- This ensures only authenticated users can access data before role checks

-- Profiles table - contains emails, phone numbers, names
CREATE POLICY "require_authentication_profiles"
ON public.profiles
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Clients table - contains customer contact info and revenue
CREATE POLICY "require_authentication_clients"
ON public.clients
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Agencies table - contains partner contact info and revenue
CREATE POLICY "require_authentication_agencies"
ON public.agencies
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Agency contacts table - contains personal contact details
CREATE POLICY "require_authentication_agency_contacts"
ON public.agency_contacts
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Invoices table - contains financial records
CREATE POLICY "require_authentication_invoices"
ON public.invoices
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Quotes table - contains financial records
CREATE POLICY "require_authentication_quotes"
ON public.quotes
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Meeting notes - contains sensitive client discussions
CREATE POLICY "require_authentication_meeting_notes"
ON public.meeting_notes
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Project-related tables
CREATE POLICY "require_authentication_projects"
ON public.projects
FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "require_authentication_project_clients"
ON public.project_clients
FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "require_authentication_project_agencies"
ON public.project_agencies
FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "require_authentication_project_team_members"
ON public.project_team_members
FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "require_authentication_project_attachments"
ON public.project_attachments
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Tasks and comments
CREATE POLICY "require_authentication_tasks"
ON public.tasks
FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "require_authentication_task_comments"
ON public.task_comments
FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "require_authentication_task_agencies"
ON public.task_agencies
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Agency members
CREATE POLICY "require_authentication_agency_members"
ON public.agency_members
FOR ALL
USING (auth.uid() IS NOT NULL);

-- User roles - critical for privilege escalation prevention
CREATE POLICY "require_authentication_user_roles"
ON public.user_roles
FOR ALL
USING (auth.uid() IS NOT NULL);