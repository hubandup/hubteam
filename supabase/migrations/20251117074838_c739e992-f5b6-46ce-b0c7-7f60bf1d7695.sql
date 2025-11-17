-- Add media and embed fields to user_posts table
ALTER TABLE user_posts
ADD COLUMN media_urls text[],
ADD COLUMN embed_url text;