-- Fix the sync_agency_to_webflow function to use correct Supabase URL
CREATE OR REPLACE FUNCTION public.sync_agency_to_webflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call the edge function asynchronously using net.http_post
  PERFORM net.http_post(
    url := 'https://ytjxeypquqkrmbmhzfqi.supabase.co/functions/v1/sync-agency-to-webflow',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('request.jwt.claims', true)::json->>'sub'
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