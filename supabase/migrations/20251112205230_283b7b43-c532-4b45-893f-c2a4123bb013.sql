-- Add action column to clients table
ALTER TABLE public.clients 
ADD COLUMN action text;

-- Add comment
COMMENT ON COLUMN public.clients.action IS 'Action specific to the client (À rappeler, Bloqué, Client, etc.)';
