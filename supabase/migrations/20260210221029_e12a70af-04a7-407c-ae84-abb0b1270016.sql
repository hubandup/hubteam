
-- Create linkedin_posts table
CREATE TABLE public.linkedin_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  linkedin_id TEXT NOT NULL UNIQUE,
  title TEXT,
  content TEXT NOT NULL,
  link TEXT,
  image_url TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.linkedin_posts ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated users
CREATE POLICY "Authenticated users can read linkedin posts"
  ON public.linkedin_posts
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.linkedin_posts;
