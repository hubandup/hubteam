
-- Update the agency SELECT policy to allow viewing ALL notes (private and public)
-- The "private" flag should hide notes from clients only, not from agencies
DROP POLICY IF EXISTS "Agency users can view non-private meeting_notes" ON public.meeting_notes;

-- Agency users can view all notes (private or not) for clients they have access to
CREATE POLICY "Agency users can view meeting_notes" 
ON public.meeting_notes 
FOR SELECT 
USING (
  has_role(auth.uid(), 'agency'::app_role) 
  AND EXISTS (
    SELECT 1
    FROM agency_members am
    JOIN project_agencies pa ON pa.agency_id = am.agency_id
    JOIN project_clients pc ON pc.project_id = pa.project_id
    WHERE pc.client_id = meeting_notes.client_id
    AND am.user_id = auth.uid()
  )
);
