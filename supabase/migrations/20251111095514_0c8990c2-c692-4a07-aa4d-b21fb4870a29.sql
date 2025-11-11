-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved function that respects invited user roles
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
  v_invited_role := (NEW.raw_user_meta_data->>'role')::app_role;
  
  -- Assign role based on invitation or default logic
  IF v_invited_role IS NOT NULL THEN
    -- User was invited with a specific role, use that
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_invited_role);
  ELSE
    -- No invited role, use default logic (first user = admin, others = team)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
      NEW.id,
      CASE 
        WHEN (SELECT COUNT(*) FROM auth.users) = 1 THEN 'admin'::app_role
        ELSE 'team'::app_role
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();