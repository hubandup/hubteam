-- Allow users to create mentions when they send messages
CREATE POLICY "Users can create mentions in their messages"
ON public.chat_message_mentions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.chat_messages cm
    JOIN public.chat_room_members crm ON crm.room_id = cm.room_id
    WHERE cm.id = message_id 
    AND crm.user_id = auth.uid()
    AND cm.user_id = auth.uid()
  )
);