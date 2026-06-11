
CREATE TABLE public.bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_path text NOT NULL,
  line_index integer NOT NULL,
  line_date date,
  label text,
  raw_text text,
  amount numeric(14,2),
  matched_invoice_id uuid REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
  matched_at timestamptz,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(statement_path, line_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_statement_lines TO authenticated;
GRANT ALL ON public.bank_statement_lines TO service_role;

ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Compta users can manage bank statement lines"
ON public.bank_statement_lines
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(p.email) IN ('compta@hubandup.com', 'charles@hubandup.com')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(p.email) IN ('compta@hubandup.com', 'charles@hubandup.com')
  )
);

CREATE INDEX idx_bsl_unmatched ON public.bank_statement_lines (matched_invoice_id) WHERE matched_invoice_id IS NULL;
CREATE INDEX idx_bsl_amount ON public.bank_statement_lines (amount);

CREATE TRIGGER bsl_set_updated_at
BEFORE UPDATE ON public.bank_statement_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
