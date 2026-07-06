
-- Helper: returns project ids accessible to current user, bypassing RLS
CREATE OR REPLACE FUNCTION public.accessible_project_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ptm.project_id
    FROM public.project_team_members ptm
   WHERE ptm.member_type = 'profile' AND ptm.member_id = auth.uid()
  UNION
  SELECT pa.project_id
    FROM public.project_agencies pa
    JOIN public.agency_members am ON am.agency_id = pa.agency_id
   WHERE am.user_id = auth.uid()
  UNION
  SELECT pc.project_id
    FROM public.project_clients pc
    JOIN public.clients c ON c.id = pc.client_id
   WHERE c.email = public.current_user_email();
$$;

-- Helper: same-agency user ids for current user (via agency_members)
CREATE OR REPLACE FUNCTION public.same_agency_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT am2.user_id
    FROM public.agency_members am1
    JOIN public.agency_members am2 ON am2.agency_id = am1.agency_id
   WHERE am1.user_id = auth.uid();
$$;

-- Fix clients: replace self-lookup policy that touched profiles (caused recursion)
DROP POLICY IF EXISTS "Clients can view their own client record" ON public.clients;
CREATE POLICY "Clients can view their own client record"
  ON public.clients FOR SELECT
  USING (
    public.has_role(auth.uid(), 'client'::app_role)
    AND email = public.current_user_email()
  );

-- Fix profiles: rewrite agency + client policies to avoid touching clients/profiles directly
DROP POLICY IF EXISTS "Agency users can view profiles in shared context" ON public.profiles;
CREATE POLICY "Agency users can view profiles in shared context"
  ON public.profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'agency'::app_role)
    AND (
      profiles.id IN (SELECT public.same_agency_user_ids())
      OR profiles.id IN (
        SELECT ptm.member_id
          FROM public.project_team_members ptm
         WHERE ptm.member_type = 'profile'
           AND ptm.project_id IN (SELECT public.accessible_project_ids())
      )
      OR EXISTS (
        SELECT 1
          FROM public.chat_room_members crm1
          JOIN public.chat_room_members crm2 ON crm2.room_id = crm1.room_id
         WHERE crm1.user_id = auth.uid() AND crm2.user_id = profiles.id
      )
    )
  );

DROP POLICY IF EXISTS "Client users can view profiles in shared context" ON public.profiles;
CREATE POLICY "Client users can view profiles in shared context"
  ON public.profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'client'::app_role)
    AND (
      profiles.id IN (
        SELECT ptm.member_id
          FROM public.project_team_members ptm
         WHERE ptm.member_type = 'profile'
           AND ptm.project_id IN (SELECT public.accessible_project_ids())
      )
      OR EXISTS (
        SELECT 1
          FROM public.chat_room_members crm1
          JOIN public.chat_room_members crm2 ON crm2.room_id = crm1.room_id
         WHERE crm1.user_id = auth.uid() AND crm2.user_id = profiles.id
      )
    )
  );
