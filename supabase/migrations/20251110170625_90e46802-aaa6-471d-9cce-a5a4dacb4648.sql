-- Ajouter une colonne pour les pièces jointes dans les commentaires
ALTER TABLE task_comments 
ADD COLUMN attachment_url TEXT;