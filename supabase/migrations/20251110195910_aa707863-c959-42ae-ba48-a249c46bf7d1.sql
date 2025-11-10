-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create chat_rooms table
CREATE TABLE public.chat_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT,
  type TEXT NOT NULL CHECK (type IN ('project', 'direct')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- Create chat_room_members table
CREATE TABLE public.chat_room_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Enable RLS
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create chat_message_mentions table
CREATE TABLE public.chat_message_mentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_message_mentions ENABLE ROW LEVEL SECURITY;

-- Create activity_log table
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_rooms
CREATE POLICY "Users can view rooms they are members of" 
ON public.chat_rooms 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.chat_room_members 
    WHERE chat_room_members.room_id = chat_rooms.id 
    AND chat_room_members.user_id = auth.uid()
  )
);

CREATE POLICY "Team and admin can create chat rooms" 
ON public.chat_rooms 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team')
);

-- RLS Policies for chat_room_members
CREATE POLICY "Users can view members of rooms they belong to" 
ON public.chat_room_members 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.chat_room_members AS crm 
    WHERE crm.room_id = chat_room_members.room_id 
    AND crm.user_id = auth.uid()
  )
);

CREATE POLICY "Team and admin can add members" 
ON public.chat_room_members 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team')
);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages in rooms they belong to" 
ON public.chat_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.chat_room_members 
    WHERE chat_room_members.room_id = chat_messages.room_id 
    AND chat_room_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create messages in rooms they belong to" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_room_members 
    WHERE chat_room_members.room_id = chat_messages.room_id 
    AND chat_room_members.user_id = auth.uid()
  )
  AND auth.uid() = user_id
);

CREATE POLICY "Users can update their own messages" 
ON public.chat_messages 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" 
ON public.chat_messages 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for chat_message_mentions
CREATE POLICY "Users can view mentions" 
ON public.chat_message_mentions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages 
    JOIN public.chat_room_members ON chat_messages.room_id = chat_room_members.room_id
    WHERE chat_messages.id = chat_message_mentions.message_id 
    AND chat_room_members.user_id = auth.uid()
  )
);

-- RLS Policies for activity_log
CREATE POLICY "Admins and team can view all activity logs" 
ON public.activity_log 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team')
);

-- Create trigger for updated_at on chat_messages
CREATE TRIGGER update_chat_messages_updated_at
BEFORE UPDATE ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

CREATE INDEX idx_chat_rooms_project_id ON public.chat_rooms(project_id);
CREATE INDEX idx_chat_room_members_room_id ON public.chat_room_members(room_id);
CREATE INDEX idx_chat_room_members_user_id ON public.chat_room_members(user_id);

CREATE INDEX idx_chat_messages_room_id ON public.chat_messages(room_id);
CREATE INDEX idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

CREATE INDEX idx_chat_message_mentions_message_id ON public.chat_message_mentions(message_id);
CREATE INDEX idx_chat_message_mentions_user_id ON public.chat_message_mentions(user_id);

CREATE INDEX idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_entity_type_id ON public.activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at DESC);

-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;