
-- Create prospect_categories table
CREATE TABLE public.prospect_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prospect_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can view categories
CREATE POLICY "Everyone can view prospect_categories"
  ON public.prospect_categories FOR SELECT
  USING (true);

-- Admins can manage categories
CREATE POLICY "Admins can manage prospect_categories"
  ON public.prospect_categories FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Team can manage categories
CREATE POLICY "Team can manage prospect_categories"
  ON public.prospect_categories FOR ALL
  USING (has_role(auth.uid(), 'team'::app_role));

-- Auth required
CREATE POLICY "require_authentication_prospect_categories"
  ON public.prospect_categories FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Add category_id to prospects table
ALTER TABLE public.prospects
  ADD COLUMN category_id UUID REFERENCES public.prospect_categories(id) ON DELETE SET NULL;

-- Seed predefined categories with distinct colors
INSERT INTO public.prospect_categories (name, color) VALUES
  ('Bâtiment', '#ef4444'),
  ('Industrie', '#3b82f6'),
  ('Automobile', '#f97316'),
  ('Santé', '#10b981'),
  ('Banques/Assurances', '#6366f1'),
  ('Hôtellerie / Restauration', '#ec4899'),
  ('Secteur public / Collectivités', '#8b5cf6'),
  ('Associations / Fondations / ONG', '#14b8a6'),
  ('Distribution Grand Public', '#f59e0b'),
  ('Distribution spécialisée', '#84cc16'),
  ('Événementiel / Salons', '#e11d48'),
  ('Franchise / Réseaux', '#0ea5e9'),
  ('Sport / Fitness', '#22c55e');
