-- Create FAQ items table
CREATE TABLE IF NOT EXISTS public.faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  pdf_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

-- Everyone can read FAQ items
CREATE POLICY "Anyone can read FAQ items"
ON public.faq_items
FOR SELECT
USING (true);

-- Only admins can create FAQ items
CREATE POLICY "Admins can create FAQ items"
ON public.faq_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can update FAQ items
CREATE POLICY "Admins can update FAQ items"
ON public.faq_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can delete FAQ items
CREATE POLICY "Admins can delete FAQ items"
ON public.faq_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_faq_items_updated_at
BEFORE UPDATE ON public.faq_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for FAQ PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('faq-pdfs', 'faq-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for FAQ PDFs
CREATE POLICY "Anyone can view FAQ PDFs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'faq-pdfs');

CREATE POLICY "Admins can upload FAQ PDFs"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'faq-pdfs' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete FAQ PDFs"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'faq-pdfs' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);