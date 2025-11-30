-- Fix notification links from /projects/ to /project/ (singular)

-- Update notify_task_assignment function
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        '/project/' || NEW.project_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Update notify_task_comment function
CREATE OR REPLACE FUNCTION public.notify_task_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        '/project/' || NEW.project_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update notify_task_comment_mentions function
CREATE OR REPLACE FUNCTION public.notify_task_comment_mentions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
            '/project/' || v_project_id
          );
        ELSE
          INSERT INTO public.notifications (user_id, type, title, message, link)
          VALUES (
            v_mentioned_user_id,
            'mention',
            'Vous avez été mentionné(e)',
            v_commenter_name || ' vous a mentionné(e) dans un commentaire de projet',
            '/project/' || v_project_id
          );
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$function$;