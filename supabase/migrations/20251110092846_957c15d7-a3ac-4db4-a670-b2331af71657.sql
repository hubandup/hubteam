-- Fix critical security issues: Add default-deny RLS policies

-- Agencies table: Restrict access to admin and team roles only
CREATE POLICY "Only admins and team can view agencies"
ON public.agencies
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Only admins can manage agencies"
ON public.agencies
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Clients table: Restrict access to authenticated users with proper roles
CREATE POLICY "Only admins and team can view clients"
ON public.clients
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Only admins can manage clients"
ON public.clients
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Invoices table: Restrict access to authenticated users
CREATE POLICY "Only admins and team can view invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Only admins can manage invoices"
ON public.invoices
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Quotes table: Restrict access to authenticated users
CREATE POLICY "Only admins and team can view quotes"
ON public.quotes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Only admins can manage quotes"
ON public.quotes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for invoices and quotes PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices-quotes',
  'invoices-quotes',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: Only admins can upload PDFs
CREATE POLICY "Admins can upload invoice/quote PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoices-quotes' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Admins and team can view PDFs
CREATE POLICY "Admins and team can view invoice/quote PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoices-quotes' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role))
);

-- Admins can delete PDFs
CREATE POLICY "Admins can delete invoice/quote PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoices-quotes' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can update PDFs
CREATE POLICY "Admins can update invoice/quote PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'invoices-quotes' AND
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'invoices-quotes' AND
  has_role(auth.uid(), 'admin'::app_role)
);