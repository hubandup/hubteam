-- Create project_notes table for storing notes per project
CREATE TABLE public.project_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view notes if they are public, or if they are the author, or if they are an admin
CREATE POLICY "Users can view project notes"
ON public.project_notes
FOR SELECT
USING (
  NOT is_private 
  OR created_by = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);

-- Policy: Users can create notes
CREATE POLICY "Users can create project notes"
ON public.project_notes
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Policy: Users can update their own notes
CREATE POLICY "Users can update their own project notes"
ON public.project_notes
FOR UPDATE
USING (auth.uid() = created_by);

-- Policy: Users can delete their own notes or admins can delete any
CREATE POLICY "Users can delete project notes"
ON public.project_notes
FOR DELETE
USING (
  auth.uid() = created_by 
  OR public.has_role(auth.uid(), 'admin')
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_project_notes_updated_at
BEFORE UPDATE ON public.project_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for project_notes
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_notes;