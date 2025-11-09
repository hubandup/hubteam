-- Add logo_url column to clients table
ALTER TABLE public.clients 
ADD COLUMN logo_url TEXT;