-- Create security definer function to check room membership
CREATE OR REPLACE FUNCTION public.is_room_member(_user_id uuid, _room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_room_members
    WHERE user_id = _user_id AND room_id = _room_id
  )
$$;

-- Update chat_room_members policies to avoid recursion
DROP POLICY IF EXISTS "Users can view members of rooms they belong to" ON public.chat_room_members;
CREATE POLICY "Users can view members of rooms they belong to"
ON public.chat_room_members
FOR SELECT
USING (public.is_room_member(auth.uid(), room_id));

-- Update chat_rooms policies
DROP POLICY IF EXISTS "Users can view rooms they are members of" ON public.chat_rooms;
CREATE POLICY "Users can view rooms they are members of"
ON public.chat_rooms
FOR SELECT
USING (public.is_room_member(auth.uid(), id));