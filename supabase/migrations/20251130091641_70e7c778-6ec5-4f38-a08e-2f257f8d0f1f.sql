-- Améliorer le trigger de notification pour vérifier les préférences et mieux gérer les erreurs
CREATE OR REPLACE FUNCTION public.send_push_notification_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_unread_count INTEGER;
  v_request_id BIGINT;
  v_should_send_email BOOLEAN := false;
  v_notification_type TEXT;
BEGIN
  -- Extraire le type de notification
  v_notification_type := NEW.type;
  
  -- Vérifier les préférences de notification de l'utilisateur
  SELECT 
    CASE 
      WHEN v_notification_type = 'task_assigned' THEN COALESCE(task_assigned, true)
      WHEN v_notification_type = 'task_comment' THEN COALESCE(task_comment, true)
      WHEN v_notification_type = 'mention' THEN COALESCE(mention, true)
      WHEN v_notification_type IN ('deadline_approaching', 'deadline_overdue') THEN COALESCE(deadline_approaching, true)
      ELSE true
    END INTO v_should_send_email
  FROM notification_preferences
  WHERE user_id = NEW.user_id;
  
  -- Si pas de préférences trouvées, envoyer par défaut
  IF v_should_send_email IS NULL THEN
    v_should_send_email := true;
  END IF;
  
  -- Get unread notification count for the user
  SELECT COUNT(*) INTO v_unread_count
  FROM notifications
  WHERE user_id = NEW.user_id AND read = false;
  
  -- Send push notification via edge function (async)
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
  
  -- Send email notification only if user preference allows it
  IF v_should_send_email THEN
    SELECT INTO v_request_id net.http_post(
      url := 'https://ytjxeypquqkrmbmhzfqi.supabase.co/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0anhleXBxdXFrcm1ibWh6ZnFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2OTk1NjEsImV4cCI6MjA3ODI3NTU2MX0.Xrj3WXrJH8XSXtjFJPPCZNEtjKCCC3AScD6Dcl2sjws'
      ),
      body := jsonb_build_object(
        'userId', NEW.user_id,
        'title', NEW.title,
        'message', NEW.message,
        'link', NEW.link
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;