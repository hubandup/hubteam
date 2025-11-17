-- Add link preview metadata columns to user_posts table
ALTER TABLE public.user_posts
ADD COLUMN IF NOT EXISTS link_title TEXT,
ADD COLUMN IF NOT EXISTS link_description TEXT,
ADD COLUMN IF NOT EXISTS link_image TEXT,
ADD COLUMN IF NOT EXISTS link_site_name TEXT;

COMMENT ON COLUMN public.user_posts.link_title IS 'Title extracted from Open Graph metadata';
COMMENT ON COLUMN public.user_posts.link_description IS 'Description extracted from Open Graph metadata';
COMMENT ON COLUMN public.user_posts.link_image IS 'Image URL extracted from Open Graph metadata';
COMMENT ON COLUMN public.user_posts.link_site_name IS 'Site name extracted from Open Graph metadata';