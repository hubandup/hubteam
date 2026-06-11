CREATE TABLE public.bank_line_supplier_overrides (
  line_id uuid PRIMARY KEY REFERENCES public.bank_statement_lines(id) ON DELETE CASCADE,
  supplier_key text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_line_supplier_overrides TO authenticated;
GRANT ALL ON public.bank_line_supplier_overrides TO service_role;

ALTER TABLE public.bank_line_supplier_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view overrides"
  ON public.bank_line_supplier_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert overrides"
  ON public.bank_line_supplier_overrides FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update overrides"
  ON public.bank_line_supplier_overrides FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete overrides"
  ON public.bank_line_supplier_overrides FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_bank_line_supplier_overrides_updated_at
  BEFORE UPDATE ON public.bank_line_supplier_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
