-- Add new values to the interaction_action_type enum
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS 'Contact entrant Appel';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS '1er Appel';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS 'Relance Téléphonique 1';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS 'Relance Téléphonique 2';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS 'Relance Téléphonique 3';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS 'Contact entrant Email';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS '1er Email';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS 'Relance Email 1';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS 'Relance Email 2';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS 'Relance Email 3';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS 'Contact entrant Linkedin';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS '1er Message Linkedin';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS 'Relance Linkedin 1';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS 'Relance Linkedin 2';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS 'Relance Linkedin 3';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS 'Bouche à Oreille';
ALTER TYPE public.interaction_action_type ADD VALUE IF NOT EXISTS 'Autre (Précisez)';