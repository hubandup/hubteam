-- Add font size columns to design_settings table
ALTER TABLE design_settings 
ADD COLUMN IF NOT EXISTS heading_font_size text DEFAULT '2.5rem',
ADD COLUMN IF NOT EXISTS body_font_size text DEFAULT '1rem';