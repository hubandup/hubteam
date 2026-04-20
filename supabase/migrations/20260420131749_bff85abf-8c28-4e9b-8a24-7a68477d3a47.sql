-- Permettre aux utilisateurs avec accès Lagostina (client/agency) d'éditer les learnings
DROP POLICY IF EXISTS "Clients can view lagostina_learnings" ON public.lagostina_learnings;
DROP POLICY IF EXISTS "Agency with access can view lagostina_learnings" ON public.lagostina_learnings;

CREATE POLICY "Users with lagostina access can manage learnings"
ON public.lagostina_learnings
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'team'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.lagostina_access
    WHERE user_id = auth.uid() AND granted = true
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'team'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.lagostina_access
    WHERE user_id = auth.uid() AND granted = true
  )
);