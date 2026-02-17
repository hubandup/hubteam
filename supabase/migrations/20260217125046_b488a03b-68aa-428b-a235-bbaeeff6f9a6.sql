
ALTER TABLE public.prospection_contacts
ADD COLUMN first_name text NOT NULL DEFAULT '',
ADD COLUMN last_name text NOT NULL DEFAULT '';
