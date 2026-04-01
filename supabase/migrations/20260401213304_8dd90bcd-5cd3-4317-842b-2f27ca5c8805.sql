-- Function: notify client when their project is updated
CREATE OR REPLACE FUNCTION public.notify_client_project_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_record RECORD;
  v_client_user_id UUID;
BEGIN
  IF TG_OP != 'UPDATE' THEN
    RETURN NEW;
  END IF;

  FOR v_client_record IN
    SELECT c.email
    FROM project_clients pc
    JOIN clients c ON c.id = pc.client_id
    WHERE pc.project_id = NEW.id
  LOOP
    SELECT p.id INTO v_client_user_id
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.email = v_client_record.email
      AND ur.role = 'client'
    LIMIT 1;

    IF v_client_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        v_client_user_id,
        'project_updated',
        'Une mise à jour a été faite sur Hub Team',
        'Une mise à jour a été faite sur votre projet "' || NEW.name || '". Cliquez ici pour y accéder.',
        '/project/' || NEW.id
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_client_project_updated ON projects;
CREATE TRIGGER trigger_notify_client_project_updated
  AFTER UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION notify_client_project_updated();

-- Table to track agencies pending Monday notification
CREATE TABLE IF NOT EXISTS public.pending_agency_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  agency_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(agency_id)
);

ALTER TABLE public.pending_agency_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_all_select" ON public.pending_agency_notifications FOR SELECT USING (false);
CREATE POLICY "deny_all_insert" ON public.pending_agency_notifications FOR INSERT WITH CHECK (false);
CREATE POLICY "deny_all_update" ON public.pending_agency_notifications FOR UPDATE USING (false);
CREATE POLICY "deny_all_delete" ON public.pending_agency_notifications FOR DELETE USING (false);

-- Function: queue agency for Monday notification when created
CREATE OR REPLACE FUNCTION public.queue_agency_monday_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO pending_agency_notifications (agency_id, agency_name)
  VALUES (NEW.id, NEW.name)
  ON CONFLICT (agency_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_queue_agency_notification ON agencies;
CREATE TRIGGER trigger_queue_agency_notification
  AFTER INSERT ON agencies
  FOR EACH ROW
  EXECUTE FUNCTION queue_agency_monday_notification();