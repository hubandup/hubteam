
CREATE TABLE public.client_budget_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email_domain text NOT NULL,
  month text NOT NULL,
  sea numeric NOT NULL DEFAULT 0,
  meta numeric NOT NULL DEFAULT 0,
  tiktok numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  cumul numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_budget_data ENABLE ROW LEVEL SECURITY;

-- Admins can manage all budget data
CREATE POLICY "Admins can manage client_budget_data"
ON public.client_budget_data FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Team can view budget data
CREATE POLICY "Team can view client_budget_data"
ON public.client_budget_data FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'team'));

-- Clients can view budget data matching their email domain
CREATE POLICY "Clients can view their budget data"
ON public.client_budget_data FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'client') AND
  client_email_domain = split_part((SELECT email FROM public.profiles WHERE id = auth.uid()), '@', 2)
);
