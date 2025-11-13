
-- First, let's remove duplicate activity logs keeping only the first occurrence
DELETE FROM activity_log a
WHERE a.id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, entity_type, entity_id, action_type, created_at 
             ORDER BY id
           ) as rn
    FROM activity_log
  ) t
  WHERE t.rn > 1
);

-- Drop existing triggers to prevent duplicates
DROP TRIGGER IF EXISTS log_client_changes_trigger ON clients;
DROP TRIGGER IF EXISTS log_project_changes_trigger ON projects;
DROP TRIGGER IF EXISTS log_task_changes_trigger ON tasks;
DROP TRIGGER IF EXISTS log_task_comment_changes_trigger ON task_comments;
DROP TRIGGER IF EXISTS log_project_attachment_changes_trigger ON project_attachments;

-- Recreate triggers (only once each)
CREATE TRIGGER log_client_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON clients
  FOR EACH ROW EXECUTE FUNCTION log_client_changes();

CREATE TRIGGER log_project_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW EXECUTE FUNCTION log_project_changes();

CREATE TRIGGER log_task_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_changes();

CREATE TRIGGER log_task_comment_changes_trigger
  AFTER INSERT ON task_comments
  FOR EACH ROW EXECUTE FUNCTION log_task_comment_changes();

CREATE TRIGGER log_project_attachment_changes_trigger
  AFTER INSERT ON project_attachments
  FOR EACH ROW EXECUTE FUNCTION log_project_attachment_changes();
