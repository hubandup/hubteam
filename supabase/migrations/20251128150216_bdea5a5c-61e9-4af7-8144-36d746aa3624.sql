-- Add linkedin_connected field to clients table
ALTER TABLE public.clients 
ADD COLUMN linkedin_connected boolean NOT NULL DEFAULT false;