-- Create trigger function for post comment notifications
CREATE OR REPLACE FUNCTION public.handle_post_comment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner_id UUID;
  v_commenter_name TEXT;
  v_notification_enabled BOOLEAN;
  v_post_preview TEXT;
  v_comment_preview TEXT;
BEGIN
  -- Get the post owner
  SELECT user_id INTO v_post_owner_id
  FROM user_posts
  WHERE id = NEW.post_id;

  -- Don't notify if user comments on their own post
  IF v_post_owner_id = NEW.user_id OR v_post_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if user has comment notifications enabled (reuse task_comment preference)
  SELECT COALESCE(task_comment, true) INTO v_notification_enabled
  FROM notification_preferences
  WHERE user_id = v_post_owner_id;

  IF NOT v_notification_enabled THEN
    RETURN NEW;
  END IF;

  -- Get commenter name
  SELECT CONCAT(first_name, ' ', last_name) INTO v_commenter_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- Get post preview (first 50 chars)
  SELECT LEFT(content, 50) INTO v_post_preview
  FROM user_posts
  WHERE id = NEW.post_id;
  
  IF LENGTH(v_post_preview) < (SELECT LENGTH(content) FROM user_posts WHERE id = NEW.post_id) THEN
    v_post_preview := v_post_preview || '...';
  END IF;

  -- Get comment preview (first 100 chars)
  v_comment_preview := LEFT(NEW.content, 100);
  IF LENGTH(NEW.content) > 100 THEN
    v_comment_preview := v_comment_preview || '...';
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
    'task_comment',
    'Nouveau commentaire',
    v_commenter_name || ' a commenté votre post : "' || v_comment_preview || '"',
    '/feed'
  );

  RETURN NEW;
END;
$$;

-- Create trigger on user_post_comments
CREATE TRIGGER on_post_comment_created
  AFTER INSERT ON public.user_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_comment_notification();