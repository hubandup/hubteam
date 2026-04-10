CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id uuid,
  _module text,
  _action text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND rp.module = _module::app_module
      AND rp.action = _action::permission_action
  );
$$;

-- Empêcher la lecture publique de la matrice de permissions
DROP POLICY IF EXISTS "Everyone can view role_permissions" ON public.role_permissions;

CREATE POLICY "Users see only their own role permissions"
  ON public.role_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = role_permissions.role
    )
  );