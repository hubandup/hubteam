-- Add parent_id column to task_comments to support threaded replies
ALTER TABLE public.task_comments 
ADD COLUMN parent_id uuid REFERENCES public.task_comments(id) ON DELETE CASCADE;

-- Create index for better query performance on threaded comments
CREATE INDEX idx_task_comments_parent_id ON public.task_comments(parent_id);

-- Add comment to clarify the purpose
COMMENT ON COLUMN public.task_comments.parent_id IS 'Reference to parent comment for threaded replies. NULL for top-level comments.';