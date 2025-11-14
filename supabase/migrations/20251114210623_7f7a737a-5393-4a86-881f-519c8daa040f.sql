-- Add KDrive folder path columns to clients and projects
ALTER TABLE clients ADD COLUMN IF NOT EXISTS kdrive_folder_path TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS kdrive_folder_id TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS kdrive_folder_path TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS kdrive_folder_id TEXT;

-- Add KDrive drive ID to store the main drive reference
ALTER TABLE clients ADD COLUMN IF NOT EXISTS kdrive_drive_id INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS kdrive_drive_id INTEGER;

COMMENT ON COLUMN clients.kdrive_folder_path IS 'Path to the client folder in KDrive (e.g., /CLIENTS/BRISACH)';
COMMENT ON COLUMN clients.kdrive_folder_id IS 'KDrive folder ID for the client';
COMMENT ON COLUMN clients.kdrive_drive_id IS 'KDrive drive ID';

COMMENT ON COLUMN projects.kdrive_folder_path IS 'Path to the project folder in KDrive';
COMMENT ON COLUMN projects.kdrive_folder_id IS 'KDrive folder ID for the project';
COMMENT ON COLUMN projects.kdrive_drive_id IS 'KDrive drive ID';