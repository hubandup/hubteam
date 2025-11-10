-- Allow creating direct chat rooms
DROP POLICY IF EXISTS "Users can create direct rooms" ON public.chat_rooms;
CREATE POLICY "Users can create direct rooms"
ON public.chat_rooms
FOR INSERT
WITH CHECK (type = 'direct');

-- Allow inserting members: first self (bootstrap), then others once member
DROP POLICY IF EXISTS "Members can add members to their rooms" ON public.chat_room_members;
CREATE POLICY "Members can add members to their rooms"
ON public.chat_room_members
FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR public.is_room_member(auth.uid(), room_id)
);
