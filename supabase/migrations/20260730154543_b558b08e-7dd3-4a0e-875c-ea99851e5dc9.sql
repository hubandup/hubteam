-- ============ ENUMS ============
CREATE TYPE public.purchase_order_status AS ENUM ('draft','sent','invoiced','cancelled');
CREATE TYPE public.purchase_order_sync_status AS ENUM ('pending','synced','failed','not_applicable');
CREATE TYPE public.purchase_order_event_type AS ENUM ('created','updated','pdf_generated','sent','resent','cancelled','invoiced','synced');

-- ============ SUPPLIERS ============
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  last_name text,
  first_name text,
  email text,
  phone text,
  address_1 text,
  address_2 text,
  postal_code text,
  city text,
  country text NOT NULL DEFAULT 'France',
  vat_number text,
  iban text,
  bic text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_company_name ON public.suppliers (lower(company_name));
CREATE INDEX idx_suppliers_email ON public.suppliers (lower(email));
CREATE INDEX idx_suppliers_active ON public.suppliers (is_active);

GRANT SELECT, INSERT, UPDATE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ============ PURCHASE CATEGORIES ============
CREATE TABLE public.purchase_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.purchase_categories TO authenticated;
GRANT ALL ON public.purchase_categories TO service_role;
ALTER TABLE public.purchase_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view purchase categories" ON public.purchase_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage purchase categories" ON public.purchase_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.purchase_categories (name, sort_order) VALUES
  ('Prestation de service', 1), ('Gestion de projet', 2), ('Autres', 3);

-- ============ VAT RATES ============
CREATE TABLE public.vat_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  rate numeric(5,2) NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_vat_rates_unique_default ON public.vat_rates (is_default) WHERE is_default;
GRANT SELECT ON public.vat_rates TO authenticated;
GRANT ALL ON public.vat_rates TO service_role;
ALTER TABLE public.vat_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view vat rates" ON public.vat_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage vat rates" ON public.vat_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.vat_rates (label, rate, is_default, sort_order) VALUES
  ('TVA 0 %', 0.00, false, 1), ('TVA 20 %', 20.00, true, 2);

-- ============ PO SEQUENCES ============
CREATE TABLE public.po_sequences (
  year integer PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.po_sequences TO service_role;
ALTER TABLE public.po_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read po sequences" ON public.po_sequences FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.next_po_number(p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_value integer;
BEGIN
  INSERT INTO public.po_sequences (year, last_value)
  VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = po_sequences.last_value + 1
  RETURNING last_value INTO v_value;

  RETURN 'PO-' || p_year::text || '-' || lpad(v_value::text, 5, '0') || '-HU';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.next_po_number(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_po_number(integer) TO authenticated, service_role;

-- ============ PURCHASE ORDERS ============
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  hubup_dossier_ref text NOT NULL,
  facturation_pro_quote_id text,
  supplier_quote_ref text,
  validation_date date NOT NULL,
  description text,
  category_id uuid NOT NULL REFERENCES public.purchase_categories(id) ON DELETE RESTRICT,
  amount_ht numeric(12,2) NOT NULL CHECK (amount_ht > 0),
  vat_rate numeric(5,2) NOT NULL DEFAULT 20.00,
  amount_vat numeric(12,2) GENERATED ALWAYS AS (round(amount_ht * vat_rate / 100, 2)) STORED,
  amount_ttc numeric(12,2) GENERATED ALWAYS AS (amount_ht + round(amount_ht * vat_rate / 100, 2)) STORED,
  currency text NOT NULL DEFAULT 'EUR',
  payment_date date,
  status public.purchase_order_status NOT NULL DEFAULT 'draft',
  internal_notes text,
  pdf_path text,
  sent_at timestamptz,
  sent_by uuid,
  sent_to_email text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_reason text,
  sync_status public.purchase_order_sync_status NOT NULL DEFAULT 'pending',
  synced_at timestamptz,
  sync_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_po_supplier ON public.purchase_orders (supplier_id);
CREATE INDEX idx_po_status ON public.purchase_orders (status);
CREATE INDEX idx_po_dossier ON public.purchase_orders (hubup_dossier_ref);
CREATE INDEX idx_po_created_at ON public.purchase_orders (created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view purchase orders" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create purchase orders" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
-- Update allowed to authenticated, but moving a PO to 'cancelled' requires admin
CREATE POLICY "Authenticated can update purchase orders" ON public.purchase_orders FOR UPDATE TO authenticated
  USING (status <> 'cancelled' OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (status <> 'cancelled' OR public.has_role(auth.uid(),'admin'));
-- No DELETE policy: deletion impossible at the database level.

-- Immutable po_number
CREATE OR REPLACE FUNCTION public.prevent_po_number_change()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.po_number IS DISTINCT FROM OLD.po_number THEN
    RAISE EXCEPTION 'Le numéro de bon de commande ne peut pas être modifié';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_po_number_immutable BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_po_number_change();

CREATE TRIGGER trg_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PURCHASE ORDER EVENTS ============
CREATE TABLE public.purchase_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  event_type public.purchase_order_event_type NOT NULL,
  payload jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_po_events_po ON public.purchase_order_events (purchase_order_id, created_at DESC);
GRANT SELECT, INSERT ON public.purchase_order_events TO authenticated;
GRANT ALL ON public.purchase_order_events TO service_role;
ALTER TABLE public.purchase_order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view po events" ON public.purchase_order_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert po events" ON public.purchase_order_events FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
-- No UPDATE / DELETE policy: audit log is append-only.

CREATE OR REPLACE FUNCTION public.log_purchase_order_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_diff jsonb := '{}'::jsonb;
  v_key text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.purchase_order_events (purchase_order_id, event_type, payload, user_id)
    VALUES (NEW.id, 'created', to_jsonb(NEW), COALESCE(NEW.created_by, auth.uid()));
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);
  FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
    IF v_new -> v_key IS DISTINCT FROM v_old -> v_key THEN
      v_diff := v_diff || jsonb_build_object(v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key));
    END IF;
  END LOOP;

  IF v_diff <> '{}'::jsonb THEN
    INSERT INTO public.purchase_order_events (purchase_order_id, event_type, payload, user_id)
    VALUES (
      NEW.id,
      CASE WHEN NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN 'cancelled'::public.purchase_order_event_type
           WHEN NEW.status = 'invoiced' AND OLD.status <> 'invoiced' THEN 'invoiced'::public.purchase_order_event_type
           ELSE 'updated'::public.purchase_order_event_type END,
      v_diff,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_log_purchase_order_event AFTER INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_purchase_order_event();

-- ============ COMPANY SETTINGS ============
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL DEFAULT 'Hub & Up',
  address_1 text,
  address_2 text,
  postal_code text,
  city text,
  country text NOT NULL DEFAULT 'France',
  siret text,
  vat_number text,
  phone text,
  accounting_email text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view company settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage company settings" ON public.company_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_company_settings_updated_at BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.company_settings (legal_name, country) VALUES ('Hub & Up', 'France');