-- Add KDrive fields to agencies table
ALTER TABLE public.agencies
ADD COLUMN IF NOT EXISTS kdrive_drive_id INTEGER,
ADD COLUMN IF NOT EXISTS kdrive_folder_id TEXT,
ADD COLUMN IF NOT EXISTS kdrive_folder_path TEXT;