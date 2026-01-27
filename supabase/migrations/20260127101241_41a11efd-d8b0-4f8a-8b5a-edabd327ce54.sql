-- =====================================================
-- NOTIFICATION SYSTEM REFACTOR - Security + Outbox Pattern
-- =====================================================

-- 1. Create notification_outbox table for async processing
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Index for efficient polling
CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending 
  ON public.notification_outbox(status, created_at) 
  WHERE status = 'pending';

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_notification_outbox_processed 
  ON public.notification_outbox(processed_at) 
  WHERE status IN ('sent', 'failed');

-- 2. Create normalized notification_user_preferences table
CREATE TABLE IF NOT EXISTS public.notification_user_preferences (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notification_type)
);

-- RLS for notification_user_preferences
ALTER TABLE public.notification_user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences" ON public.notification_user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.notification_user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.notification_user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS for notification_outbox (service role only via security definer functions)
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

-- 3. Migrate existing preferences to new table
INSERT INTO public.notification_user_preferences (user_id, notification_type, push_enabled, email_enabled)
SELECT 
  np.user_id,
  'project_assigned',
  COALESCE(np.project_assigned_push, true),
  COALESCE(np.project_assigned_email, true)
FROM public.notification_preferences np
WHERE np.user_id IS NOT NULL
ON CONFLICT (user_id, notification_type) DO NOTHING;

INSERT INTO public.notification_user_preferences (user_id, notification_type, push_enabled, email_enabled)
SELECT 
  np.user_id,
  'task_assigned',
  COALESCE(np.task_assigned_push, true),
  COALESCE(np.task_assigned_email, true)
FROM public.notification_preferences np
WHERE np.user_id IS NOT NULL
ON CONFLICT (user_id, notification_type) DO NOTHING;

INSERT INTO public.notification_user_preferences (user_id, notification_type, push_enabled, email_enabled)
SELECT 
  np.user_id,
  'task_comment',
  COALESCE(np.task_comment_push, true),
  COALESCE(np.task_comment_email, false)
FROM public.notification_preferences np
WHERE np.user_id IS NOT NULL
ON CONFLICT (user_id, notification_type) DO NOTHING;

INSERT INTO public.notification_user_preferences (user_id, notification_type, push_enabled, email_enabled)
SELECT 
  np.user_id,
  'mention',
  COALESCE(np.mention_push, true),
  COALESCE(np.mention_email, false)
FROM public.notification_preferences np
WHERE np.user_id IS NOT NULL
ON CONFLICT (user_id, notification_type) DO NOTHING;

INSERT INTO public.notification_user_preferences (user_id, notification_type, push_enabled, email_enabled)
SELECT 
  np.user_id,
  'message',
  COALESCE(np.message_push, true),
  COALESCE(np.message_email, true)
FROM public.notification_preferences np
WHERE np.user_id IS NOT NULL
ON CONFLICT (user_id, notification_type) DO NOTHING;

INSERT INTO public.notification_user_preferences (user_id, notification_type, push_enabled, email_enabled)
SELECT 
  np.user_id,
  'deadline_approaching',
  COALESCE(np.deadline_approaching_push, true),
  COALESCE(np.deadline_approaching_email, false)
FROM public.notification_preferences np
WHERE np.user_id IS NOT NULL
ON CONFLICT (user_id, notification_type) DO NOTHING;

INSERT INTO public.notification_user_preferences (user_id, notification_type, push_enabled, email_enabled)
SELECT 
  np.user_id,
  'reaction',
  COALESCE(np.reaction_push, true),
  COALESCE(np.reaction_email, false)
FROM public.notification_preferences np
WHERE np.user_id IS NOT NULL
ON CONFLICT (user_id, notification_type) DO NOTHING;

-- 4. Drop the old trigger that calls HTTP (SECURITY FIX!)
DROP TRIGGER IF EXISTS send_notification_push_trigger ON public.notifications;
DROP FUNCTION IF EXISTS public.send_push_notification_trigger() CASCADE;

-- 5. Create new trigger that only inserts into outbox (NO HTTP CALLS!)
CREATE OR REPLACE FUNCTION public.queue_notification_for_processing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simply queue the notification for async processing by edge function
  INSERT INTO public.notification_outbox (
    notification_id,
    user_id,
    notification_type,
    payload
  ) VALUES (
    NEW.id,
    NEW.user_id,
    NEW.type,
    jsonb_build_object(
      'title', NEW.title,
      'message', NEW.message,
      'link', COALESCE(NEW.link, '/'),
      'entity_type', NEW.entity_type,
      'entity_id', NEW.entity_id
    )
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER queue_notification_outbox_trigger
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_notification_for_processing();

-- 6. Rewrite should_send_notification without dynamic SQL
CREATE OR REPLACE FUNCTION public.should_send_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_channel TEXT
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
  v_force_email BOOLEAN;
  v_user_pref_push BOOLEAN;
  v_user_pref_email BOOLEAN;
BEGIN
  -- Get user's role with fallback to 'team' if not found
  SELECT role INTO v_user_role
  FROM user_roles
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- Fallback: if no role, assume team (log warning would be in edge function)
  IF v_user_role IS NULL THEN
    v_user_role := 'team';
  END IF;
  
  -- Get global preference for this role and notification type
  SELECT enabled, force_email INTO v_global_enabled, v_force_email
  FROM notification_preferences_global
  WHERE role = v_user_role AND notification_type = p_notification_type;
  
  -- Default to enabled if no global pref exists
  v_global_enabled := COALESCE(v_global_enabled, true);
  v_force_email := COALESCE(v_force_email, false);
  
  -- If globally disabled for this role, don't send
  IF NOT v_global_enabled THEN
    RETURN false;
  END IF;
  
  -- Client role special rules: only project_assigned and message allowed
  IF v_user_role = 'client' AND p_notification_type NOT IN ('project_assigned', 'message') THEN
    RETURN false;
  END IF;
  
  -- If force_email is set and checking email channel, always send
  IF p_channel = 'email' AND v_force_email THEN
    RETURN true;
  END IF;
  
  -- Get user preferences from normalized table (no dynamic SQL!)
  SELECT push_enabled, email_enabled 
  INTO v_user_pref_push, v_user_pref_email
  FROM notification_user_preferences
  WHERE user_id = p_user_id AND notification_type = p_notification_type;
  
  -- Default to enabled if no user pref exists
  v_user_pref_push := COALESCE(v_user_pref_push, true);
  v_user_pref_email := COALESCE(v_user_pref_email, false);
  
  -- Return based on channel
  IF p_channel = 'push' THEN
    RETURN v_user_pref_push;
  ELSIF p_channel = 'email' THEN
    RETURN v_user_pref_email;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- 7. Create helper function to get user role with safe fallback
CREATE OR REPLACE FUNCTION public.get_user_role_safe(p_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM user_roles WHERE user_id = p_user_id LIMIT 1),
    'team'::app_role
  );
$$;

-- 8. Ensure default role is assigned on user creation
-- Update handle_new_user to always assign a role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invited_role app_role;
  v_user_count INTEGER;
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email
  );
  
  -- Check if user was invited with a specific role
  v_invited_role := (NEW.raw_user_meta_data->>'role')::app_role;
  
  -- Assign role
  IF v_invited_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_invited_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- Count existing users to determine if first user
    SELECT COUNT(*) INTO v_user_count FROM auth.users;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
      NEW.id,
      CASE WHEN v_user_count = 1 THEN 'admin'::app_role ELSE 'team'::app_role END
    )
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  -- Create default notification preferences for all types
  INSERT INTO public.notification_user_preferences (user_id, notification_type, push_enabled, email_enabled)
  VALUES 
    (NEW.id, 'project_assigned', true, true),
    (NEW.id, 'task_assigned', true, true),
    (NEW.id, 'task_comment', true, false),
    (NEW.id, 'mention', true, false),
    (NEW.id, 'message', true, true),
    (NEW.id, 'deadline_approaching', true, false),
    (NEW.id, 'reaction', true, false)
  ON CONFLICT (user_id, notification_type) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 9. Enable realtime for outbox (for monitoring)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_outbox;