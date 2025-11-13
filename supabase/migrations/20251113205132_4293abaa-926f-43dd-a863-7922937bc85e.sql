-- Create function to handle reaction notifications
CREATE OR REPLACE FUNCTION public.handle_activity_reaction_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_owner_id UUID;
  v_actor_name TEXT;
  v_reaction_label TEXT;
  v_notification_enabled BOOLEAN;
BEGIN
  -- Get the activity owner
  SELECT user_id INTO v_activity_owner_id
  FROM activity_log
  WHERE id = NEW.activity_id;

  -- Don't notify if user reacts to their own activity
  IF v_activity_owner_id = NEW.user_id OR v_activity_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if user has this notification type enabled
  SELECT COALESCE(mention, true) INTO v_notification_enabled
  FROM notification_preferences
  WHERE user_id = v_activity_owner_id;

  IF NOT v_notification_enabled THEN
    RETURN NEW;
  END IF;

  -- Get actor name
  SELECT CONCAT(first_name, ' ', last_name) INTO v_actor_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- Get reaction label
  v_reaction_label := CASE NEW.reaction_type
    WHEN 'like' THEN 'a aimé'
    WHEN 'love' THEN 'adore'
    WHEN 'clap' THEN 'applaudit'
    WHEN 'fire' THEN 'trouve impressionnant'
    WHEN 'celebrate' THEN 'félicite pour'
    ELSE 'a réagi à'
  END;

  -- Create notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    link
  ) VALUES (
    v_activity_owner_id,
    'reaction',
    'Nouvelle réaction',
    v_actor_name || ' ' || v_reaction_label || ' votre activité',
    '/feed'
  );

  -- Send push notification
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'userId', v_activity_owner_id::text,
      'title', 'Nouvelle réaction',
      'body', v_actor_name || ' ' || v_reaction_label || ' votre activité',
      'url', '/feed'
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger for reaction notifications
DROP TRIGGER IF EXISTS on_activity_reaction_created ON public.activity_reactions;
CREATE TRIGGER on_activity_reaction_created
  AFTER INSERT ON public.activity_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_activity_reaction_notification();