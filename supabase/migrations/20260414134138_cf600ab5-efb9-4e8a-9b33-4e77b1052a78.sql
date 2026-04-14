
CREATE POLICY "Agency with access can view lagostina_activation"
  ON public.lagostina_activation FOR SELECT
  USING (has_role(auth.uid(), 'agency'::app_role) AND EXISTS (SELECT 1 FROM lagostina_access WHERE user_id = auth.uid() AND granted = true));

CREATE POLICY "Agency with access can view lagostina_budget"
  ON public.lagostina_budget FOR SELECT
  USING (has_role(auth.uid(), 'agency'::app_role) AND EXISTS (SELECT 1 FROM lagostina_access WHERE user_id = auth.uid() AND granted = true));

CREATE POLICY "Agency with access can view lagostina_category_status"
  ON public.lagostina_category_status FOR SELECT
  USING (has_role(auth.uid(), 'agency'::app_role) AND EXISTS (SELECT 1 FROM lagostina_access WHERE user_id = auth.uid() AND granted = true));

CREATE POLICY "Agency with access can view lagostina_consumer"
  ON public.lagostina_consumer FOR SELECT
  USING (has_role(auth.uid(), 'agency'::app_role) AND EXISTS (SELECT 1 FROM lagostina_access WHERE user_id = auth.uid() AND granted = true));

CREATE POLICY "Agency with access can view lagostina_content_learnings"
  ON public.lagostina_content_learnings FOR SELECT
  USING (has_role(auth.uid(), 'agency'::app_role) AND EXISTS (SELECT 1 FROM lagostina_access WHERE user_id = auth.uid() AND granted = true));

CREATE POLICY "Agency with access can view lagostina_contenus"
  ON public.lagostina_contenus FOR SELECT
  USING (has_role(auth.uid(), 'agency'::app_role) AND EXISTS (SELECT 1 FROM lagostina_access WHERE user_id = auth.uid() AND granted = true));

CREATE POLICY "Agency with access can view lagostina_files_sync"
  ON public.lagostina_files_sync FOR SELECT
  USING (has_role(auth.uid(), 'agency'::app_role) AND EXISTS (SELECT 1 FROM lagostina_access WHERE user_id = auth.uid() AND granted = true));

CREATE POLICY "Agency with access can view lagostina_glossary"
  ON public.lagostina_glossary FOR SELECT
  USING (has_role(auth.uid(), 'agency'::app_role) AND EXISTS (SELECT 1 FROM lagostina_access WHERE user_id = auth.uid() AND granted = true));

CREATE POLICY "Agency with access can view lagostina_learnings"
  ON public.lagostina_learnings FOR SELECT
  USING (has_role(auth.uid(), 'agency'::app_role) AND EXISTS (SELECT 1 FROM lagostina_access WHERE user_id = auth.uid() AND granted = true));

CREATE POLICY "Agency with access can view lagostina_media_kpis"
  ON public.lagostina_media_kpis FOR SELECT
  USING (has_role(auth.uid(), 'agency'::app_role) AND EXISTS (SELECT 1 FROM lagostina_access WHERE user_id = auth.uid() AND granted = true));

CREATE POLICY "Agency with access can view lagostina_personas"
  ON public.lagostina_personas FOR SELECT
  USING (has_role(auth.uid(), 'agency'::app_role) AND EXISTS (SELECT 1 FROM lagostina_access WHERE user_id = auth.uid() AND granted = true));

CREATE POLICY "Agency with access can view lagostina_rnr"
  ON public.lagostina_rnr FOR SELECT
  USING (has_role(auth.uid(), 'agency'::app_role) AND EXISTS (SELECT 1 FROM lagostina_access WHERE user_id = auth.uid() AND granted = true));

CREATE POLICY "Agency with access can view lagostina_scorecards"
  ON public.lagostina_scorecards FOR SELECT
  USING (has_role(auth.uid(), 'agency'::app_role) AND EXISTS (SELECT 1 FROM lagostina_access WHERE user_id = auth.uid() AND granted = true));

CREATE POLICY "Agency with access can view lagostina_social_mix"
  ON public.lagostina_social_mix FOR SELECT
  USING (has_role(auth.uid(), 'agency'::app_role) AND EXISTS (SELECT 1 FROM lagostina_access WHERE user_id = auth.uid() AND granted = true));
