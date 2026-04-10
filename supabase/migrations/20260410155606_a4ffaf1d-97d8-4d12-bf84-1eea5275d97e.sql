
-- Table for Brisach access control (same pattern as lagostina_access)
CREATE TABLE public.brisach_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.brisach_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage brisach_access"
  ON public.brisach_access FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own brisach_access"
  ON public.brisach_access FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Table for PAO time entries
CREATE TABLE public.brisach_pao_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL,
  duration_hours NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  project_name TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.brisach_pao_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage brisach_pao_entries"
  ON public.brisach_pao_entries FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can manage brisach_pao_entries"
  ON public.brisach_pao_entries FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'team'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Users with access can view brisach_pao_entries"
  ON public.brisach_pao_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brisach_access
      WHERE user_id = auth.uid() AND granted = true
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_brisach_access_updated_at
  BEFORE UPDATE ON public.brisach_access
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_brisach_pao_entries_updated_at
  BEFORE UPDATE ON public.brisach_pao_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
