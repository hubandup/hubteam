-- 1. Fix get_user_role_safe to return NULL instead of defaulting to 'team'
CREATE OR REPLACE FUNCTION public.get_user_role_safe(p_user_id uuid)
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$function$;

-- 2. Fix project_notes SELECT policy: restrict from public to authenticated
DROP POLICY IF EXISTS "Users can view project notes" ON public.project_notes;
CREATE POLICY "Users can view project notes"
  ON public.project_notes
  FOR SELECT
  TO authenticated
  USING ((NOT is_private) OR (created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- 3. Fix lagostina_influence policies that use get_user_role_safe
DROP POLICY IF EXISTS "lagostina_influence_admin_delete" ON public.lagostina_influence;
CREATE POLICY "lagostina_influence_admin_delete"
  ON public.lagostina_influence
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

DROP POLICY IF EXISTS "lagostina_influence_admin_update" ON public.lagostina_influence;
CREATE POLICY "lagostina_influence_admin_update"
  ON public.lagostina_influence
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

-- 4. Fix lagostina_press policies that use get_user_role_safe
DROP POLICY IF EXISTS "lagostina_press_admin_delete" ON public.lagostina_press;
CREATE POLICY "lagostina_press_admin_delete"
  ON public.lagostina_press
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

DROP POLICY IF EXISTS "lagostina_press_admin_update" ON public.lagostina_press;
CREATE POLICY "lagostina_press_admin_update"
  ON public.lagostina_press
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));