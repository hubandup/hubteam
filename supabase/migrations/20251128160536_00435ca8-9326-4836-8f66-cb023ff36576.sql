-- Add description and tags fields to agencies table
ALTER TABLE agencies 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Update RLS policies remain unchanged as they already cover all columns