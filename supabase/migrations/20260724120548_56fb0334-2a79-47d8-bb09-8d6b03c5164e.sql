CREATE POLICY "Clients can view project note authors"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND id IN (
    SELECT pn.created_by
    FROM public.project_notes pn
    WHERE pn.project_id IN (SELECT accessible_project_ids())
  )
);