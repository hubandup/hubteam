
CREATE TABLE public.supplier_name_aliases (
  key text PRIMARY KEY,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_name_aliases TO authenticated;
GRANT ALL ON public.supplier_name_aliases TO service_role;

ALTER TABLE public.supplier_name_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read aliases"
  ON public.supplier_name_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert aliases"
  ON public.supplier_name_aliases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update aliases"
  ON public.supplier_name_aliases FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete aliases"
  ON public.supplier_name_aliases FOR DELETE TO authenticated USING (true);
