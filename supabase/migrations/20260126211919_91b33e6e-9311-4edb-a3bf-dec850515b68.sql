
-- 1) Helper to resolve the client_id for a given authenticated user (bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.client_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.clients c
  JOIN public.profiles p ON p.id = _user_id
  WHERE c.email = p.email
  LIMIT 1
$$;

-- 2) Replace the recursive policy on project_clients
DROP POLICY IF EXISTS "Clients can view their project_clients" ON public.project_clients;

CREATE POLICY "Clients can view their project_clients"
ON public.project_clients
FOR SELECT
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND project_clients.client_id = public.client_id_for_user(auth.uid())
);
