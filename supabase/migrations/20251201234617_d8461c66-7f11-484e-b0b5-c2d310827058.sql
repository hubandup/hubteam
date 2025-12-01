-- Drop existing trigger function for projects
DROP TRIGGER IF EXISTS projects_activity_log_trigger ON projects;
DROP FUNCTION IF EXISTS log_project_activity();

-- Create improved trigger function that includes client information
CREATE OR REPLACE FUNCTION log_project_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_info RECORD;
BEGIN
  -- Get client information if available
  SELECT c.company AS client_name, c.logo_url AS client_logo_url
  INTO client_info
  FROM project_clients pc
  JOIN clients c ON c.id = pc.client_id
  WHERE pc.project_id = COALESCE(NEW.id, OLD.id)
  LIMIT 1;

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO activity_log (
      entity_type,
      entity_id,
      action_type,
      user_id,
      new_values
    ) VALUES (
      'projects',
      NEW.id,
      'INSERT',
      NEW.created_by,
      jsonb_build_object(
        'name', NEW.name,
        'description', NEW.description,
        'status', NEW.status,
        'client_name', client_info.client_name,
        'client_logo_url', client_info.client_logo_url
      )
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO activity_log (
      entity_type,
      entity_id,
      action_type,
      user_id,
      old_values,
      new_values
    ) VALUES (
      'projects',
      NEW.id,
      'UPDATE',
      auth.uid(),
      jsonb_build_object(
        'name', OLD.name,
        'status', OLD.status,
        'archived', OLD.archived
      ),
      jsonb_build_object(
        'name', NEW.name,
        'status', NEW.status,
        'archived', NEW.archived,
        'client_name', client_info.client_name,
        'client_logo_url', client_info.client_logo_url
      )
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO activity_log (
      entity_type,
      entity_id,
      action_type,
      user_id,
      old_values
    ) VALUES (
      'projects',
      OLD.id,
      'DELETE',
      auth.uid(),
      jsonb_build_object(
        'name', OLD.name
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Recreate trigger
CREATE TRIGGER projects_activity_log_trigger
AFTER INSERT OR UPDATE OR DELETE ON projects
FOR EACH ROW
EXECUTE FUNCTION log_project_activity();