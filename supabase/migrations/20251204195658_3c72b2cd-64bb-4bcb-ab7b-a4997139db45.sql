-- Allow agency users to view non-private meeting notes for clients they have access to
CREATE POLICY "Agency users can view non-private meeting_notes" 
ON public.meeting_notes 
FOR SELECT 
USING (
  has_role(auth.uid(), 'agency'::app_role) 
  AND is_private = false 
  AND EXISTS (
    SELECT 1
    FROM agency_members am
    JOIN project_agencies pa ON pa.agency_id = am.agency_id
    JOIN project_clients pc ON pc.project_id = pa.project_id
    WHERE pc.client_id = meeting_notes.client_id
    AND am.user_id = auth.uid()
  )
);

-- Allow agency users to create meeting notes
CREATE POLICY "Agency users can create meeting_notes" 
ON public.meeting_notes 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'agency'::app_role) 
  AND auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM agency_members am
    JOIN project_agencies pa ON pa.agency_id = am.agency_id
    JOIN project_clients pc ON pc.project_id = pa.project_id
    WHERE pc.client_id = meeting_notes.client_id
    AND am.user_id = auth.uid()
  )
);