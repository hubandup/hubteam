-- Add category and icon columns to faq_items
ALTER TABLE faq_items
ADD COLUMN category TEXT DEFAULT 'general',
ADD COLUMN icon TEXT DEFAULT 'help-circle';

-- Create index on category for better performance
CREATE INDEX idx_faq_items_category ON faq_items(category);