-- Add 5 date fields for project recommendation workflow steps
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS date_brief timestamp with time zone,
ADD COLUMN IF NOT EXISTS date_prise_en_main timestamp with time zone,
ADD COLUMN IF NOT EXISTS date_concertation_agences timestamp with time zone,
ADD COLUMN IF NOT EXISTS date_montage_reco timestamp with time zone,
ADD COLUMN IF NOT EXISTS date_restitution timestamp with time zone;

-- Create table to track notification sends to prevent duplicates
CREATE TABLE IF NOT EXISTS public.project_step_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  step_name text NOT NULL,
  notification_sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, step_name)
);

-- Enable RLS on the notifications table
ALTER TABLE public.project_step_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and team can view notification records
CREATE POLICY "Admins and team can view notification records"
ON public.project_step_notifications
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

-- Policy: System can insert notification records (via edge function)
CREATE POLICY "System can insert notification records"
ON public.project_step_notifications
FOR INSERT
WITH CHECK (true);