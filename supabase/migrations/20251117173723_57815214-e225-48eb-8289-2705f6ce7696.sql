-- Create user_post_comments table
CREATE TABLE IF NOT EXISTS public.user_post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.user_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.user_post_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_post_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all comments"
  ON public.user_post_comments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create their own comments"
  ON public.user_post_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.user_post_comments
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.user_post_comments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_user_post_comments_post_id ON public.user_post_comments(post_id);
CREATE INDEX idx_user_post_comments_parent_id ON public.user_post_comments(parent_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_post_comments_updated_at
  BEFORE UPDATE ON public.user_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_post_comments;