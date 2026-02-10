
-- Table to store LinkedIn OAuth tokens (service_role only)
CREATE TABLE public.linkedin_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS with deny-all (only service_role can access)
ALTER TABLE public.linkedin_tokens ENABLE ROW LEVEL SECURITY;
-- No policies = deny all for anon/authenticated, service_role bypasses RLS
