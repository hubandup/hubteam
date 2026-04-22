
-- 1. Tighten RLS on client_targets: only admin + team can manage/view
DROP POLICY IF EXISTS "Authenticated users can view targets" ON public.client_targets;
DROP POLICY IF EXISTS "Authenticated users can add targets" ON public.client_targets;
DROP POLICY IF EXISTS "Authenticated users can remove targets" ON public.client_targets;

CREATE POLICY "Admin and team can view targets"
ON public.client_targets FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Admin and team can add targets"
ON public.client_targets FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role))
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Admin and team can remove targets"
ON public.client_targets FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

-- 2. Create notification log for target status -> "À relancer" alerts
CREATE TABLE IF NOT EXISTS public.target_relance_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tracking_id uuid REFERENCES public.commercial_tracking(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('slack', 'email', 'both')),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message text,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipients_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.target_relance_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can view relance notifications"
ON public.target_relance_notifications FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Admin and team can insert relance notifications"
ON public.target_relance_notifications FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

CREATE INDEX IF NOT EXISTS idx_target_relance_client ON public.target_relance_notifications(client_id, created_at DESC);
