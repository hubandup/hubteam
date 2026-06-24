
-- 1) AGENCIES: restrict agency-role SELECT to their own agency
DROP POLICY IF EXISTS "Agency users can view all agencies" ON public.agencies;
CREATE POLICY "Agency users can view their own agency"
ON public.agencies
FOR SELECT
USING (
  has_role(auth.uid(), 'agency'::app_role)
  AND (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = agencies.id AND am.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.agency_contacts ac
      JOIN public.profiles p ON p.email = ac.email
      WHERE ac.agency_id = agencies.id AND p.id = auth.uid()
    )
  )
);

-- 2) CLIENTS: restrict agency-role SELECT to clients linked to projects they're assigned to
DROP POLICY IF EXISTS "Agency users can view all clients" ON public.clients;
CREATE POLICY "Agency users can view clients of their projects"
ON public.clients
FOR SELECT
USING (
  has_role(auth.uid(), 'agency'::app_role)
  AND id IN (
    SELECT pc.client_id
    FROM public.project_clients pc
    JOIN public.project_agencies pa ON pa.project_id = pc.project_id
    JOIN public.agency_members am ON am.agency_id = pa.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- 3) BANK STATEMENTS storage: restrict to admin/team
DROP POLICY IF EXISTS "Authenticated can read bank-statements" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload bank-statements" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete bank-statements" ON storage.objects;

CREATE POLICY "Admin/team can read bank-statements"
ON storage.objects FOR SELECT
USING (bucket_id = 'bank-statements' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team'::app_role)));

CREATE POLICY "Admin/team can upload bank-statements"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'bank-statements' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team'::app_role)));

CREATE POLICY "Admin/team can update bank-statements"
ON storage.objects FOR UPDATE
USING (bucket_id = 'bank-statements' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team'::app_role)));

CREATE POLICY "Admin/team can delete bank-statements"
ON storage.objects FOR DELETE
USING (bucket_id = 'bank-statements' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team'::app_role)));

-- 4) bank_line_supplier_overrides: restrict to admin/team
DROP POLICY IF EXISTS "Authenticated can view overrides" ON public.bank_line_supplier_overrides;
DROP POLICY IF EXISTS "Authenticated can insert overrides" ON public.bank_line_supplier_overrides;
DROP POLICY IF EXISTS "Authenticated can update overrides" ON public.bank_line_supplier_overrides;
DROP POLICY IF EXISTS "Authenticated can delete overrides" ON public.bank_line_supplier_overrides;

CREATE POLICY "Admin/team manage overrides"
ON public.bank_line_supplier_overrides FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team'::app_role));

-- 5) supplier_name_aliases: restrict to admin/team
DROP POLICY IF EXISTS "Authenticated read aliases" ON public.supplier_name_aliases;
DROP POLICY IF EXISTS "Authenticated insert aliases" ON public.supplier_name_aliases;
DROP POLICY IF EXISTS "Authenticated update aliases" ON public.supplier_name_aliases;
DROP POLICY IF EXISTS "Authenticated delete aliases" ON public.supplier_name_aliases;

CREATE POLICY "Admin/team manage supplier aliases"
ON public.supplier_name_aliases FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'team'::app_role));

-- 6) linkedin_tokens: admin only
DROP POLICY IF EXISTS "Team can manage linkedin_tokens" ON public.linkedin_tokens;

-- 7) oauth_states: explicit deny policy for clarity
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No client access to oauth_states" ON public.oauth_states;
CREATE POLICY "No client access to oauth_states"
ON public.oauth_states FOR ALL
USING (false) WITH CHECK (false);

-- 8) project_attachments: allow assigned agencies to view
DROP POLICY IF EXISTS "Agency members can view project attachments" ON public.project_attachments;
CREATE POLICY "Agency members can view project attachments"
ON public.project_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.project_agencies pa
    JOIN public.agency_members am ON am.agency_id = pa.agency_id
    WHERE pa.project_id = project_attachments.project_id
      AND am.user_id = auth.uid()
  )
);

-- 9) Revoke EXECUTE on trigger-only SECURITY DEFINER functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.cleanup_supplier_invoice_duplicates() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_default_notification_preferences() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_message_notification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_activity_reaction_notification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_post_comment_notification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_post_reaction_notification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_client_changes() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_project_activity() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_project_attachment_changes() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_project_changes() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_task_changes() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_task_comment_changes() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_chat_mention() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_client_project_updated() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_post_comment_mentions() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_task_assignment() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_task_comment() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_task_comment_mentions() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_upcoming_deadlines() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.queue_agency_monday_notification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.queue_notification_for_processing() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_agency_to_webflow() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_project_activity_with_client() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_prospect_on_interaction() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
