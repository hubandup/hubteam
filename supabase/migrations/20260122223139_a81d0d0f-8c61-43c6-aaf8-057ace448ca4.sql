
-- Create enums for prospects
CREATE TYPE prospect_channel AS ENUM ('Email', 'Téléphone', 'LinkedIn', 'Bouche-à-oreille');
CREATE TYPE prospect_status AS ENUM ('À contacter', 'Contacté', 'Relance 1', 'Relance 2', 'RDV planifié', 'Besoin qualifié', 'Proposition envoyée', 'Négociation', 'Gagné', 'Perdu', 'En veille');
CREATE TYPE prospect_priority AS ENUM ('A', 'B', 'C');
CREATE TYPE interaction_action_type AS ENUM ('Email', 'Appel', 'Message LinkedIn', 'RDV', 'Autre');

-- Create prospects table
CREATE TABLE public.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  linkedin_url TEXT,
  channel prospect_channel DEFAULT 'Email',
  referrer TEXT,
  status prospect_status DEFAULT 'À contacter',
  priority prospect_priority DEFAULT 'B',
  last_contact_at DATE,
  last_action TEXT,
  next_action TEXT,
  next_action_at DATE,
  need_summary TEXT,
  offer_tag TEXT,
  estimated_amount NUMERIC DEFAULT 0,
  probability NUMERIC DEFAULT 0.5 CHECK (probability >= 0 AND probability <= 1),
  notes TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create interactions table
CREATE TABLE public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  happened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel prospect_channel DEFAULT 'Email',
  action_type interaction_action_type NOT NULL,
  subject TEXT,
  content TEXT,
  outcome TEXT,
  next_step TEXT,
  next_action_at DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

-- RLS for prospects
CREATE POLICY "Admins can manage prospects"
ON public.prospects FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can manage prospects"
ON public.prospects FOR ALL
USING (has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Agency can manage their prospects"
ON public.prospects FOR ALL
USING (has_role(auth.uid(), 'agency'::app_role) AND owner_id = auth.uid());

CREATE POLICY "require_authentication_prospects"
ON public.prospects FOR ALL
USING (auth.uid() IS NOT NULL);

-- RLS for interactions
CREATE POLICY "Admins can manage interactions"
ON public.interactions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can manage interactions"
ON public.interactions FOR ALL
USING (has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Agency can manage their interactions"
ON public.interactions FOR ALL
USING (
  has_role(auth.uid(), 'agency'::app_role) AND 
  EXISTS (
    SELECT 1 FROM public.prospects p 
    WHERE p.id = interactions.prospect_id AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "require_authentication_interactions"
ON public.interactions FOR ALL
USING (auth.uid() IS NOT NULL);

-- Trigger to update prospects when interaction is created with next_action
CREATE OR REPLACE FUNCTION public.update_prospect_on_interaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Update prospect's next_action fields if provided
  IF NEW.next_step IS NOT NULL OR NEW.next_action_at IS NOT NULL THEN
    UPDATE public.prospects
    SET 
      next_action = COALESCE(NEW.next_step, next_action),
      next_action_at = COALESCE(NEW.next_action_at, next_action_at),
      updated_at = now()
    WHERE id = NEW.prospect_id;
  END IF;
  
  -- Always update last_contact_at
  UPDATE public.prospects
  SET 
    last_contact_at = NEW.happened_at::date,
    updated_at = now()
  WHERE id = NEW.prospect_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_interaction_created
AFTER INSERT ON public.interactions
FOR EACH ROW
EXECUTE FUNCTION public.update_prospect_on_interaction();

-- Trigger to update updated_at on prospects
CREATE TRIGGER update_prospects_updated_at
BEFORE UPDATE ON public.prospects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_prospects_owner_id ON public.prospects(owner_id);
CREATE INDEX idx_prospects_status ON public.prospects(status);
CREATE INDEX idx_prospects_email ON public.prospects(email);
CREATE INDEX idx_prospects_next_action_at ON public.prospects(next_action_at);
CREATE INDEX idx_interactions_prospect_id ON public.interactions(prospect_id);
CREATE INDEX idx_interactions_happened_at ON public.interactions(happened_at);

-- Enable realtime for prospects and interactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.prospects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interactions;
