-- Améliorer les fonctions de logging pour inclure les informations contextuelles

-- Fonction pour logger les changements de clients avec contexte
CREATE OR REPLACE FUNCTION public.log_client_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_values jsonb;
  v_new_values jsonb;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
    
    INSERT INTO public.activity_log (
      user_id,
      entity_type,
      entity_id,
      action_type,
      old_values,
      new_values
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'clients',
      OLD.id,
      'DELETE',
      v_old_values,
      v_new_values
    );
    RETURN OLD;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    
    INSERT INTO public.activity_log (
      user_id,
      entity_type,
      entity_id,
      action_type,
      old_values,
      new_values
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'clients',
      NEW.id,
      'UPDATE',
      v_old_values,
      v_new_values
    );
    RETURN NEW;
    
  ELSIF (TG_OP = 'INSERT') THEN
    v_new_values := to_jsonb(NEW);
    
    INSERT INTO public.activity_log (
      user_id,
      entity_type,
      entity_id,
      action_type,
      old_values,
      new_values
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'clients',
      NEW.id,
      'INSERT',
      NULL,
      v_new_values
    );
    RETURN NEW;
  END IF;
END;
$$;

-- Fonction pour logger les changements de projets avec contexte
CREATE OR REPLACE FUNCTION public.log_project_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_values jsonb;
  v_new_values jsonb;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_old_values := to_jsonb(OLD);
    
    INSERT INTO public.activity_log (
      user_id,
      entity_type,
      entity_id,
      action_type,
      old_values,
      new_values
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'projects',
      OLD.id,
      'DELETE',
      v_old_values,
      NULL
    );
    RETURN OLD;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    
    INSERT INTO public.activity_log (
      user_id,
      entity_type,
      entity_id,
      action_type,
      old_values,
      new_values
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'projects',
      NEW.id,
      'UPDATE',
      v_old_values,
      v_new_values
    );
    RETURN NEW;
    
  ELSIF (TG_OP = 'INSERT') THEN
    v_new_values := to_jsonb(NEW);
    
    INSERT INTO public.activity_log (
      user_id,
      entity_type,
      entity_id,
      action_type,
      old_values,
      new_values
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'projects',
      NEW.id,
      'INSERT',
      NULL,
      v_new_values
    );
    RETURN NEW;
  END IF;
END;
$$;

-- Fonction pour logger les changements de tâches avec contexte
CREATE OR REPLACE FUNCTION public.log_task_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_values jsonb;
  v_new_values jsonb;
  v_project_name text;
  v_assigned_to_name text;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_old_values := to_jsonb(OLD);
    
    -- Get project name
    SELECT name INTO v_project_name
    FROM projects
    WHERE id = OLD.project_id;
    
    v_old_values := v_old_values || jsonb_build_object('project_name', v_project_name);
    
    INSERT INTO public.activity_log (
      user_id,
      entity_type,
      entity_id,
      action_type,
      old_values,
      new_values
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'tasks',
      OLD.id,
      'DELETE',
      v_old_values,
      NULL
    );
    RETURN OLD;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    
    -- Get project name
    SELECT name INTO v_project_name
    FROM projects
    WHERE id = NEW.project_id;
    
    -- Get assigned user name if exists
    IF NEW.assigned_to IS NOT NULL THEN
      SELECT CONCAT(first_name, ' ', last_name) INTO v_assigned_to_name
      FROM profiles
      WHERE id = NEW.assigned_to;
    END IF;
    
    v_new_values := v_new_values || jsonb_build_object(
      'project_name', v_project_name,
      'assigned_to_name', v_assigned_to_name
    );
    v_old_values := v_old_values || jsonb_build_object('project_name', v_project_name);
    
    INSERT INTO public.activity_log (
      user_id,
      entity_type,
      entity_id,
      action_type,
      old_values,
      new_values
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'tasks',
      NEW.id,
      'UPDATE',
      v_old_values,
      v_new_values
    );
    RETURN NEW;
    
  ELSIF (TG_OP = 'INSERT') THEN
    v_new_values := to_jsonb(NEW);
    
    -- Get project name
    SELECT name INTO v_project_name
    FROM projects
    WHERE id = NEW.project_id;
    
    -- Get assigned user name if exists
    IF NEW.assigned_to IS NOT NULL THEN
      SELECT CONCAT(first_name, ' ', last_name) INTO v_assigned_to_name
      FROM profiles
      WHERE id = NEW.assigned_to;
    END IF;
    
    v_new_values := v_new_values || jsonb_build_object(
      'project_name', v_project_name,
      'assigned_to_name', v_assigned_to_name
    );
    
    INSERT INTO public.activity_log (
      user_id,
      entity_type,
      entity_id,
      action_type,
      old_values,
      new_values
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'tasks',
      NEW.id,
      'INSERT',
      NULL,
      v_new_values
    );
    RETURN NEW;
  END IF;
END;
$$;

-- Fonction pour logger les commentaires de tâches
CREATE OR REPLACE FUNCTION public.log_task_comment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_values jsonb;
  v_task_title text;
  v_project_name text;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_new_values := to_jsonb(NEW);
    
    -- Get task title and project name
    IF NEW.task_id IS NOT NULL THEN
      SELECT t.title, p.name INTO v_task_title, v_project_name
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.id = NEW.task_id;
      
      v_new_values := v_new_values || jsonb_build_object(
        'task_title', v_task_title,
        'project_name', v_project_name
      );
    END IF;
    
    INSERT INTO public.activity_log (
      user_id,
      entity_type,
      entity_id,
      action_type,
      old_values,
      new_values
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'task_comments',
      NEW.id,
      'INSERT',
      NULL,
      v_new_values
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fonction pour logger les pièces jointes de projets
CREATE OR REPLACE FUNCTION public.log_project_attachment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_values jsonb;
  v_project_name text;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_new_values := to_jsonb(NEW);
    
    -- Get project name
    SELECT name INTO v_project_name
    FROM projects
    WHERE id = NEW.project_id;
    
    v_new_values := v_new_values || jsonb_build_object('project_name', v_project_name);
    
    INSERT INTO public.activity_log (
      user_id,
      entity_type,
      entity_id,
      action_type,
      old_values,
      new_values
    ) VALUES (
      COALESCE(NEW.uploaded_by, auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'project_attachments',
      NEW.id,
      'INSERT',
      NULL,
      v_new_values
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer les triggers
DROP TRIGGER IF EXISTS log_client_changes ON clients;
CREATE TRIGGER log_client_changes
  AFTER INSERT OR UPDATE OR DELETE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION log_client_changes();

DROP TRIGGER IF EXISTS log_project_changes ON projects;
CREATE TRIGGER log_project_changes
  AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION log_project_changes();

DROP TRIGGER IF EXISTS log_task_changes ON tasks;
CREATE TRIGGER log_task_changes
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_changes();

DROP TRIGGER IF EXISTS log_task_comment_changes ON task_comments;
CREATE TRIGGER log_task_comment_changes
  AFTER INSERT ON task_comments
  FOR EACH ROW
  EXECUTE FUNCTION log_task_comment_changes();

DROP TRIGGER IF EXISTS log_project_attachment_changes ON project_attachments;
CREATE TRIGGER log_project_attachment_changes
  AFTER INSERT ON project_attachments
  FOR EACH ROW
  EXECUTE FUNCTION log_project_attachment_changes();