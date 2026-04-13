DROP POLICY IF EXISTS "Authenticated users with lagostina access can read top keywords" ON public.lagostina_top_keywords;
CREATE POLICY "lagostina_top_keywords_read"
ON public.lagostina_top_keywords
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true));