-- Update the trigger function to extend the time window to 30 seconds
CREATE OR REPLACE FUNCTION update_project_activity_with_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_info RECORD;
  activity_log_id uuid;
BEGIN
  -- Only process INSERT operations
  IF (TG_OP = 'INSERT') THEN
    -- Get client information
    SELECT c.company AS client_name, c.logo_url AS client_logo_url
    INTO client_info
    FROM clients c
    WHERE c.id = NEW.client_id;

    -- Find the most recent INSERT activity_log entry for this project (extended to 30 seconds)
    SELECT id INTO activity_log_id
    FROM activity_log
    WHERE entity_type = 'projects'
      AND entity_id = NEW.project_id
      AND action_type = 'INSERT'
      AND created_at > NOW() - INTERVAL '30 seconds'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Update the activity_log entry if found
    IF activity_log_id IS NOT NULL THEN
      UPDATE activity_log
      SET new_values = COALESCE(new_values, '{}'::jsonb) || jsonb_build_object(
        'client_name', client_info.client_name,
        'client_logo_url', client_info.client_logo_url
      )
      WHERE id = activity_log_id;
      
      RAISE LOG 'Updated activity_log % with client info for project %', activity_log_id, NEW.project_id;
    ELSE
      RAISE WARNING 'No recent activity_log found for project %', NEW.project_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;