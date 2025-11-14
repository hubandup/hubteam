-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to send push notification when a new notification is created
CREATE OR REPLACE FUNCTION send_push_notification_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unread_count INTEGER;
  v_request_id BIGINT;
BEGIN
  -- Get unread notification count for the user
  SELECT COUNT(*) INTO v_unread_count
  FROM notifications
  WHERE user_id = NEW.user_id AND read = false;
  
  -- Send push notification via edge function (async, won't block the insert)
  -- Using the actual Supabase project URL
  SELECT INTO v_request_id net.http_post(
    url := 'https://ytjxeypquqkrmbmhzfqi.supabase.co/functions/v1/send-notification-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0anhleXBxdXFrcm1ibWh6ZnFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2OTk1NjEsImV4cCI6MjA3ODI3NTU2MX0.Xrj3WXrJH8XSXtjFJPPCZNEtjKCCC3AScD6Dcl2sjws'
    ),
    body := jsonb_build_object(
      'userId', NEW.user_id,
      'title', NEW.title,
      'body', NEW.message,
      'url', COALESCE(NEW.link, '/'),
      'badgeCount', v_unread_count
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS on_notification_created ON notifications;
CREATE TRIGGER on_notification_created
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_push_notification_trigger();