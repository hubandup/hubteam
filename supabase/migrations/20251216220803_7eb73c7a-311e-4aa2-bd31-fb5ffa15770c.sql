-- Create external_messages table for WhatsApp and other external sources
CREATE TABLE public.external_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'whatsapp',
  group_id TEXT NOT NULL,
  group_name TEXT,
  author_name TEXT NOT NULL,
  author_identifier TEXT NOT NULL,
  content TEXT,
  content_type TEXT NOT NULL DEFAULT 'text',
  media_url TEXT,
  external_message_id TEXT UNIQUE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_external_messages_source ON public.external_messages(source);
CREATE INDEX idx_external_messages_group_id ON public.external_messages(group_id);
CREATE INDEX idx_external_messages_timestamp ON public.external_messages(timestamp DESC);
CREATE INDEX idx_external_messages_external_id ON public.external_messages(external_message_id);

-- Enable RLS
ALTER TABLE public.external_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies: Admin and team can view all external messages
CREATE POLICY "Admins can manage external_messages"
ON public.external_messages
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can view external_messages"
ON public.external_messages
FOR SELECT
USING (has_role(auth.uid(), 'team'::app_role));

-- Allow system/webhook to insert (no auth required for webhook)
CREATE POLICY "System can insert external_messages"
ON public.external_messages
FOR INSERT
WITH CHECK (true);

-- Enable realtime for external_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.external_messages;