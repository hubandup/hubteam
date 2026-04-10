
CREATE TABLE public.lagostina_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lagostina_access ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage lagostina_access"
  ON public.lagostina_access
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can check their own access
CREATE POLICY "Users can view own lagostina_access"
  ON public.lagostina_access
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Timestamp trigger
CREATE TRIGGER update_lagostina_access_updated_at
  BEFORE UPDATE ON public.lagostina_access
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
