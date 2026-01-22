-- Ajouter la nouvelle colonne array pour les tags multiples
ALTER TABLE prospects ADD COLUMN offer_tags text[] DEFAULT '{}';

-- Migrer les données existantes (convertir le tag unique en array)
UPDATE prospects 
SET offer_tags = ARRAY[offer_tag] 
WHERE offer_tag IS NOT NULL AND offer_tag != '';

-- Supprimer l'ancienne colonne
ALTER TABLE prospects DROP COLUMN offer_tag;