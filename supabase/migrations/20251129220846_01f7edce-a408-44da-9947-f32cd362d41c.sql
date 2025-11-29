-- Fix the sync_agency_to_webflow function to use anon key for authentication
CREATE OR REPLACE FUNCTION public.sync_agency_to_webflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call the edge function asynchronously using net.http_post with anon key
  PERFORM net.http_post(
    url := 'https://ytjxeypquqkrmbmhzfqi.supabase.co/functions/v1/sync-agency-to-webflow',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0anhleXBxdXFrcm1ibWh6ZnFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2OTk1NjEsImV4cCI6MjA3ODI3NTU2MX0.Xrj3WXrJH8XSXtjFJPPCZNEtjKCCC3AScD6Dcl2sjws'
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