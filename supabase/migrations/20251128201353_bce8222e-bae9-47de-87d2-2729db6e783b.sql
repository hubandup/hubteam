-- Ajouter le champ main_contact_id dans la table agencies
ALTER TABLE agencies 
ADD COLUMN main_contact_id uuid REFERENCES agency_contacts(id) ON DELETE SET NULL;