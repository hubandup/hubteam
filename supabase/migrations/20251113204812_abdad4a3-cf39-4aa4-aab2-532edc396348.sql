-- Create activity_reactions table
CREATE TABLE public.activity_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activity_log(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'clap', 'fire', 'celebrate')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate reactions
CREATE UNIQUE INDEX activity_reactions_user_activity_unique 
ON public.activity_reactions(activity_id, user_id, reaction_type);

-- Enable Row Level Security
ALTER TABLE public.activity_reactions ENABLE ROW LEVEL SECURITY;

-- Users can view all reactions
CREATE POLICY "Users can view all reactions"
ON public.activity_reactions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users can create their own reactions
CREATE POLICY "Users can create their own reactions"
ON public.activity_reactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reactions
CREATE POLICY "Users can delete their own reactions"
ON public.activity_reactions
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_reactions;