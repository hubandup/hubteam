-- Add main contact field to clients table
ALTER TABLE clients ADD COLUMN main_contact_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_clients_main_contact ON clients(main_contact_id);

COMMENT ON COLUMN clients.main_contact_id IS 'ID of the main Hub & Up contact person for this client';