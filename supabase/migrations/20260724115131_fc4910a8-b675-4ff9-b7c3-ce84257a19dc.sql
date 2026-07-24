CREATE OR REPLACE FUNCTION public.accessible_project_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
   WHERE c.email = public.current_user_email()
  UNION
  SELECT ptm.project_id
    FROM public.project_team_members ptm
    JOIN public.client_contacts cc ON cc.id = ptm.member_id
   WHERE ptm.member_type = 'client'
     AND cc.email IS NOT NULL
     AND lower(cc.email) = lower(public.current_user_email());
$function$;