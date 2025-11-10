-- Rendre task_id nullable pour permettre des commentaires libres
ALTER TABLE task_comments 
ALTER COLUMN task_id DROP NOT NULL;