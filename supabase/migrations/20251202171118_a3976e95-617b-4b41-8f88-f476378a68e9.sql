-- Update notify_upcoming_deadlines function to exclude completed/archived projects
CREATE OR REPLACE FUNCTION public.notify_upcoming_deadlines()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task record;
  v_notify boolean;
BEGIN
  -- Find tasks with deadlines in the next 24 hours that haven't been completed
  -- Exclude tasks from completed or archived projects
  FOR v_task IN
    SELECT t.id, t.title, t.assigned_to, t.end_date, t.project_id
    FROM public.tasks t
    LEFT JOIN public.projects p ON p.id = t.project_id
    WHERE t.assigned_to IS NOT NULL
      AND t.status != 'done'
      AND t.end_date IS NOT NULL
      AND t.end_date BETWEEN now() AND now() + interval '24 hours'
      -- Exclude completed or archived projects
      AND (p.id IS NULL OR (p.status NOT IN ('completed', 'done', 'cancelled') AND p.archived = false))
      AND NOT EXISTS (
        -- Don't notify if already notified in the last 12 hours
        SELECT 1 FROM public.notifications
        WHERE user_id = t.assigned_to
          AND type = 'deadline_approaching'
          AND message LIKE '%' || t.title || '%'
          AND created_at > now() - interval '12 hours'
      )
  LOOP
    -- Check user preferences
    SELECT COALESCE(deadline_approaching, true)
    INTO v_notify
    FROM public.notification_preferences
    WHERE user_id = v_task.assigned_to;
    
    IF v_notify THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        v_task.assigned_to,
        'deadline_approaching',
        'Deadline approchante',
        'La tâche "' || v_task.title || '" est due dans moins de 24h',
        '/projects/' || v_task.project_id
      );
    END IF;
  END LOOP;
END;
$function$;