-- Add reply_to_id column to chat_messages for message replies
ALTER TABLE public.chat_messages 
ADD COLUMN reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL;

-- Add index for faster reply lookups
CREATE INDEX idx_chat_messages_reply_to_id ON public.chat_messages(reply_to_id);