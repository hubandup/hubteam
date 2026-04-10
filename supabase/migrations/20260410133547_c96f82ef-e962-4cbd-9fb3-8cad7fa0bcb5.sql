
CREATE TABLE public.lagostina_cell_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  levier TEXT NOT NULL,
  kpi_name TEXT NOT NULL,
  week TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (levier, kpi_name, week)
);

ALTER TABLE public.lagostina_cell_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all cell notes"
  ON public.lagostina_cell_notes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can create cell notes"
  ON public.lagostina_cell_notes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cell notes"
  ON public.lagostina_cell_notes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cell notes"
  ON public.lagostina_cell_notes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_lagostina_cell_notes_updated_at
  BEFORE UPDATE ON public.lagostina_cell_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
