-- Create enum for team member types
CREATE TYPE public.team_member_type AS ENUM ('profile', 'agency_contact', 'client');

-- Create project_team_members table
CREATE TABLE public.project_team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  member_type team_member_type NOT NULL,
  member_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on project_team_members
ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;

-- Create policies for project_team_members
CREATE POLICY "Admins can manage project_team_members"
ON public.project_team_members
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can manage project_team_members"
ON public.project_team_members
FOR ALL
USING (has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Members can view their projects"
ON public.project_team_members
FOR SELECT
USING (
  member_type = 'profile' AND member_id = auth.uid()
);

-- Add unique constraint to prevent duplicate team members
CREATE UNIQUE INDEX project_team_members_unique_idx 
ON public.project_team_members(project_id, member_type, member_id);