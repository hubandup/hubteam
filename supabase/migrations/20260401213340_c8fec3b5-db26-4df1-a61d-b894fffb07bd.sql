CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invited_role app_role;
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email
  );
  
  -- Check if user was invited with a specific role
  BEGIN
    v_invited_role := (NEW.raw_user_meta_data->>'role')::app_role;
  EXCEPTION WHEN invalid_text_representation THEN
    v_invited_role := NULL;
  END;
  
  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(v_invited_role, 'team'::app_role))
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Send account_created notification for client users
  IF COALESCE(v_invited_role, 'team'::app_role) = 'client' THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.id,
      'account_created',
      'Votre compte vient d''être créé',
      'Votre compte sur la plateforme Hub Team vient d''être créé. Cliquez ici pour accéder à vos projets Hub & Up.',
      '/'
    );
  END IF;
  
  RETURN NEW;
END;
$$;