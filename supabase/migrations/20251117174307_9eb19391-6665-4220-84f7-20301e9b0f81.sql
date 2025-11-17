-- Create trigger function for post reaction notifications
CREATE OR REPLACE FUNCTION public.handle_post_reaction_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner_id UUID;
  v_actor_name TEXT;
  v_reaction_label TEXT;
  v_notification_enabled BOOLEAN;
  v_post_preview TEXT;
BEGIN
  -- Get the post owner
  SELECT user_id INTO v_post_owner_id
  FROM user_posts
  WHERE id = NEW.post_id;

  -- Don't notify if user reacts to their own post
  IF v_post_owner_id = NEW.user_id OR v_post_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if user has this notification type enabled
  SELECT COALESCE(reaction, true) INTO v_notification_enabled
  FROM notification_preferences
  WHERE user_id = v_post_owner_id;

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
    WHEN 'fire' THEN 'trouve impressionnant'
    WHEN 'celebrate' THEN 'félicite pour'
    ELSE 'a réagi à'
  END;

  -- Get post preview (first 50 chars)
  SELECT LEFT(content, 50) INTO v_post_preview
  FROM user_posts
  WHERE id = NEW.post_id;
  
  IF LENGTH(v_post_preview) < (SELECT LENGTH(content) FROM user_posts WHERE id = NEW.post_id) THEN
    v_post_preview := v_post_preview || '...';
  END IF;

  -- Create notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    link
  ) VALUES (
    v_post_owner_id,
    'reaction',
    'Nouvelle réaction',
    v_actor_name || ' ' || v_reaction_label || ' votre post : "' || v_post_preview || '"',
    '/feed'
  );

  RETURN NEW;
END;
$$;

-- Create trigger on user_post_reactions
CREATE TRIGGER on_post_reaction_created
  AFTER INSERT ON public.user_post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_reaction_notification();