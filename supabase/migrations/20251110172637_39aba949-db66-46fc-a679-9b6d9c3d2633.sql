-- Add 'agency' role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agency';

-- Add avatar_url and display_name to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS display_name text;