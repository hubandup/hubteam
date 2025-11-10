-- Create agency_members table to link users to agencies
CREATE TABLE IF NOT EXISTS public.agency_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(agency_id, user_id)
);

-- Enable RLS on agency_members
ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agency_members
CREATE POLICY "Admins can manage agency_members"
ON public.agency_members
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Agency members can view their memberships"
ON public.agency_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- RLS policies for agencies to include agency role
CREATE POLICY "Agency users can view their agencies"
ON public.agencies
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'agency') AND 
  EXISTS (
    SELECT 1 FROM public.agency_members 
    WHERE agency_members.agency_id = agencies.id 
    AND agency_members.user_id = auth.uid()
  )
);

-- RLS policies for clients to include agency role
CREATE POLICY "Agency users can view their clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'agency') AND 
  EXISTS (
    SELECT 1 FROM public.agency_members am
    JOIN public.project_agencies pa ON pa.agency_id = am.agency_id
    JOIN public.project_clients pc ON pc.project_id = pa.project_id
    WHERE pc.client_id = clients.id AND am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency users can update their clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'agency') AND 
  EXISTS (
    SELECT 1 FROM public.agency_members am
    JOIN public.project_agencies pa ON pa.agency_id = am.agency_id
    JOIN public.project_clients pc ON pc.project_id = pa.project_id
    WHERE pc.client_id = clients.id AND am.user_id = auth.uid()
  )
);

-- RLS policies for projects to include agency role
CREATE POLICY "Agency users can view their projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'agency') AND 
  EXISTS (
    SELECT 1 FROM public.project_agencies pa
    JOIN public.agency_members am ON am.agency_id = pa.agency_id
    WHERE pa.project_id = projects.id AND am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency users can update their projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'agency') AND 
  EXISTS (
    SELECT 1 FROM public.project_agencies pa
    JOIN public.agency_members am ON am.agency_id = pa.agency_id
    WHERE pa.project_id = projects.id AND am.user_id = auth.uid()
  )
);

-- Add RLS policies for tasks for agency role
CREATE POLICY "Agency users can view their tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'agency') AND 
  EXISTS (
    SELECT 1 FROM public.project_agencies pa
    JOIN public.agency_members am ON am.agency_id = pa.agency_id
    WHERE pa.project_id = tasks.project_id AND am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency users can manage their tasks"
ON public.tasks
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'agency') AND 
  EXISTS (
    SELECT 1 FROM public.project_agencies pa
    JOIN public.agency_members am ON am.agency_id = pa.agency_id
    WHERE pa.project_id = tasks.project_id AND am.user_id = auth.uid()
  )
);