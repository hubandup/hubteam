-- Fix foreign key constraint to allow project deletion
-- Drop existing constraint
ALTER TABLE task_comments 
DROP CONSTRAINT IF EXISTS task_comments_project_id_fkey;

-- Re-add constraint with CASCADE delete
ALTER TABLE task_comments 
ADD CONSTRAINT task_comments_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES projects(id) 
ON DELETE CASCADE;