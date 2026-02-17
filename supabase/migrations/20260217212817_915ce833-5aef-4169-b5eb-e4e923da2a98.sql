ALTER TABLE public.prospection_contacts 
ADD COLUMN IF NOT EXISTS hunter_confidence text DEFAULT NULL;