-- Add is_private column to meeting_notes
ALTER TABLE public.meeting_notes 
ADD COLUMN is_private boolean NOT NULL DEFAULT true;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Admins can manage meeting_notes" ON public.meeting_notes;
DROP POLICY IF EXISTS "Team can manage meeting_notes" ON public.meeting_notes;
DROP POLICY IF EXISTS "require_authentication_meeting_notes" ON public.meeting_notes;

-- Create new RLS policies with private comment filtering
CREATE POLICY "Admins can manage all meeting_notes"
ON public.meeting_notes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can manage all meeting_notes"
ON public.meeting_notes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'team'::app_role))
WITH CHECK (has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Users can view their own meeting_notes"
ON public.meeting_notes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meeting_notes"
ON public.meeting_notes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meeting_notes"
ON public.meeting_notes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meeting_notes"
ON public.meeting_notes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Clients can view non-private meeting_notes"
ON public.meeting_notes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND is_private = false
  AND EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = meeting_notes.client_id
    AND c.email = (SELECT email FROM profiles WHERE id = auth.uid())
  )
);