-- Create client_contacts table
CREATE TABLE IF NOT EXISTS public.client_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

-- Admins can manage client_contacts
CREATE POLICY "Admins can manage client_contacts"
ON public.client_contacts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Team can manage client_contacts
CREATE POLICY "Team can manage client_contacts"
ON public.client_contacts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'team'::app_role));

-- Clients can view their own contacts
CREATE POLICY "Clients can view their own contacts"
ON public.client_contacts
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_contacts.client_id
    AND c.email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
);

-- Require authentication
CREATE POLICY "require_authentication_client_contacts"
ON public.client_contacts
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_client_contacts_updated_at
BEFORE UPDATE ON public.client_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_client_contacts_client_id ON public.client_contacts(client_id);
CREATE INDEX idx_client_contacts_email ON public.client_contacts(email);