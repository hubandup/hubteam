-- Create permission_scope enum for granular access control
CREATE TYPE permission_scope AS ENUM ('all', 'limited', 'own');

-- Add Settings sub-modules to app_module enum
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'settings_profile';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'settings_security';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'settings_notifications';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'settings_users';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'settings_permissions';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'settings_data';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'settings_design';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'settings_faq';

-- Add scope column to role_permissions
ALTER TABLE public.role_permissions 
ADD COLUMN scope permission_scope DEFAULT 'all';

-- Update unique constraint to include scope
ALTER TABLE public.role_permissions 
DROP CONSTRAINT IF EXISTS role_permissions_role_module_action_key;

ALTER TABLE public.role_permissions 
ADD CONSTRAINT role_permissions_role_module_scope_action_key 
UNIQUE (role, module, scope, action);