
-- 1) Restrict public-read reference tables to authenticated users
DROP POLICY IF EXISTS "Everyone can view activity_sectors" ON public.activity_sectors;
CREATE POLICY "Authenticated can view activity_sectors"
  ON public.activity_sectors FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view agency_tags" ON public.agency_tags;
CREATE POLICY "Authenticated can view agency_tags"
  ON public.agency_tags FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view client_sources" ON public.client_sources;
CREATE POLICY "Authenticated can view client_sources"
  ON public.client_sources FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view client_statuses" ON public.client_statuses;
CREATE POLICY "Authenticated can view client_statuses"
  ON public.client_statuses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view faq_categories" ON public.faq_categories;
CREATE POLICY "Authenticated can view faq_categories"
  ON public.faq_categories FOR SELECT TO authenticated USING (true);

-- 2) Prospect categories: scope SELECT and admin/team write policies to authenticated role
DROP POLICY IF EXISTS "Everyone can view prospect_categories" ON public.prospect_categories;
CREATE POLICY "Authenticated can view prospect_categories"
  ON public.prospect_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage prospect_categories" ON public.prospect_categories;
CREATE POLICY "Admins can manage prospect_categories"
  ON public.prospect_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Team can manage prospect_categories" ON public.prospect_categories;
CREATE POLICY "Team can manage prospect_categories"
  ON public.prospect_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'team'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'team'::app_role));

-- 3) Bank statement lines: replace mutable-email allowlist with role-based check
DROP POLICY IF EXISTS "Compta users can manage bank statement lines" ON public.bank_statement_lines;
CREATE POLICY "Admins can manage bank statement lines"
  ON public.bank_statement_lines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) lagostina_files_sync: remove overly permissive lagostina_access-based writes
--    and scope the agency SELECT policy to authenticated
DROP POLICY IF EXISTS "lagostina_access_insert_files_sync" ON public.lagostina_files_sync;
DROP POLICY IF EXISTS "lagostina_access_delete_files_sync" ON public.lagostina_files_sync;
DROP POLICY IF EXISTS "Agency with access can view lagostina_files_sync" ON public.lagostina_files_sync;
CREATE POLICY "Agency with access can view lagostina_files_sync"
  ON public.lagostina_files_sync FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'agency'::app_role) AND EXISTS (
      SELECT 1 FROM public.lagostina_access
      WHERE lagostina_access.user_id = auth.uid()
        AND lagostina_access.granted = true
    )
  );

-- 5) Revoke EXECUTE from anon/PUBLIC on SECURITY DEFINER helper functions
--    that are only meant to be invoked from RLS policies for authenticated users.
REVOKE EXECUTE ON FUNCTION public.accessible_project_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_email() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.same_agency_user_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accessible_project_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.same_agency_user_ids() TO authenticated, service_role;

-- 6) Storage: allow clients to download PDFs for invoices they can access.
--    Scopes reads to objects in the invoices-quotes bucket whose top-level
--    folder equals a client_id belonging to the authenticated client user.
DROP POLICY IF EXISTS "Clients can view their invoice/quote PDFs" ON storage.objects;
CREATE POLICY "Clients can view their invoice/quote PDFs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoices-quotes'
    AND public.has_role(auth.uid(), 'client'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.email = p.email
        AND (storage.foldername(storage.objects.name))[1] = c.id::text
    )
  );
