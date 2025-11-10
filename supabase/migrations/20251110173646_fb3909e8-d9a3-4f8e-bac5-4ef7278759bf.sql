-- Create enum for modules
CREATE TYPE public.app_module AS ENUM (
  'dashboard',
  'crm',
  'agencies',
  'projects',
  'tasks',
  'settings'
);

-- Create enum for permissions
CREATE TYPE public.permission_action AS ENUM (
  'read',
  'create',
  'update',
  'delete'
);

-- Create role_permissions table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  module app_module NOT NULL,
  action permission_action NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(role, module, action)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for role_permissions
CREATE POLICY "Admins can manage role_permissions"
ON public.role_permissions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view role_permissions"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Insert default permissions for each role
-- Admin: all permissions on all modules
INSERT INTO public.role_permissions (role, module, action) VALUES
  ('admin', 'dashboard', 'read'),
  ('admin', 'crm', 'read'),
  ('admin', 'crm', 'create'),
  ('admin', 'crm', 'update'),
  ('admin', 'crm', 'delete'),
  ('admin', 'agencies', 'read'),
  ('admin', 'agencies', 'create'),
  ('admin', 'agencies', 'update'),
  ('admin', 'agencies', 'delete'),
  ('admin', 'projects', 'read'),
  ('admin', 'projects', 'create'),
  ('admin', 'projects', 'update'),
  ('admin', 'projects', 'delete'),
  ('admin', 'tasks', 'read'),
  ('admin', 'tasks', 'create'),
  ('admin', 'tasks', 'update'),
  ('admin', 'tasks', 'delete'),
  ('admin', 'settings', 'read'),
  ('admin', 'settings', 'update');

-- Team: read on all, write on CRM and Projects
INSERT INTO public.role_permissions (role, module, action) VALUES
  ('team', 'dashboard', 'read'),
  ('team', 'crm', 'read'),
  ('team', 'crm', 'create'),
  ('team', 'crm', 'update'),
  ('team', 'agencies', 'read'),
  ('team', 'projects', 'read'),
  ('team', 'projects', 'create'),
  ('team', 'projects', 'update'),
  ('team', 'tasks', 'read'),
  ('team', 'tasks', 'create'),
  ('team', 'tasks', 'update'),
  ('team', 'settings', 'read'),
  ('team', 'settings', 'update');

-- Client: read only on their data
INSERT INTO public.role_permissions (role, module, action) VALUES
  ('client', 'crm', 'read'),
  ('client', 'projects', 'read'),
  ('client', 'tasks', 'read'),
  ('client', 'settings', 'read'),
  ('client', 'settings', 'update');

-- Agency: read on CRM, Agencies, Projects; write on their data
INSERT INTO public.role_permissions (role, module, action) VALUES
  ('agency', 'crm', 'read'),
  ('agency', 'crm', 'update'),
  ('agency', 'agencies', 'read'),
  ('agency', 'projects', 'read'),
  ('agency', 'projects', 'update'),
  ('agency', 'tasks', 'read'),
  ('agency', 'tasks', 'create'),
  ('agency', 'tasks', 'update'),
  ('agency', 'settings', 'read'),
  ('agency', 'settings', 'update');

-- Create helper function to check permissions
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id uuid,
  _module app_module,
  _action permission_action
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = _user_id
      AND rp.module = _module
      AND rp.action = _action
  )
$$;