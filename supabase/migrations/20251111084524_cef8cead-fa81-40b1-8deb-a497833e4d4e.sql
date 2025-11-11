-- Create faq_categories table for admin management
CREATE TABLE public.faq_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on faq_categories
ALTER TABLE public.faq_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read categories
CREATE POLICY "Everyone can view faq_categories"
ON public.faq_categories
FOR SELECT
USING (true);

-- Only admins can manage categories
CREATE POLICY "Admins can manage faq_categories"
ON public.faq_categories
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add allowed_roles column to faq_items
ALTER TABLE public.faq_items
ADD COLUMN allowed_roles app_role[] DEFAULT '{admin,team,agency,client}'::app_role[];

-- Update category column to reference faq_categories
ALTER TABLE public.faq_items
DROP COLUMN category;

ALTER TABLE public.faq_items
ADD COLUMN category_id UUID REFERENCES public.faq_categories(id) ON DELETE SET NULL;

-- Insert default categories
INSERT INTO public.faq_categories (name, color, display_order) VALUES
  ('Général', '#6366f1', 0),
  ('Aide', '#10b981', 1),
  ('Compte', '#f59e0b', 2),
  ('Contrat', '#8b5cf6', 3),
  ('Facturation', '#ec4899', 4),
  ('Outils', '#06b6d4', 5);

-- Update RLS policy on faq_items to filter by user role
DROP POLICY IF EXISTS "Anyone can read FAQ items" ON public.faq_items;

CREATE POLICY "Users can view FAQ items based on their role"
ON public.faq_items
FOR SELECT
USING (
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN 'admin'::app_role = ANY(allowed_roles)
    WHEN has_role(auth.uid(), 'team'::app_role) THEN 'team'::app_role = ANY(allowed_roles)
    WHEN has_role(auth.uid(), 'agency'::app_role) THEN 'agency'::app_role = ANY(allowed_roles)
    WHEN has_role(auth.uid(), 'client'::app_role) THEN 'client'::app_role = ANY(allowed_roles)
    ELSE false
  END
);

-- Add trigger for updated_at on faq_categories
CREATE TRIGGER update_faq_categories_updated_at
BEFORE UPDATE ON public.faq_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();