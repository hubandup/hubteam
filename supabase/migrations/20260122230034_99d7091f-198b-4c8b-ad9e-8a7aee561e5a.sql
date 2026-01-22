-- Add unsubscribed fields to prospects table
ALTER TABLE public.prospects
ADD COLUMN unsubscribed boolean NOT NULL DEFAULT false,
ADD COLUMN unsubscribed_at timestamp with time zone;

-- Create index for faster filtering
CREATE INDEX idx_prospects_unsubscribed ON public.prospects(unsubscribed);

-- Create table to track all unsubscribe events (for audit)
CREATE TABLE public.email_unsubscribes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Policies: System can insert, admins/team can view
CREATE POLICY "System can insert unsubscribes"
  ON public.email_unsubscribes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins and team can view unsubscribes"
  ON public.email_unsubscribes
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));