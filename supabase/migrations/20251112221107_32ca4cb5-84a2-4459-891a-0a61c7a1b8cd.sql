-- Relax activity_log constraint to allow system operations from backend functions
ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey;
ALTER TABLE public.activity_log ALTER COLUMN user_id DROP NOT NULL;