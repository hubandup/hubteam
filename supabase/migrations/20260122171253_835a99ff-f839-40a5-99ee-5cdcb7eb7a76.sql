-- Create table for pending quote actions
CREATE TABLE public.pending_quote_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id INTEGER NOT NULL UNIQUE,
  quote_ref TEXT NOT NULL,
  quote_title TEXT NOT NULL,
  customer_id INTEGER NOT NULL,
  customer_name TEXT,
  amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, linked, created, dismissed
  linked_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  actioned_at TIMESTAMP WITH TIME ZONE,
  actioned_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.pending_quote_actions ENABLE ROW LEVEL SECURITY;

-- Policies: admins and team can read and update
CREATE POLICY "Admins and team can view pending quote actions"
  ON public.pending_quote_actions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'team')
    )
  );

CREATE POLICY "Admins and team can update pending quote actions"
  ON public.pending_quote_actions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'team')
    )
  );

CREATE POLICY "System can insert pending quote actions"
  ON public.pending_quote_actions
  FOR INSERT
  WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX idx_pending_quote_actions_status ON public.pending_quote_actions(status);
CREATE INDEX idx_pending_quote_actions_quote_id ON public.pending_quote_actions(quote_id);