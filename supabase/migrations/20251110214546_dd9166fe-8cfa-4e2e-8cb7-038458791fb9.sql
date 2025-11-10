-- Add kanban stage and follow-up date to clients table
ALTER TABLE public.clients 
ADD COLUMN kanban_stage TEXT NOT NULL DEFAULT 'prospect',
ADD COLUMN follow_up_date TIMESTAMP WITH TIME ZONE NULL;

-- Add a check constraint for valid kanban stages
ALTER TABLE public.clients 
ADD CONSTRAINT valid_kanban_stage 
CHECK (kanban_stage IN (
  'prospect',
  'rdv_a_prendre',
  'a_relancer',
  'rdv_hub_date',
  'rdv_pris',
  'reco_en_cours',
  'projet_valide',
  'a_fideliser',
  'sans_suite'
));

-- Create index for better performance on kanban queries
CREATE INDEX idx_clients_kanban_stage ON public.clients(kanban_stage);
CREATE INDEX idx_clients_follow_up_date ON public.clients(follow_up_date) WHERE follow_up_date IS NOT NULL;

-- Update existing clients to 'prospect' stage (already default but explicit for clarity)
UPDATE public.clients SET kanban_stage = 'prospect' WHERE kanban_stage IS NULL;