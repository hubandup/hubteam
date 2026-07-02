
DROP POLICY IF EXISTS "Agency users can view their agency contacts" ON public.agency_contacts;
CREATE POLICY "Agency users can view their agency contacts"
  ON public.agency_contacts FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'agency'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = agency_contacts.agency_id
        AND am.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Agency can manage client_budget_data" ON public.client_budget_data;
DROP POLICY IF EXISTS "Agency can view linked client_budget_data" ON public.client_budget_data;
CREATE POLICY "Agency can view linked client_budget_data"
  ON public.client_budget_data FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'agency'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.agency_members am
      JOIN public.project_agencies pa ON pa.agency_id = am.agency_id
      JOIN public.project_clients pc ON pc.project_id = pa.project_id
      JOIN public.clients c ON c.id = pc.client_id
      WHERE am.user_id = auth.uid()
        AND split_part(COALESCE(c.email, ''), '@', 2) = client_budget_data.client_email_domain
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read affiliation data" ON public.lagostina_affiliation;
DROP POLICY IF EXISTS "Authorized users can read affiliation data" ON public.lagostina_affiliation;
CREATE POLICY "Authorized users can read affiliation data"
  ON public.lagostina_affiliation FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'team'::app_role)
    OR EXISTS (SELECT 1 FROM public.lagostina_access la WHERE la.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create project notes" ON public.project_notes;
DROP POLICY IF EXISTS "Members can create project notes" ON public.project_notes;
CREATE POLICY "Members can create project notes"
  ON public.project_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'team'::app_role)
      OR EXISTS (SELECT 1 FROM public.project_team_members ptm
                 WHERE ptm.project_id = project_notes.project_id
                   AND ptm.member_type = 'profile'
                   AND ptm.member_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.project_agencies pa
                 JOIN public.agency_members am ON am.agency_id = pa.agency_id
                 WHERE pa.project_id = project_notes.project_id AND am.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view project notes" ON public.project_notes;
DROP POLICY IF EXISTS "Members can view project notes" ON public.project_notes;
CREATE POLICY "Members can view project notes"
  ON public.project_notes FOR SELECT
  TO authenticated
  USING (
    (created_by = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (
      (NOT is_private) AND (
        has_role(auth.uid(), 'team'::app_role)
        OR EXISTS (SELECT 1 FROM public.project_team_members ptm
                   WHERE ptm.project_id = project_notes.project_id
                     AND ptm.member_type = 'profile'
                     AND ptm.member_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.project_agencies pa
                   JOIN public.agency_members am ON am.agency_id = pa.agency_id
                   WHERE pa.project_id = project_notes.project_id AND am.user_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can create task comments" ON public.task_comments;
DROP POLICY IF EXISTS "Members can create task comments" ON public.task_comments;
CREATE POLICY "Members can create task comments"
  ON public.task_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'team'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = task_comments.task_id AND (
          EXISTS (SELECT 1 FROM public.project_team_members ptm
                  WHERE ptm.project_id = t.project_id
                    AND ptm.member_type = 'profile'
                    AND ptm.member_id = auth.uid())
          OR EXISTS (SELECT 1 FROM public.project_agencies pa
                     JOIN public.agency_members am ON am.agency_id = pa.agency_id
                     WHERE pa.project_id = t.project_id AND am.user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM public.project_clients pc
                     JOIN public.clients c ON c.id = pc.client_id
                     JOIN public.profiles p ON p.email = c.email
                     WHERE pc.project_id = t.project_id AND p.id = auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete their own email images" ON storage.objects;
CREATE POLICY "Users can delete their own email images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'email-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Authenticated users can upload message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own message attachments" ON storage.objects;
CREATE POLICY "Users can upload own message attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Authenticated users can upload FAQ attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their FAQ attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete FAQ attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admin/team can upload FAQ attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admin/team can update FAQ attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admin/team can delete FAQ attachments" ON storage.objects;

CREATE POLICY "Admin/team can upload FAQ attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'faq-attachments'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role))
  );

CREATE POLICY "Admin/team can update FAQ attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'faq-attachments'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role))
  );

CREATE POLICY "Admin/team can delete FAQ attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'faq-attachments'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role))
  );

REVOKE EXECUTE ON FUNCTION public.client_id_for_user(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role_safe(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, app_module, permission_action) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.should_send_notification(uuid, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.should_send_notification(uuid, notification_type, text) FROM anon, PUBLIC;
