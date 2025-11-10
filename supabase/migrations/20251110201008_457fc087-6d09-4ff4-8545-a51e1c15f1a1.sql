-- Function to log client changes
CREATE OR REPLACE FUNCTION public.log_client_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_type text;
  v_old_values jsonb;
  v_new_values jsonb;
BEGIN
  -- Determine action type
  IF (TG_OP = 'DELETE') THEN
    v_action_type := 'deleted';
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_action_type := 'updated';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
  ELSIF (TG_OP = 'INSERT') THEN
    v_action_type := 'created';
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
  END IF;

  -- Insert activity log
  INSERT INTO public.activity_log (
    user_id,
    entity_type,
    entity_id,
    action_type,
    old_values,
    new_values
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'client',
    COALESCE(NEW.id, OLD.id),
    v_action_type,
    v_old_values,
    v_new_values
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Triggers for clients
DROP TRIGGER IF EXISTS trigger_log_client_insert ON public.clients;
CREATE TRIGGER trigger_log_client_insert
AFTER INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.log_client_changes();

DROP TRIGGER IF EXISTS trigger_log_client_update ON public.clients;
CREATE TRIGGER trigger_log_client_update
AFTER UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.log_client_changes();

DROP TRIGGER IF EXISTS trigger_log_client_delete ON public.clients;
CREATE TRIGGER trigger_log_client_delete
AFTER DELETE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.log_client_changes();

-- Function to log project changes
CREATE OR REPLACE FUNCTION public.log_project_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_type text;
  v_old_values jsonb;
  v_new_values jsonb;
BEGIN
  -- Determine action type
  IF (TG_OP = 'DELETE') THEN
    v_action_type := 'deleted';
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_action_type := 'updated';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
  ELSIF (TG_OP = 'INSERT') THEN
    v_action_type := 'created';
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
  END IF;

  -- Insert activity log
  INSERT INTO public.activity_log (
    user_id,
    entity_type,
    entity_id,
    action_type,
    old_values,
    new_values
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'project',
    COALESCE(NEW.id, OLD.id),
    v_action_type,
    v_old_values,
    v_new_values
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Triggers for projects
DROP TRIGGER IF EXISTS trigger_log_project_insert ON public.projects;
CREATE TRIGGER trigger_log_project_insert
AFTER INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.log_project_changes();

DROP TRIGGER IF EXISTS trigger_log_project_update ON public.projects;
CREATE TRIGGER trigger_log_project_update
AFTER UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.log_project_changes();

DROP TRIGGER IF EXISTS trigger_log_project_delete ON public.projects;
CREATE TRIGGER trigger_log_project_delete
AFTER DELETE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.log_project_changes();

-- Function to log task changes
CREATE OR REPLACE FUNCTION public.log_task_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_type text;
  v_old_values jsonb;
  v_new_values jsonb;
BEGIN
  -- Determine action type
  IF (TG_OP = 'DELETE') THEN
    v_action_type := 'deleted';
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_action_type := 'updated';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
  ELSIF (TG_OP = 'INSERT') THEN
    v_action_type := 'created';
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
  END IF;

  -- Insert activity log
  INSERT INTO public.activity_log (
    user_id,
    entity_type,
    entity_id,
    action_type,
    old_values,
    new_values
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'task',
    COALESCE(NEW.id, OLD.id),
    v_action_type,
    v_old_values,
    v_new_values
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Triggers for tasks
DROP TRIGGER IF EXISTS trigger_log_task_insert ON public.tasks;
CREATE TRIGGER trigger_log_task_insert
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_task_changes();

DROP TRIGGER IF EXISTS trigger_log_task_update ON public.tasks;
CREATE TRIGGER trigger_log_task_update
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_task_changes();

DROP TRIGGER IF EXISTS trigger_log_task_delete ON public.tasks;
CREATE TRIGGER trigger_log_task_delete
AFTER DELETE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_task_changes();