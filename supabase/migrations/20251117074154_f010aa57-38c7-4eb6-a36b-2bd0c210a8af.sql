-- Create user_posts table for user-generated content
CREATE TABLE public.user_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_posts ENABLE ROW LEVEL SECURITY;

-- Create policies for user_posts
CREATE POLICY "Users can view all posts" 
ON public.user_posts 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create their own posts" 
ON public.user_posts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" 
ON public.user_posts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" 
ON public.user_posts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_user_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_posts_updated_at
BEFORE UPDATE ON public.user_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_user_posts_updated_at();

-- Enable realtime for user_posts
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_posts;