-- Add position column to tasks table for ordering
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Update existing tasks to have sequential positions per project
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at DESC) - 1 as new_pos
  FROM public.tasks
)
UPDATE public.tasks t
SET position = n.new_pos
FROM numbered n
WHERE t.id = n.id;