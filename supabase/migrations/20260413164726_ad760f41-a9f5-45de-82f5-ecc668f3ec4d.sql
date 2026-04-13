
-- Allow users with lagostina_access to INSERT into lagostina_influence
CREATE POLICY "lagostina_access_insert_influence"
ON public.lagostina_influence FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM lagostina_access
    WHERE lagostina_access.user_id = auth.uid() AND lagostina_access.granted = true
  )
);

-- Allow users with lagostina_access to DELETE from lagostina_influence
CREATE POLICY "lagostina_access_delete_influence"
ON public.lagostina_influence FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lagostina_access
    WHERE lagostina_access.user_id = auth.uid() AND lagostina_access.granted = true
  )
);

-- Allow users with lagostina_access to INSERT into lagostina_press
CREATE POLICY "lagostina_access_insert_press"
ON public.lagostina_press FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM lagostina_access
    WHERE lagostina_access.user_id = auth.uid() AND lagostina_access.granted = true
  )
);

-- Allow users with lagostina_access to DELETE from lagostina_press
CREATE POLICY "lagostina_access_delete_press"
ON public.lagostina_press FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lagostina_access
    WHERE lagostina_access.user_id = auth.uid() AND lagostina_access.granted = true
  )
);

-- Allow users with lagostina_access to INSERT into lagostina_budget
CREATE POLICY "lagostina_access_insert_budget"
ON public.lagostina_budget FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM lagostina_access
    WHERE lagostina_access.user_id = auth.uid() AND lagostina_access.granted = true
  )
);

-- Allow users with lagostina_access to DELETE from lagostina_budget
CREATE POLICY "lagostina_access_delete_budget"
ON public.lagostina_budget FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lagostina_access
    WHERE lagostina_access.user_id = auth.uid() AND lagostina_access.granted = true
  )
);

-- Allow users with lagostina_access to INSERT into lagostina_files_sync
CREATE POLICY "lagostina_access_insert_files_sync"
ON public.lagostina_files_sync FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM lagostina_access
    WHERE lagostina_access.user_id = auth.uid() AND lagostina_access.granted = true
  )
);

-- Allow users with lagostina_access to DELETE from lagostina_files_sync
CREATE POLICY "lagostina_access_delete_files_sync"
ON public.lagostina_files_sync FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lagostina_access
    WHERE lagostina_access.user_id = auth.uid() AND lagostina_access.granted = true
  )
);
