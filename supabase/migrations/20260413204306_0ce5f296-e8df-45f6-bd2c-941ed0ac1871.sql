DROP POLICY IF EXISTS "Authenticated users with lagostina access can insert top keywords" ON public.lagostina_top_keywords;
CREATE POLICY "lagostina_top_keywords_insert"
ON public.lagostina_top_keywords
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true));