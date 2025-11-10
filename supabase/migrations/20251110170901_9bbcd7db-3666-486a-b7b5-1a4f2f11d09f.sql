-- Ajouter une colonne project_id pour lier les commentaires libres à un projet
ALTER TABLE task_comments 
ADD COLUMN project_id UUID REFERENCES projects(id);