-- Create function to create notifications when a message is received
CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_record RECORD;
  sender_name TEXT;
  message_preview TEXT;
BEGIN
  -- Get sender's name
  SELECT CONCAT(first_name, ' ', last_name) INTO sender_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- Create message preview (first 100 chars)
  message_preview := LEFT(NEW.content, 100);
  IF LENGTH(NEW.content) > 100 THEN
    message_preview := message_preview || '...';
  END IF;

  -- Create notification for each room member except the sender
  FOR member_record IN
    SELECT user_id
    FROM chat_room_members
    WHERE room_id = NEW.room_id
    AND user_id != NEW.user_id
  LOOP
    INSERT INTO notifications (user_id, type, title, message, link, read, created_at)
    VALUES (
      member_record.user_id,
      'message',
      'Nouveau message',
      sender_name || ': ' || message_preview,
      '/messages',
      false,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger on chat_messages table
DROP TRIGGER IF EXISTS on_message_created ON chat_messages;
CREATE TRIGGER on_message_created
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION create_message_notification();