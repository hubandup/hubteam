-- Create prospection_email_logs table
CREATE TABLE IF NOT EXISTS public.prospection_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prospection_email_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins and team to view all logs
CREATE POLICY "Admins and team can view email logs"
  ON public.prospection_email_logs
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'team'::app_role)
  );

-- Allow system to insert logs (no auth required for edge function)
CREATE POLICY "System can insert email logs"
  ON public.prospection_email_logs
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_prospection_email_logs_sent_at ON public.prospection_email_logs(sent_at DESC);
CREATE INDEX idx_prospection_email_logs_user_id ON public.prospection_email_logs(user_id);