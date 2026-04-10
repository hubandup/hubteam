
-- PROSPECTS: supprimer la policy trop permissive
DROP POLICY IF EXISTS "require_authentication_prospects" ON public.prospects;
DROP POLICY IF EXISTS "require_authentication_for_prospects" ON public.prospects;

-- INTERACTIONS: supprimer la policy trop permissive
DROP POLICY IF EXISTS "require_authentication_interactions" ON public.interactions;
DROP POLICY IF EXISTS "require_authentication_for_interactions" ON public.interactions;

-- EMAIL_TEMPLATES: supprimer la policy trop permissive
DROP POLICY IF EXISTS "require_authentication_email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "require_authentication_for_email_templates" ON public.email_templates;

-- PROJECT_ATTACHMENTS: supprimer la policy trop permissive
DROP POLICY IF EXISTS "require_authentication_project_attachments" ON public.project_attachments;
DROP POLICY IF EXISTS "require_authentication_for_project_attachments" ON public.project_attachments;

-- NOTIFICATIONS: ajouter WITH CHECK sur update + policy DELETE
ALTER POLICY "Users can update their own notifications" ON public.notifications
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_notifications" ON public.notifications;
CREATE POLICY "users_delete_own_notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);
