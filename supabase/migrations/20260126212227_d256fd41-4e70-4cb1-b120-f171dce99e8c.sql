
-- Fix the projects RLS policy for clients to avoid recursion by using the helper function
DROP POLICY IF EXISTS "Clients can view their projects" ON public.projects;

CREATE POLICY "Clients can view their projects"
ON public.projects
FOR SELECT
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_clients pc
    WHERE pc.project_id = projects.id
    AND pc.client_id = public.client_id_for_user(auth.uid())
  )
);
