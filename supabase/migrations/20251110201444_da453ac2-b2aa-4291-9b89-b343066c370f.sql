-- Function to notify mentioned users in task comments
CREATE OR REPLACE FUNCTION public.notify_task_comment_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commenter_name text;
  v_task_title text;
  v_project_id uuid;
  v_mentioned_user_id uuid;
  v_notify boolean;
  v_mention_match text;
BEGIN
  -- Get commenter's name
  SELECT COALESCE(display_name, first_name || ' ' || last_name)
  INTO v_commenter_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- Get task and project info if available
  IF NEW.task_id IS NOT NULL THEN
    SELECT title, project_id
    INTO v_task_title, v_project_id
    FROM public.tasks
    WHERE id = NEW.task_id;
  ELSE
    v_project_id := NEW.project_id;
  END IF;
  
  -- Extract and notify all mentioned users from the comment content
  -- Format: @[Display Name](user-id)
  FOR v_mention_match IN 
    SELECT regexp_matches[2]
    FROM regexp_matches(NEW.content, '@\[([^\]]+)\]\(([a-f0-9-]+)\)', 'g') AS regexp_matches
  LOOP
    v_mentioned_user_id := v_mention_match::uuid;
    
    -- Don't notify if user mentions themselves
    IF v_mentioned_user_id != NEW.user_id THEN
      -- Check user preferences
      SELECT COALESCE(mention, true)
      INTO v_notify
      FROM public.notification_preferences
      WHERE user_id = v_mentioned_user_id;
      
      IF v_notify THEN
        -- Create notification
        IF NEW.task_id IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, type, title, message, link)
          VALUES (
            v_mentioned_user_id,
            'mention',
            'Vous avez été mentionné(e)',
            v_commenter_name || ' vous a mentionné(e) dans un commentaire sur "' || v_task_title || '"',
            '/projects/' || v_project_id
          );
        ELSE
          INSERT INTO public.notifications (user_id, type, title, message, link)
          VALUES (
            v_mentioned_user_id,
            'mention',
            'Vous avez été mentionné(e)',
            v_commenter_name || ' vous a mentionné(e) dans un commentaire de projet',
            '/projects/' || v_project_id
          );
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger for task comment mention notifications
DROP TRIGGER IF EXISTS trigger_notify_task_comment_mentions ON public.task_comments;
CREATE TRIGGER trigger_notify_task_comment_mentions
AFTER INSERT ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_comment_mentions();