DROP POLICY IF EXISTS "require_auth_prospection_contacts" ON public.prospection_contacts;
DROP POLICY IF EXISTS "Admins can manage prospection_contacts" ON public.prospection_contacts;
DROP POLICY IF EXISTS "Team can manage prospection_contacts" ON public.prospection_contacts;

CREATE POLICY "require_auth_prospection_contacts"
  ON public.prospection_contacts
  AS RESTRICTIVE
  FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage prospection_contacts"
  ON public.prospection_contacts
  AS PERMISSIVE
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can manage prospection_contacts"
  ON public.prospection_contacts
  AS PERMISSIVE
  FOR ALL
  USING (has_role(auth.uid(), 'team'::app_role));