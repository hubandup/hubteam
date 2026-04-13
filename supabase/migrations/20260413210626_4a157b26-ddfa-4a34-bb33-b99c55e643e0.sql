
-- Drop existing policies on lagostina_top_keywords
DROP POLICY IF EXISTS "lagostina_top_keywords_select" ON public.lagostina_top_keywords;
DROP POLICY IF EXISTS "lagostina_top_keywords_insert" ON public.lagostina_top_keywords;
DROP POLICY IF EXISTS "lagostina_top_keywords_update" ON public.lagostina_top_keywords;
DROP POLICY IF EXISTS "lagostina_top_keywords_delete" ON public.lagostina_top_keywords;
DROP POLICY IF EXISTS "Allow read for granted users" ON public.lagostina_top_keywords;
DROP POLICY IF EXISTS "Allow insert for granted users" ON public.lagostina_top_keywords;
DROP POLICY IF EXISTS "Allow update for granted users" ON public.lagostina_top_keywords;
DROP POLICY IF EXISTS "Allow delete for granted users" ON public.lagostina_top_keywords;

-- Recreate with admin/team + lagostina_access logic
CREATE POLICY "lagostina_top_keywords_select" ON public.lagostina_top_keywords
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team')
  OR EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true)
);

CREATE POLICY "lagostina_top_keywords_insert" ON public.lagostina_top_keywords
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team')
  OR EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true)
);

CREATE POLICY "lagostina_top_keywords_update" ON public.lagostina_top_keywords
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team')
  OR EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true)
);

CREATE POLICY "lagostina_top_keywords_delete" ON public.lagostina_top_keywords
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team')
  OR EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true)
);
