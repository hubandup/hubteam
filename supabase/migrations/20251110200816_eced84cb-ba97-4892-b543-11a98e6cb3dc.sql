-- Create table for notification preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_assigned boolean NOT NULL DEFAULT true,
  task_comment boolean NOT NULL DEFAULT true,
  mention boolean NOT NULL DEFAULT true,
  deadline_approaching boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own preferences
CREATE POLICY "Users can view their own notification preferences"
ON public.notification_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can update their own preferences
CREATE POLICY "Users can update their own notification preferences"
ON public.notification_preferences
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can insert their own preferences
CREATE POLICY "Users can insert their own notification preferences"
ON public.notification_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Function to create default preferences for new users
CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to create default preferences when user is created
CREATE TRIGGER on_user_created_notification_preferences
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_default_notification_preferences();

-- Update notification triggers to check preferences
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notify boolean;
BEGIN
  -- Only notify if assigned_to is set and has changed
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    -- Check user preferences
    SELECT COALESCE(task_assigned, true)
    INTO v_notify
    FROM public.notification_preferences
    WHERE user_id = NEW.assigned_to;
    
    IF v_notify THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        NEW.assigned_to,
        'task_assigned',
        'Nouvelle tâche assignée',
        'Vous avez été assigné(e) à la tâche : ' || NEW.title,
        '/projects/' || NEW.project_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_chat_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name text;
  v_room_name text;
  v_notify boolean;
BEGIN
  -- Check user preferences
  SELECT COALESCE(mention, true)
  INTO v_notify
  FROM public.notification_preferences
  WHERE user_id = NEW.user_id;
  
  IF v_notify THEN
    -- Get sender's name
    SELECT COALESCE(display_name, first_name || ' ' || last_name)
    INTO v_sender_name
    FROM public.profiles
    WHERE id = (SELECT user_id FROM public.chat_messages WHERE id = NEW.message_id);
    
    -- Get room name
    SELECT COALESCE(name, 'Message direct')
    INTO v_room_name
    FROM public.chat_rooms
    WHERE id = (SELECT room_id FROM public.chat_messages WHERE id = NEW.message_id);
    
    -- Create notification for mentioned user
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.user_id,
      'mention',
      'Vous avez été mentionné(e)',
      v_sender_name || ' vous a mentionné(e) dans ' || v_room_name,
      '/messages'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_task_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_title text;
  v_task_assigned_to uuid;
  v_commenter_name text;
  v_notify boolean;
BEGIN
  -- Get task details
  SELECT title, assigned_to
  INTO v_task_title, v_task_assigned_to
  FROM public.tasks
  WHERE id = NEW.task_id;
  
  -- Get commenter's name
  SELECT COALESCE(display_name, first_name || ' ' || last_name)
  INTO v_commenter_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- Notify assigned user (if not the commenter)
  IF v_task_assigned_to IS NOT NULL AND v_task_assigned_to != NEW.user_id THEN
    -- Check user preferences
    SELECT COALESCE(task_comment, true)
    INTO v_notify
    FROM public.notification_preferences
    WHERE user_id = v_task_assigned_to;
    
    IF v_notify THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        v_task_assigned_to,
        'task_comment',
        'Nouveau commentaire',
        v_commenter_name || ' a commenté sur : ' || v_task_title,
        '/projects/' || NEW.project_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_upcoming_deadlines()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task record;
  v_notify boolean;
BEGIN
  -- Find tasks with deadlines in the next 24 hours that haven't been completed
  FOR v_task IN
    SELECT t.id, t.title, t.assigned_to, t.end_date, t.project_id
    FROM public.tasks t
    WHERE t.assigned_to IS NOT NULL
      AND t.status != 'done'
      AND t.end_date IS NOT NULL
      AND t.end_date BETWEEN now() AND now() + interval '24 hours'
      AND NOT EXISTS (
        -- Don't notify if already notified in the last 12 hours
        SELECT 1 FROM public.notifications
        WHERE user_id = t.assigned_to
          AND type = 'deadline_approaching'
          AND message LIKE '%' || t.title || '%'
          AND created_at > now() - interval '12 hours'
      )
  LOOP
    -- Check user preferences
    SELECT COALESCE(deadline_approaching, true)
    INTO v_notify
    FROM public.notification_preferences
    WHERE user_id = v_task.assigned_to;
    
    IF v_notify THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        v_task.assigned_to,
        'deadline_approaching',
        'Deadline approchante',
        'La tâche "' || v_task.title || '" est due dans moins de 24h',
        '/projects/' || v_task.project_id
      );
    END IF;
  END LOOP;
END;
$$;