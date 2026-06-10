CREATE OR REPLACE FUNCTION public.cleanup_supplier_invoice_duplicates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_keep_id uuid;
BEGIN
  IF NEW.invoice_number IS NULL OR btrim(NEW.invoice_number) = '' THEN
    RETURN NEW;
  END IF;

  SELECT si.id
  INTO v_keep_id
  FROM public.supplier_invoices si
  WHERE lower(regexp_replace(coalesce(si.invoice_number, ''), '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(coalesce(NEW.invoice_number, ''), '[^a-zA-Z0-9]', '', 'g'))
    AND coalesce(si.invoice_date, date '0001-01-01') = coalesce(NEW.invoice_date, date '0001-01-01')
    AND round(coalesce(si.amount_ttc, 0)::numeric, 2) = round(coalesce(NEW.amount_ttc, 0)::numeric, 2)
  ORDER BY si.created_at DESC NULLS LAST, (si.id = NEW.id) DESC, si.updated_at DESC NULLS LAST, si.id DESC
  LIMIT 1;

  IF v_keep_id IS NOT NULL THEN
    DELETE FROM public.supplier_invoices si
    WHERE lower(regexp_replace(coalesce(si.invoice_number, ''), '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(coalesce(NEW.invoice_number, ''), '[^a-zA-Z0-9]', '', 'g'))
      AND coalesce(si.invoice_date, date '0001-01-01') = coalesce(NEW.invoice_date, date '0001-01-01')
      AND round(coalesce(si.amount_ttc, 0)::numeric, 2) = round(coalesce(NEW.amount_ttc, 0)::numeric, 2)
      AND si.id <> v_keep_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_supplier_invoice_duplicates_after_change ON public.supplier_invoices;
CREATE TRIGGER cleanup_supplier_invoice_duplicates_after_change
AFTER INSERT OR UPDATE OF supplier, invoice_number, invoice_date, amount_ttc, file_url, kdrive_file_id
ON public.supplier_invoices
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_supplier_invoice_duplicates();

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        lower(regexp_replace(coalesce(invoice_number, ''), '[^a-zA-Z0-9]', '', 'g')),
        coalesce(invoice_date, date '0001-01-01'),
        round(coalesce(amount_ttc, 0)::numeric, 2)
      ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.supplier_invoices
  WHERE invoice_number IS NOT NULL
    AND btrim(invoice_number) <> ''
)
DELETE FROM public.supplier_invoices si
USING ranked r
WHERE si.id = r.id
  AND r.rn > 1;