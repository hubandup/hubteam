-- Allow clients to create direct chat rooms
CREATE POLICY "Clients can create direct rooms"
ON public.chat_rooms
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'client'::app_role) AND type = 'direct'
);

-- Allow clients to add themselves as room members
CREATE POLICY "Clients can add themselves to rooms"
ON public.chat_room_members
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'client'::app_role) AND user_id = auth.uid()
);