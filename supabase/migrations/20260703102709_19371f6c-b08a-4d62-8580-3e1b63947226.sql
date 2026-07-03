
-- 1. Restrict sensitive cache/config tables to admin+team only
DROP POLICY IF EXISTS "Authenticated users can read app_config" ON public.app_config;
CREATE POLICY "Admin and team can read app_config"
  ON public.app_config FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

DROP POLICY IF EXISTS "Authenticated users can read google_alerts_cache" ON public.google_alerts_cache;
CREATE POLICY "Admin and team can read google_alerts_cache"
  ON public.google_alerts_cache FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

DROP POLICY IF EXISTS "Authenticated users can read hubandup_context_cache" ON public.hubandup_context_cache;
CREATE POLICY "Admin and team can read hubandup_context_cache"
  ON public.hubandup_context_cache FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

-- 2. Allow agency and client users to read basic profile info of authenticated users
-- (needed for chat, mentions, joined-profile lookups). Columns visible are the same
-- as for the existing full-read policies; the app already only selects safe fields.
CREATE POLICY "Agency and client can view profiles"
  ON public.profiles FOR SELECT
  USING (
    has_role(auth.uid(), 'agency'::app_role)
    OR has_role(auth.uid(), 'client'::app_role)
  );

-- 3. Agency users can view task_comments on tasks belonging to projects they are assigned to
CREATE POLICY "Agencies can view task comments on their projects"
  ON public.task_comments FOR SELECT
  USING (
    has_role(auth.uid(), 'agency'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.project_agencies pa ON pa.project_id = t.project_id
      JOIN public.agency_members am ON am.agency_id = pa.agency_id
      WHERE t.id = task_comments.task_id
        AND am.user_id = auth.uid()
    )
  );
