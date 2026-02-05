
-- Fix 1: Meeting notes privacy bypass - Agency users should only see non-private notes
-- Drop the existing agency SELECT policy
DROP POLICY IF EXISTS "Agency users can view meeting_notes" ON public.meeting_notes;

-- Recreate with is_private check - agency users can only see non-private meeting notes
CREATE POLICY "Agency users can view meeting_notes"
ON public.meeting_notes
FOR SELECT
USING (
  has_role(auth.uid(), 'agency'::app_role) 
  AND is_private = false
  AND (EXISTS (
    SELECT 1
    FROM agency_members am
    JOIN project_agencies pa ON pa.agency_id = am.agency_id
    JOIN project_clients pc ON pc.project_id = pa.project_id
    WHERE pc.client_id = meeting_notes.client_id 
    AND am.user_id = auth.uid()
  ))
);

-- Fix 2: notification_outbox has RLS enabled but no policies
-- This table is only used by edge functions with service_role key
-- Add a restrictive policy that prevents all client-side access
CREATE POLICY "No direct client access to notification_outbox"
ON public.notification_outbox
FOR ALL
USING (false);

-- Fix 3: Add rate_limits table for edge function rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique index on key for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_key ON public.rate_limits(key);

-- Create index for cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON public.rate_limits(expires_at);

-- Enable RLS - no client access needed
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) can access this table
CREATE POLICY "No direct client access to rate_limits"
ON public.rate_limits
FOR ALL
USING (false);
