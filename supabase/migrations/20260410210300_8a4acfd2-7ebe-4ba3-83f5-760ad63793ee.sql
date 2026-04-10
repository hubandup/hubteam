
-- =============================================
-- 1. linkedin_tokens: deny all client access, admin/team only
-- =============================================
CREATE POLICY "Admin can manage linkedin_tokens"
ON public.linkedin_tokens FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team can manage linkedin_tokens"
ON public.linkedin_tokens FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'team'))
WITH CHECK (public.has_role(auth.uid(), 'team'));

-- =============================================
-- 2. notifications: add INSERT policy (only system/self can insert)
-- =============================================
CREATE POLICY "System can insert notifications for user"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 3. lagostina_cell_notes: tighten SELECT from true to authenticated with lagostina access
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view all cell notes" ON public.lagostina_cell_notes;
CREATE POLICY "Authenticated admin/team can view cell notes"
ON public.lagostina_cell_notes FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team')
  OR EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true)
);

-- Tighten INSERT with_check
DROP POLICY IF EXISTS "Users can create cell notes" ON public.lagostina_cell_notes;
CREATE POLICY "Users can create cell notes"
ON public.lagostina_cell_notes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team')
    OR EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true)
  )
);

-- =============================================
-- 4. lagostina_comments: tighten SELECT from true to lagostina access
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view comments" ON public.lagostina_comments;
CREATE POLICY "Lagostina users can view comments"
ON public.lagostina_comments FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team')
  OR EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true)
);

DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.lagostina_comments;
CREATE POLICY "Lagostina users can create comments"
ON public.lagostina_comments FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team')
    OR EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true)
  )
);

-- =============================================
-- 5. lagostina_influence: tighten SELECT from true, tighten INSERT
-- =============================================
DROP POLICY IF EXISTS "lagostina_influence_select" ON public.lagostina_influence;
CREATE POLICY "lagostina_influence_select"
ON public.lagostina_influence FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team')
  OR EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true)
);

DROP POLICY IF EXISTS "lagostina_influence_admin_insert" ON public.lagostina_influence;
CREATE POLICY "lagostina_influence_admin_insert"
ON public.lagostina_influence FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team')
);

-- =============================================
-- 6. lagostina_press: tighten SELECT from true, tighten INSERT
-- =============================================
DROP POLICY IF EXISTS "lagostina_press_select" ON public.lagostina_press;
CREATE POLICY "lagostina_press_select"
ON public.lagostina_press FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team')
  OR EXISTS (SELECT 1 FROM public.lagostina_access WHERE user_id = auth.uid() AND granted = true)
);

DROP POLICY IF EXISTS "lagostina_press_admin_insert" ON public.lagostina_press;
CREATE POLICY "lagostina_press_admin_insert"
ON public.lagostina_press FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team')
);
