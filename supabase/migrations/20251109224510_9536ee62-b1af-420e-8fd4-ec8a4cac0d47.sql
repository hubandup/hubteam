-- Create storage bucket for project attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-attachments', 'project-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create project_attachments table
CREATE TABLE public.project_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on project_attachments
ALTER TABLE public.project_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for project_attachments
CREATE POLICY "Admins can manage project_attachments"
ON public.project_attachments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can manage project_attachments"
ON public.project_attachments
FOR ALL
USING (has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Project members can view attachments"
ON public.project_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.project_team_members
    WHERE project_id = project_attachments.project_id
    AND member_type = 'profile'
    AND member_id = auth.uid()
  )
);

-- Create storage policies for project attachments
CREATE POLICY "Team can view project attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'project-attachments' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role))
);

CREATE POLICY "Team can upload project attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'project-attachments' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role))
);

CREATE POLICY "Team can delete project attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'project-attachments' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role))
);