
-- Allow clients whose email matches a client_contact row on the project's team to view the project.
CREATE POLICY "Client contacts on team can view projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.project_team_members ptm
    JOIN public.client_contacts cc ON cc.id = ptm.member_id
    JOIN public.profiles p ON lower(p.email) = lower(cc.email)
    WHERE ptm.project_id = projects.id
      AND ptm.member_type = 'client_contact'
      AND p.id = auth.uid()
  )
);

-- Trigger: when a client_contact is added as a team member, also insert a matching 'profile' row
-- so useProjects (and any downstream profile-based checks) resolve the project for that user.
CREATE OR REPLACE FUNCTION public.sync_client_contact_team_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_profile_id uuid;
BEGIN
  IF NEW.member_type <> 'client_contact' THEN
    RETURN NEW;
  END IF;

  SELECT email INTO v_email FROM public.client_contacts WHERE id = NEW.member_id;
  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE lower(email) = lower(v_email) LIMIT 1;
  IF v_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.project_team_members (project_id, member_type, member_id)
  VALUES (NEW.project_id, 'profile', v_profile_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_client_contact_team_to_profile_trg ON public.project_team_members;
CREATE TRIGGER sync_client_contact_team_to_profile_trg
AFTER INSERT ON public.project_team_members
FOR EACH ROW EXECUTE FUNCTION public.sync_client_contact_team_to_profile();

-- Backfill: for every existing client_contact team member whose email matches a profile,
-- insert the corresponding profile team member row.
INSERT INTO public.project_team_members (project_id, member_type, member_id)
SELECT DISTINCT ptm.project_id, 'profile'::team_member_type, p.id
FROM public.project_team_members ptm
JOIN public.client_contacts cc ON cc.id = ptm.member_id
JOIN public.profiles p ON lower(p.email) = lower(cc.email)
WHERE ptm.member_type = 'client_contact'
ON CONFLICT DO NOTHING;
