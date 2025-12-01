-- Modifier le trigger pour désactiver l'envoi immédiat d'emails
-- Garde les push notifications mais retire les emails
CREATE OR REPLACE FUNCTION public.send_push_notification_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_unread_count INTEGER;
  v_request_id BIGINT;
BEGIN
  -- Get unread notification count for the user
  SELECT COUNT(*) INTO v_unread_count
  FROM notifications
  WHERE user_id = NEW.user_id AND read = false;
  
  -- Send push notification via edge function (async) with 15s timeout
  -- Emails are now sent via digest system every 6 hours instead
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
    ),
    timeout_milliseconds := 15000
  );
  
  RETURN NEW;
END;
$function$;
