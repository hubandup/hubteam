-- Add new modules to app_module enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'feed';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'prospection';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'notes';