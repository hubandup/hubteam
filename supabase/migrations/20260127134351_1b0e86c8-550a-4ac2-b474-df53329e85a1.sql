-- =====================================================
-- MIGRATION: Convert notification_type TEXT to ENUM
-- =====================================================

-- STEP 0: Clean up invalid data - map deadline_overdue to deadline_approaching
UPDATE public.notification_preferences_global 
SET notification_type = 'deadline_approaching' 
WHERE notification_type = 'deadline_overdue';

UPDATE public.notification_user_preferences 
SET notification_type = 'deadline_approaching' 
WHERE notification_type = 'deadline_overdue';

UPDATE public.notification_outbox 
SET notification_type = 'deadline_approaching' 
WHERE notification_type = 'deadline_overdue';

-- 1) notification_preferences_global: convert TEXT → public.notification_type
ALTER TABLE public.notification_preferences_global 
  ALTER COLUMN notification_type TYPE public.notification_type 
  USING notification_type::public.notification_type;

-- 2) notification_user_preferences: convert TEXT → public.notification_type  
ALTER TABLE public.notification_user_preferences 
  ALTER COLUMN notification_type TYPE public.notification_type 
  USING notification_type::public.notification_type;

-- 3) notification_outbox: convert TEXT → public.notification_type
ALTER TABLE public.notification_outbox 
  ALTER COLUMN notification_type TYPE public.notification_type 
  USING notification_type::public.notification_type;

-- 4) Update queue_notification_for_processing trigger to use enum
CREATE OR REPLACE FUNCTION public.queue_notification_for_processing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_outbox (
    notification_id,
    user_id,
    notification_type,
    payload,
    status
  ) VALUES (
    NEW.id,
    NEW.user_id,
    NEW.type::public.notification_type,
    jsonb_build_object(
      'title', NEW.title,
      'message', NEW.message,
      'link', COALESCE(NEW.link, '/'),
      'entity_type', NEW.entity_type,
      'entity_id', NEW.entity_id
    ),
    'pending'
  );
  RETURN NEW;
EXCEPTION WHEN invalid_text_representation THEN
  -- If notification type is not in enum, skip outbox (don't block)
  RAISE WARNING 'Unknown notification type: %, skipping outbox', NEW.type;
  RETURN NEW;
END;
$$;

-- 5) Fix handle_new_user: remove "first user = admin" logic
-- Users get role ONLY from invitation metadata, otherwise default to 'team'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invited_role app_role;
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email
  );
  
  -- Check if user was invited with a specific role (from invitation flow)
  BEGIN
    v_invited_role := (NEW.raw_user_meta_data->>'role')::app_role;
  EXCEPTION WHEN invalid_text_representation THEN
    v_invited_role := NULL;
  END;
  
  -- Assign role: use invited role if provided, otherwise default to 'team'
  -- NO "first user = admin" logic - admins must be seeded or invited explicitly
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(v_invited_role, 'team'::app_role))
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 6) Update should_send_notification to use enum properly
CREATE OR REPLACE FUNCTION public.should_send_notification(
  p_user_id UUID,
  p_notification_type public.notification_type,
  p_channel TEXT -- 'push' or 'email'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role app_role;
  v_global_enabled BOOLEAN;
  v_global_force_email BOOLEAN;
  v_user_push_enabled BOOLEAN;
  v_user_email_enabled BOOLEAN;
BEGIN
  -- Get user role (default to 'team' if not found)
  SELECT role INTO v_user_role
  FROM public.user_roles
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF v_user_role IS NULL THEN
    v_user_role := 'team'::app_role;
  END IF;
  
  -- CLIENT ROLE RESTRICTIONS: only project_assigned and message allowed
  IF v_user_role = 'client' THEN
    IF p_notification_type NOT IN ('project_assigned', 'message') THEN
      RETURN FALSE;
    END IF;
    -- Client always gets email for these types
    IF p_channel = 'email' THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- Get global preferences for this role and type
  SELECT enabled, force_email 
  INTO v_global_enabled, v_global_force_email
  FROM public.notification_preferences_global
  WHERE role = v_user_role AND notification_type = p_notification_type;
  
  -- Default to enabled if no global pref exists
  v_global_enabled := COALESCE(v_global_enabled, TRUE);
  v_global_force_email := COALESCE(v_global_force_email, FALSE);
  
  -- If globally disabled, return false
  IF NOT v_global_enabled THEN
    RETURN FALSE;
  END IF;
  
  -- If force_email and channel is email, always return true
  IF v_global_force_email AND p_channel = 'email' THEN
    RETURN TRUE;
  END IF;
  
  -- Get user preferences
  SELECT push_enabled, email_enabled
  INTO v_user_push_enabled, v_user_email_enabled
  FROM public.notification_user_preferences
  WHERE user_id = p_user_id AND notification_type = p_notification_type;
  
  -- Default to push enabled, email disabled
  v_user_push_enabled := COALESCE(v_user_push_enabled, TRUE);
  v_user_email_enabled := COALESCE(v_user_email_enabled, FALSE);
  
  -- MESSAGE RULE: push cannot be fully disabled for messages (internal users)
  IF p_notification_type = 'message' AND p_channel = 'push' THEN
    RETURN TRUE;
  END IF;
  
  -- Return based on channel preference
  IF p_channel = 'push' THEN
    RETURN v_user_push_enabled;
  ELSIF p_channel = 'email' THEN
    RETURN v_user_email_enabled;
  END IF;
  
  RETURN FALSE;
END;
$$;