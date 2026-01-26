
-- Allow clients to view project_clients entries for their own projects
CREATE POLICY "Clients can view their project_clients"
ON public.project_clients
FOR SELECT
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.id = project_clients.client_id 
    AND c.email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())
  )
);
