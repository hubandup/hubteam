CREATE POLICY "Authenticated users with lagostina access can update top keywords"
  ON public.lagostina_top_keywords FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true));