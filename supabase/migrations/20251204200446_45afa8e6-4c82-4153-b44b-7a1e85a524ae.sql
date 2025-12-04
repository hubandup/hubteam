
-- Drop existing agency policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Agency users can view non-private meeting_notes" ON public.meeting_notes;
DROP POLICY IF EXISTS "Agency users can create meeting_notes" ON public.meeting_notes;

-- Recreate the SELECT policy for agency users viewing public notes
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

-- Recreate the INSERT policy for agency users creating notes
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

-- Add UPDATE policy for agency users to edit their own notes
CREATE POLICY "Agency users can update their own meeting_notes" 
ON public.meeting_notes 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'agency'::app_role) 
  AND auth.uid() = user_id
);

-- Add DELETE policy for agency users to delete their own notes
CREATE POLICY "Agency users can delete their own meeting_notes" 
ON public.meeting_notes 
FOR DELETE 
USING (
  has_role(auth.uid(), 'agency'::app_role) 
  AND auth.uid() = user_id
);
