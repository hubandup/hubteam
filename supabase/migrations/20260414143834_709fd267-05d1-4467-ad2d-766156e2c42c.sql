
ALTER TABLE public.lagostina_influence
  ADD COLUMN IF NOT EXISTS month text,
  ADD COLUMN IF NOT EXISTS budget_mois numeric,
  ADD COLUMN IF NOT EXISTS emv numeric,
  ADD COLUMN IF NOT EXISTS cpm numeric,
  ADD COLUMN IF NOT EXISTS impressions_globales numeric,
  ADD COLUMN IF NOT EXISTS reel_engagement numeric,
  ADD COLUMN IF NOT EXISTS stories_clics_vues numeric,
  ADD COLUMN IF NOT EXISTS stories_clics_mentions numeric;
