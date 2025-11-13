-- Add reaction notification preference
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS reaction BOOLEAN NOT NULL DEFAULT true;