-- Add font weight columns to design_settings table
ALTER TABLE design_settings 
ADD COLUMN IF NOT EXISTS heading_font_weight text DEFAULT '700',
ADD COLUMN IF NOT EXISTS body_font_weight text DEFAULT '400';