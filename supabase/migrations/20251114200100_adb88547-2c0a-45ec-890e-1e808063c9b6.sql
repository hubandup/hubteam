-- Create quick_notes table for rapid note-taking
CREATE TABLE IF NOT EXISTS public.quick_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  meeting_note_id UUID REFERENCES public.meeting_notes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.quick_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own quick notes"
  ON public.quick_notes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own quick notes"
  ON public.quick_notes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quick notes"
  ON public.quick_notes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quick notes"
  ON public.quick_notes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_quick_notes_user_id ON public.quick_notes(user_id);
CREATE INDEX idx_quick_notes_created_at ON public.quick_notes(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_quick_notes_updated_at
  BEFORE UPDATE ON public.quick_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for quick note mentions
CREATE TABLE IF NOT EXISTS public.quick_note_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.quick_notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.quick_note_mentions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mentions
CREATE POLICY "Users can view mentions in their notes"
  ON public.quick_note_mentions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quick_notes
      WHERE quick_notes.id = quick_note_mentions.note_id
      AND quick_notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create mentions in their notes"
  ON public.quick_note_mentions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quick_notes
      WHERE quick_notes.id = quick_note_mentions.note_id
      AND quick_notes.user_id = auth.uid()
    )
  );

-- Create index
CREATE INDEX idx_quick_note_mentions_note_id ON public.quick_note_mentions(note_id);
CREATE INDEX idx_quick_note_mentions_user_id ON public.quick_note_mentions(user_id);