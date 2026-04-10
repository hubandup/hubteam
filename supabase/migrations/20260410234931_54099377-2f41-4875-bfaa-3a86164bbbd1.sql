
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  state text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, state)
);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- No public policies — only accessible via service_role key in edge functions
