-- Create enum for notification types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE public.notification_type AS ENUM (
      'project_assigned',
      'task_assigned',
      'task_comment',
      'mention',
      'message',
      'deadline_approaching',
      'reaction'
    );
  END IF;
END$$;

-- Create global notification preferences table (admin controls per role)
CREATE TABLE IF NOT EXISTS public.notification_preferences_global (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role public.app_role NOT NULL,
  notification_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  force_email BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role, notification_type)
);

-- Enable RLS
ALTER TABLE public.notification_preferences_global ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write global preferences
CREATE POLICY "Admins can manage global notification preferences"
ON public.notification_preferences_global
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can read global preferences (to know what's enabled)
CREATE POLICY "Users can read global notification preferences"
ON public.notification_preferences_global
FOR SELECT
TO authenticated
USING (true);

-- Add push_enabled and email_enabled columns to notification_preferences
ALTER TABLE public.notification_preferences 
  ADD COLUMN IF NOT EXISTS project_assigned_push BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS project_assigned_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS task_assigned_push BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS task_assigned_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS task_comment_push BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS task_comment_email BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mention_push BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mention_email BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS message_push BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS message_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deadline_approaching_push BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deadline_approaching_email BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reaction_push BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reaction_email BOOLEAN NOT NULL DEFAULT false;

-- Add entity tracking columns to notifications table
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID;

-- Insert default global preferences for all roles and notification types
INSERT INTO public.notification_preferences_global (role, notification_type, enabled, force_email)
VALUES 
  -- Admin role
  ('admin', 'project_assigned', true, false),
  ('admin', 'task_assigned', true, false),
  ('admin', 'task_comment', true, false),
  ('admin', 'mention', true, false),
  ('admin', 'message', true, false),
  ('admin', 'deadline_approaching', true, false),
  ('admin', 'reaction', true, false),
  -- Team role
  ('team', 'project_assigned', true, false),
  ('team', 'task_assigned', true, false),
  ('team', 'task_comment', true, false),
  ('team', 'mention', true, false),
  ('team', 'message', true, false),
  ('team', 'deadline_approaching', true, false),
  ('team', 'reaction', true, false),
  -- Agency role
  ('agency', 'project_assigned', true, false),
  ('agency', 'task_assigned', true, false),
  ('agency', 'task_comment', true, false),
  ('agency', 'mention', true, false),
  ('agency', 'message', true, false),
  ('agency', 'deadline_approaching', true, false),
  ('agency', 'reaction', true, false),
  -- Client role - restricted notifications
  ('client', 'project_assigned', true, true),  -- Always force email for clients
  ('client', 'task_assigned', false, false),   -- Clients don't get task notifications
  ('client', 'task_comment', false, false),    -- Clients don't get task comments
  ('client', 'mention', false, false),         -- Clients don't get internal mentions
  ('client', 'message', true, true),           -- Always force email for clients
  ('client', 'deadline_approaching', false, false), -- Clients don't get deadline notifications
  ('client', 'reaction', false, false)         -- Clients don't get reactions
ON CONFLICT (role, notification_type) DO NOTHING;

-- Create function to check if notification should be sent based on global + user preferences
CREATE OR REPLACE FUNCTION public.should_send_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_channel TEXT  -- 'push' or 'email'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role app_role;
  v_global_enabled BOOLEAN;
  v_force_email BOOLEAN;
  v_user_pref BOOLEAN;
BEGIN
  -- Get user's role
  SELECT role INTO v_user_role
  FROM user_roles
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF v_user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get global preference for this role and notification type
  SELECT enabled, force_email INTO v_global_enabled, v_force_email
  FROM notification_preferences_global
  WHERE role = v_user_role AND notification_type = p_notification_type;
  
  -- If globally disabled, don't send
  IF NOT COALESCE(v_global_enabled, true) THEN
    RETURN false;
  END IF;
  
  -- If force_email and checking email channel, always send
  IF p_channel = 'email' AND COALESCE(v_force_email, false) THEN
    RETURN true;
  END IF;
  
  -- Message type cannot be fully disabled by users
  IF p_notification_type = 'message' AND p_channel = 'push' THEN
    RETURN true;
  END IF;
  
  -- Check user preference
  EXECUTE format(
    'SELECT %I FROM notification_preferences WHERE user_id = $1',
    p_notification_type || '_' || p_channel
  ) INTO v_user_pref USING p_user_id;
  
  RETURN COALESCE(v_user_pref, true);
END;
$$;

-- Create function to get user role for notification logic
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_roles WHERE user_id = p_user_id LIMIT 1;
$$;

-- Update the send_push_notification_trigger function to use new logic
CREATE OR REPLACE FUNCTION public.send_push_notification_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_push BOOLEAN;
  v_should_email BOOLEAN;
  v_force_email BOOLEAN;
  v_user_role app_role;
  v_request_id BIGINT;
  v_unread_count INTEGER;
BEGIN
  -- Get user role
  v_user_role := get_user_role(NEW.user_id);
  
  -- Check if we should send push
  v_should_push := should_send_notification(NEW.user_id, NEW.type, 'push');
  
  -- Check if we should send email
  v_should_email := should_send_notification(NEW.user_id, NEW.type, 'email');
  
  -- Get force_email setting
  SELECT force_email INTO v_force_email
  FROM notification_preferences_global
  WHERE role = v_user_role AND notification_type = NEW.type;
  
  -- If nothing to send, exit early
  IF NOT v_should_push AND NOT v_should_email THEN
    RETURN NEW;
  END IF;
  
  -- Get unread notification count for the user
  SELECT COUNT(*) INTO v_unread_count
  FROM notifications
  WHERE user_id = NEW.user_id AND read = false;
  
  -- Send push notification via edge function (async) with 15s timeout
  SELECT INTO v_request_id net.http_post(
    url := 'https://ytjxeypquqkrmbmhzfqi.supabase.co/functions/v1/send-notification-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0anhleXBxdXFrcm1ibWh6ZnFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2OTk1NjEsImV4cCI6MjA3ODI3NTU2MX0.Xrj3WXrJH8XSXtjFJPPCZNEtjKCCC3AScD6Dcl2sjws'
    ),
    body := jsonb_build_object(
      'userId', NEW.user_id,
      'title', NEW.title,
      'body', NEW.message,
      'url', COALESCE(NEW.link, '/'),
      'badgeCount', v_unread_count,
      'shouldPush', v_should_push,
      'shouldEmail', v_should_email,
      'forceEmail', COALESCE(v_force_email, false),
      'notificationType', NEW.type,
      'userRole', v_user_role::text
    ),
    timeout_milliseconds := 15000
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_notification_preferences_global_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_notification_preferences_global_updated_at ON notification_preferences_global;
CREATE TRIGGER update_notification_preferences_global_updated_at
  BEFORE UPDATE ON notification_preferences_global
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_global_updated_at();