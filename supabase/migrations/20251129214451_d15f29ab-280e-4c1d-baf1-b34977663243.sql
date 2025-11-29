-- Allow agency members to update their own agency information
CREATE POLICY "Agency members can update their agency"
ON public.agencies
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'agency'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.agency_members
    WHERE agency_members.agency_id = agencies.id
    AND agency_members.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'agency'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.agency_members
    WHERE agency_members.agency_id = agencies.id
    AND agency_members.user_id = auth.uid()
  )
);

-- Create trigger function to sync to Webflow when agency is updated
CREATE OR REPLACE FUNCTION public.sync_agency_to_webflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id BIGINT;
BEGIN
  -- Call edge function to sync to Webflow (async)
  SELECT INTO v_request_id net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-agency-to-webflow',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key')
    ),
    body := jsonb_build_object(
      'agencyId', NEW.id,
      'name', NEW.name,
      'description', NEW.description,
      'logoUrl', NEW.logo_url,
      'tags', NEW.tags
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger on agencies table
DROP TRIGGER IF EXISTS trigger_sync_agency_to_webflow ON public.agencies;
CREATE TRIGGER trigger_sync_agency_to_webflow
AFTER INSERT OR UPDATE OF name, description, logo_url, tags
ON public.agencies
FOR EACH ROW
EXECUTE FUNCTION public.sync_agency_to_webflow();