-- Function to create notification for task assignment
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify if assigned_to is set and has changed
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.assigned_to,
      'task_assigned',
      'Nouvelle tâche assignée',
      'Vous avez été assigné(e) à la tâche : ' || NEW.title,
      '/projects/' || NEW.project_id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for task assignment notifications
DROP TRIGGER IF EXISTS trigger_notify_task_assignment ON public.tasks;
CREATE TRIGGER trigger_notify_task_assignment
AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_assignment();

-- Function to create notification for mentions in chat messages
CREATE OR REPLACE FUNCTION public.notify_chat_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name text;
  v_room_name text;
BEGIN
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
  
  RETURN NEW;
END;
$$;

-- Trigger for mention notifications
DROP TRIGGER IF EXISTS trigger_notify_chat_mention ON public.chat_message_mentions;
CREATE TRIGGER trigger_notify_chat_mention
AFTER INSERT ON public.chat_message_mentions
FOR EACH ROW
EXECUTE FUNCTION public.notify_chat_mention();

-- Function to create notification for new comments on tasks
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
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_task_assigned_to,
      'task_comment',
      'Nouveau commentaire',
      v_commenter_name || ' a commenté sur : ' || v_task_title,
      '/projects/' || NEW.project_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for task comment notifications
DROP TRIGGER IF EXISTS trigger_notify_task_comment ON public.task_comments;
CREATE TRIGGER trigger_notify_task_comment
AFTER INSERT ON public.task_comments
FOR EACH ROW
WHEN (NEW.task_id IS NOT NULL)
EXECUTE FUNCTION public.notify_task_comment();

-- Function to check and notify for upcoming deadlines
CREATE OR REPLACE FUNCTION public.notify_upcoming_deadlines()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task record;
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
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_task.assigned_to,
      'deadline_approaching',
      'Deadline approchante',
      'La tâche "' || v_task.title || '" est due dans moins de 24h',
      '/projects/' || v_task.project_id
    );
  END LOOP;
END;
$$;