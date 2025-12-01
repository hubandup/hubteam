-- Update existing project activity logs with client information
DO $$
DECLARE
  activity_record RECORD;
  client_info RECORD;
BEGIN
  -- Loop through all project activity logs
  FOR activity_record IN
    SELECT id, entity_id, new_values
    FROM activity_log
    WHERE entity_type = 'projects'
      AND action_type = 'INSERT'
  LOOP
    -- Get client information for this project
    SELECT c.company AS client_name, c.logo_url AS client_logo_url
    INTO client_info
    FROM project_clients pc
    JOIN clients c ON c.id = pc.client_id
    WHERE pc.project_id = activity_record.entity_id
    LIMIT 1;
    
    -- Update activity_log with client info if found
    IF client_info IS NOT NULL THEN
      UPDATE activity_log
      SET new_values = COALESCE(new_values, '{}'::jsonb) || jsonb_build_object(
        'client_name', client_info.client_name,
        'client_logo_url', client_info.client_logo_url
      )
      WHERE id = activity_record.id;
      
      RAISE NOTICE 'Updated activity_log % for project % with client info', activity_record.id, activity_record.entity_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Migration completed: updated project activity logs with client information';
END $$;