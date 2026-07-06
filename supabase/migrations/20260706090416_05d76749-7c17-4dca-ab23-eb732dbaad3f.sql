
-- Helper: fetch current user email without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE id = auth.uid()
$$;

-- 1. AGENCIES: rewrite policy without joining profiles (use helper)
DROP POLICY IF EXISTS "Clients can view linked active agencies" ON public.agencies;
CREATE POLICY "Clients can view linked active agencies"
ON public.agencies
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND active = true
  AND EXISTS (
    SELECT 1
    FROM public.project_agencies pa
    JOIN public.project_clients pc ON pc.project_id = pa.project_id
    JOIN public.clients c ON c.id = pc.client_id
    WHERE pa.agency_id = agencies.id
      AND c.email = public.current_user_email()
  )
);

-- 2. PROFILES: rewrite policies without self-referencing profiles table
DROP POLICY IF EXISTS "Agency users can view profiles in shared context" ON public.profiles;
DROP POLICY IF EXISTS "Client users can view profiles in shared context" ON public.profiles;

CREATE POLICY "Agency users can view profiles in shared context"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'agency'::app_role)
  AND (
    -- same agency (members)
    EXISTS (
      SELECT 1 FROM public.agency_members am1
      JOIN public.agency_members am2 ON am2.agency_id = am1.agency_id
      WHERE am1.user_id = auth.uid() AND am2.user_id = profiles.id
    )
    OR
    -- same agency (contacts by email) — compare against current user email via helper
    EXISTS (
      SELECT 1 FROM public.agency_contacts ac1
      JOIN public.agency_contacts ac2 ON ac2.agency_id = ac1.agency_id
      WHERE ac1.email = public.current_user_email()
        AND ac2.email = profiles.email
    )
    OR
    -- shares a project (viewer is agency member; target is team member or client contact)
    EXISTS (
      SELECT 1
      FROM public.project_agencies pa
      JOIN public.agency_members am ON am.agency_id = pa.agency_id
      WHERE am.user_id = auth.uid()
        AND (
          EXISTS (SELECT 1 FROM public.project_team_members ptm WHERE ptm.project_id = pa.project_id AND ptm.member_id = profiles.id)
          OR EXISTS (SELECT 1 FROM public.project_clients pc JOIN public.clients c ON c.id = pc.client_id WHERE pc.project_id = pa.project_id AND c.email = profiles.email)
        )
    )
    OR
    -- shared chat room
    EXISTS (
      SELECT 1 FROM public.chat_room_members crm1
      JOIN public.chat_room_members crm2 ON crm2.room_id = crm1.room_id
      WHERE crm1.user_id = auth.uid() AND crm2.user_id = profiles.id
    )
  )
);

CREATE POLICY "Client users can view profiles in shared context"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND (
    EXISTS (
      SELECT 1
      FROM public.project_clients pc
      JOIN public.clients c ON c.id = pc.client_id
      WHERE c.email = public.current_user_email()
        AND (
          EXISTS (SELECT 1 FROM public.project_team_members ptm WHERE ptm.project_id = pc.project_id AND ptm.member_id = profiles.id)
          OR EXISTS (
            SELECT 1 FROM public.project_clients pc2
            JOIN public.clients c2 ON c2.id = pc2.client_id
            WHERE pc2.project_id = pc.project_id AND c2.email = profiles.email
          )
        )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.chat_room_members crm1
      JOIN public.chat_room_members crm2 ON crm2.room_id = crm1.room_id
      WHERE crm1.user_id = auth.uid() AND crm2.user_id = profiles.id
    )
  )
);
