-- Create user_post_comment_mentions table
CREATE TABLE IF NOT EXISTS public.user_post_comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.user_post_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_post_comment_mentions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view mentions"
  ON public.user_post_comment_mentions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create mentions in their comments"
  ON public.user_post_comment_mentions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_post_comments
      WHERE id = comment_id AND user_id = auth.uid()
    )
  );

-- Create trigger function for post comment mention notifications
CREATE OR REPLACE FUNCTION public.notify_post_comment_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Get post preview
  SELECT LEFT(content, 50) INTO v_post_preview
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
$$;

-- Create trigger on user_post_comments
CREATE TRIGGER on_post_comment_mention_created
  AFTER INSERT ON public.user_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_comment_mentions();