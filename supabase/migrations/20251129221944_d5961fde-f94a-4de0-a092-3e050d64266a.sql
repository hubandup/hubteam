-- Fix search_path security warnings
CREATE OR REPLACE FUNCTION public.sync_agency_to_webflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  response_status INTEGER;
  response_body TEXT;
BEGIN
  -- Call Edge Function using anon key (no JWT required since verify_jwt = false)
  SELECT status, body INTO response_status, response_body
  FROM http((
    'POST',
    'https://ytjxeypquqkrmbmhzfqi.supabase.co/functions/v1/sync-agency-to-webflow',
    ARRAY[
      http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0anhleXBxdXFrcm1ibWh6ZnFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2OTk1NjEsImV4cCI6MjA3ODI3NTU2MX0.Xrj3WXrJH8XSXtjFJPPCZNEtjKCCC3AScD6Dcl2sjws'),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    json_build_object(
      'agencyId', NEW.id,
      'name', NEW.name,
      'description', NEW.description,
      'logoUrl', NEW.logo_url,
      'tags', NEW.tags,
      'active', NEW.active
    )::text
  )::http_request);

  RAISE LOG 'Webflow sync response: status=%, body=%', response_status, response_body;

  RETURN NEW;
END;
$$;