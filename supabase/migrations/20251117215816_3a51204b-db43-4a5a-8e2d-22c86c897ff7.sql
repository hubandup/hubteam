
-- Fix the ambiguous column reference in notify_post_comment_mentions function
CREATE OR REPLACE FUNCTION public.notify_post_comment_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_commenter_name TEXT;
  v_post_preview TEXT;
  v_mentioned_user_id UUID;
  v_notify BOOLEAN;
  v_mention_match TEXT;
BEGIN
  -- Get commenter's name
  SELECT CONCAT(first_name, ' ', last_name) INTO v_commenter_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Get post preview (FIX: qualify the content column with table alias)
  SELECT LEFT(up.content, 50) INTO v_post_preview
  FROM user_posts up
  JOIN user_post_comments upc ON upc.post_id = up.id
  WHERE upc.id = NEW.id;
  
  IF LENGTH(v_post_preview) > 50 THEN
    v_post_preview := v_post_preview || '...';
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
      SELECT COALESCE(mention, true) INTO v_notify
      FROM notification_preferences
      WHERE user_id = v_mentioned_user_id;
      
      IF v_notify THEN
        -- Create notification
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (
          v_mentioned_user_id,
          'mention',
          'Vous avez été mentionné(e)',
          v_commenter_name || ' vous a mentionné(e) dans un commentaire',
          '/feed'
        );
        
        -- Store mention in mentions table
        INSERT INTO user_post_comment_mentions (comment_id, user_id)
        VALUES (NEW.id, v_mentioned_user_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$function$;
