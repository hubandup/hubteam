-- Add archived field to projects table
ALTER TABLE public.projects 
ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Add index for better query performance on archived projects
CREATE INDEX idx_projects_archived ON public.projects(archived);