
-- 1. AGENCIES: restrict client visibility to agencies linked to their projects
DROP POLICY IF EXISTS "Clients can view active agencies" ON public.agencies;
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
    JOIN public.profiles p ON p.email = c.email
    WHERE pa.agency_id = agencies.id
      AND p.id = auth.uid()
  )
);

-- 2. PROFILES: restrict agency/client visibility to shared context
DROP POLICY IF EXISTS "Agency and client can view profiles" ON public.profiles;

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
    -- same agency (contacts by email)
    EXISTS (
      SELECT 1 FROM public.agency_contacts ac1
      JOIN public.profiles p1 ON p1.email = ac1.email
      JOIN public.agency_contacts ac2 ON ac2.agency_id = ac1.agency_id
      WHERE p1.id = auth.uid() AND ac2.email = profiles.email
    )
    OR
    -- shares a project (viewer is agency member, target is project team/client/agency member)
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
    -- shares a chat room
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
    -- profiles sharing a project with this client
    EXISTS (
      SELECT 1
      FROM public.project_clients pc
      JOIN public.clients c ON c.id = pc.client_id
      JOIN public.profiles me ON me.email = c.email
      WHERE me.id = auth.uid()
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
    -- shared chat room
    EXISTS (
      SELECT 1 FROM public.chat_room_members crm1
      JOIN public.chat_room_members crm2 ON crm2.room_id = crm1.room_id
      WHERE crm1.user_id = auth.uid() AND crm2.user_id = profiles.id
    )
  )
);

-- 3. COMMERCIAL_TRACKING: add explicit SELECT policy for team
CREATE POLICY "Team can view commercial tracking"
ON public.commercial_tracking
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'team'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 4. EMAIL_UNSUBSCRIBES: restrict to admin only
DROP POLICY IF EXISTS "Admins and team can view unsubscribes" ON public.email_unsubscribes;
CREATE POLICY "Only admins can view unsubscribes"
ON public.email_unsubscribes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. LAGOSTINA tables: require granted = true on lagostina_access
DROP POLICY IF EXISTS "Lagostina top ads readable by authorized users" ON public.lagostina_tiktok_top_ads;
CREATE POLICY "Lagostina top ads readable by authorized users"
ON public.lagostina_tiktok_top_ads
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'team'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.lagostina_access la
    WHERE la.user_id = auth.uid() AND la.granted = true
  )
);

DROP POLICY IF EXISTS "Authorized users can read affiliation data" ON public.lagostina_affiliation;
CREATE POLICY "Authorized users can read affiliation data"
ON public.lagostina_affiliation
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'team'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.lagostina_access la
    WHERE la.user_id = auth.uid() AND la.granted = true
  )
);
