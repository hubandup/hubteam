-- Clean up duplicate logging triggers and recent duplicate logs
BEGIN;

-- Drop redundant logging triggers on clients
DROP TRIGGER IF EXISTS log_client_changes ON public.clients;
DROP TRIGGER IF EXISTS trigger_log_client_insert ON public.clients;
DROP TRIGGER IF EXISTS trigger_log_client_update ON public.clients;
DROP TRIGGER IF EXISTS trigger_log_client_delete ON public.clients;

-- Drop redundant logging triggers on projects
DROP TRIGGER IF EXISTS log_project_changes ON public.projects;
DROP TRIGGER IF EXISTS trigger_log_project_insert ON public.projects;
DROP TRIGGER IF EXISTS trigger_log_project_update ON public.projects;
DROP TRIGGER IF EXISTS trigger_log_project_delete ON public.projects;

-- Drop redundant logging triggers on tasks
DROP TRIGGER IF EXISTS log_task_changes ON public.tasks;
DROP TRIGGER IF EXISTS trigger_log_task_insert ON public.tasks;
DROP TRIGGER IF EXISTS trigger_log_task_update ON public.tasks;
DROP TRIGGER IF EXISTS trigger_log_task_delete ON public.tasks;

-- Drop redundant logging triggers on task_comments and project_attachments
DROP TRIGGER IF EXISTS log_task_comment_changes ON public.task_comments;
DROP TRIGGER IF EXISTS log_project_attachment_changes ON public.project_attachments;

-- Note: We keep the single consolidated triggers created previously:
--   log_client_changes_trigger, log_project_changes_trigger, log_task_changes_trigger
--   log_task_comment_changes_trigger, log_project_attachment_changes_trigger

-- Remove duplicate logs in the last 7 days, keeping the first occurrence
WITH recent AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, entity_type, entity_id, action_type, date_trunc('second', created_at)
           ORDER BY id
         ) AS rn
  FROM public.activity_log
  WHERE created_at > now() - interval '7 days'
)
DELETE FROM public.activity_log a
USING recent r
WHERE a.id = r.id AND r.rn > 1;

COMMIT;