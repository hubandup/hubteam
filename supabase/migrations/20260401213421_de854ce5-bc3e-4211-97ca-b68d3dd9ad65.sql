-- Update should_send_notification (notification_type version) to allow new client types
CREATE OR REPLACE FUNCTION public.should_send_notification(p_user_id uuid, p_notification_type notification_type, p_channel text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_role app_role;
  v_global_enabled BOOLEAN;
  v_global_force_email BOOLEAN;
  v_user_push_enabled BOOLEAN;
  v_user_email_enabled BOOLEAN;
BEGIN
  SELECT role INTO v_user_role
  FROM public.user_roles
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF v_user_role IS NULL THEN
    v_user_role := 'team'::app_role;
  END IF;
  
  -- CLIENT ROLE RESTRICTIONS: allowed types
  IF v_user_role = 'client' THEN
    IF p_notification_type NOT IN ('project_assigned', 'message', 'account_created', 'project_updated', 'new_agency') THEN
      RETURN FALSE;
    END IF;
    IF p_channel = 'email' THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  SELECT enabled, force_email 
  INTO v_global_enabled, v_global_force_email
  FROM public.notification_preferences_global
  WHERE role = v_user_role AND notification_type = p_notification_type;
  
  v_global_enabled := COALESCE(v_global_enabled, TRUE);
  v_global_force_email := COALESCE(v_global_force_email, FALSE);
  
  IF NOT v_global_enabled THEN
    RETURN FALSE;
  END IF;
  
  IF v_global_force_email AND p_channel = 'email' THEN
    RETURN TRUE;
  END IF;
  
  SELECT push_enabled, email_enabled
  INTO v_user_push_enabled, v_user_email_enabled
  FROM public.notification_user_preferences
  WHERE user_id = p_user_id AND notification_type = p_notification_type;
  
  v_user_push_enabled := COALESCE(v_user_push_enabled, TRUE);
  v_user_email_enabled := COALESCE(v_user_email_enabled, FALSE);
  
  IF p_notification_type = 'message' AND p_channel = 'push' THEN
    RETURN TRUE;
  END IF;
  
  IF p_channel = 'push' THEN
    RETURN v_user_push_enabled;
  ELSIF p_channel = 'email' THEN
    RETURN v_user_email_enabled;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Update text version too
CREATE OR REPLACE FUNCTION public.should_send_notification(p_user_id uuid, p_notification_type text, p_channel text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_role app_role;
  v_global_enabled BOOLEAN;
  v_force_email BOOLEAN;
  v_user_pref_push BOOLEAN;
  v_user_pref_email BOOLEAN;
BEGIN
  SELECT role INTO v_user_role
  FROM user_roles
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF v_user_role IS NULL THEN
    v_user_role := 'team';
  END IF;
  
  SELECT enabled, force_email INTO v_global_enabled, v_force_email
  FROM notification_preferences_global
  WHERE role = v_user_role AND notification_type = p_notification_type;
  
  v_global_enabled := COALESCE(v_global_enabled, true);
  v_force_email := COALESCE(v_force_email, false);
  
  IF NOT v_global_enabled THEN
    RETURN false;
  END IF;
  
  IF v_user_role = 'client' AND p_notification_type NOT IN ('project_assigned', 'message', 'account_created', 'project_updated', 'new_agency') THEN
    RETURN false;
  END IF;
  
  IF p_channel = 'email' AND v_force_email THEN
    RETURN true;
  END IF;
  
  IF v_user_role = 'client' AND p_channel = 'email' THEN
    RETURN true;
  END IF;
  
  SELECT push_enabled, email_enabled 
  INTO v_user_pref_push, v_user_pref_email
  FROM notification_user_preferences
  WHERE user_id = p_user_id AND notification_type = p_notification_type;
  
  v_user_pref_push := COALESCE(v_user_pref_push, true);
  v_user_pref_email := COALESCE(v_user_pref_email, false);
  
  IF p_channel = 'push' THEN
    RETURN v_user_pref_push;
  ELSIF p_channel = 'email' THEN
    RETURN v_user_pref_email;
  ELSE
    RETURN false;
  END IF;
END;
$$;