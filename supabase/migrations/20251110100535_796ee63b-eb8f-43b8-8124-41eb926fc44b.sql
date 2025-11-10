-- Add user_id to meeting_notes to track who created the note
ALTER TABLE public.meeting_notes 
ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- Make title and meeting_date nullable since we're simplifying to comments
ALTER TABLE public.meeting_notes 
ALTER COLUMN title DROP NOT NULL,
ALTER COLUMN meeting_date DROP NOT NULL;