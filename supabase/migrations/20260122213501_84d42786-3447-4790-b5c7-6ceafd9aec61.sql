-- Add attachment fields to chat_messages
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS attachment_url text,
ADD COLUMN IF NOT EXISTS attachment_type text,
ADD COLUMN IF NOT EXISTS attachment_name text;

-- Create table to track message read status
CREATE TABLE IF NOT EXISTS public.chat_message_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Enable RLS on chat_message_reads
ALTER TABLE public.chat_message_reads ENABLE ROW LEVEL SECURITY;

-- Users can view their own read status
CREATE POLICY "Users can view their read status"
ON public.chat_message_reads
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own read status
CREATE POLICY "Users can insert their read status"
ON public.chat_message_reads
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own read status
CREATE POLICY "Users can update their read status"
ON public.chat_message_reads
FOR UPDATE
USING (auth.uid() = user_id);

-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: users can upload to message-attachments
CREATE POLICY "Authenticated users can upload message attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'message-attachments' 
  AND auth.uid() IS NOT NULL
);

-- Storage policy: anyone can view message attachments
CREATE POLICY "Anyone can view message attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'message-attachments');

-- Storage policy: users can delete their own attachments
CREATE POLICY "Users can delete their own message attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'message-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);