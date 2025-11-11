-- Insert default permissions for each role

-- ADMIN: Full access to everything
INSERT INTO public.role_permissions (role, module, action, scope) VALUES
  -- Dashboard
  ('admin', 'dashboard', 'read', 'all'),
  -- CRM
  ('admin', 'crm', 'read', 'all'),
  ('admin', 'crm', 'create', 'all'),
  ('admin', 'crm', 'update', 'all'),
  ('admin', 'crm', 'delete', 'all'),
  -- Agencies
  ('admin', 'agencies', 'read', 'all'),
  ('admin', 'agencies', 'create', 'all'),
  ('admin', 'agencies', 'update', 'all'),
  ('admin', 'agencies', 'delete', 'all'),
  -- Projects
  ('admin', 'projects', 'read', 'all'),
  ('admin', 'projects', 'create', 'all'),
  ('admin', 'projects', 'update', 'all'),
  ('admin', 'projects', 'delete', 'all'),
  -- Tasks
  ('admin', 'tasks', 'read', 'all'),
  ('admin', 'tasks', 'create', 'all'),
  ('admin', 'tasks', 'update', 'all'),
  ('admin', 'tasks', 'delete', 'all'),
  -- FAQ
  ('admin', 'faq', 'read', 'all'),
  ('admin', 'faq', 'create', 'all'),
  ('admin', 'faq', 'update', 'all'),
  ('admin', 'faq', 'delete', 'all'),
  -- Messages
  ('admin', 'messages', 'read', 'all'),
  ('admin', 'messages', 'create', 'all'),
  ('admin', 'messages', 'update', 'all'),
  ('admin', 'messages', 'delete', 'all'),
  -- Activity
  ('admin', 'settings', 'read', 'all'),
  -- Settings
  ('admin', 'settings_profile', 'read', 'all'),
  ('admin', 'settings_profile', 'update', 'all'),
  ('admin', 'settings_security', 'read', 'all'),
  ('admin', 'settings_security', 'update', 'all'),
  ('admin', 'settings_notifications', 'read', 'all'),
  ('admin', 'settings_notifications', 'update', 'all'),
  ('admin', 'settings_users', 'read', 'all'),
  ('admin', 'settings_users', 'create', 'all'),
  ('admin', 'settings_users', 'update', 'all'),
  ('admin', 'settings_users', 'delete', 'all'),
  ('admin', 'settings_permissions', 'read', 'all'),
  ('admin', 'settings_permissions', 'update', 'all'),
  ('admin', 'settings_data', 'read', 'all'),
  ('admin', 'settings_data', 'delete', 'all'),
  ('admin', 'settings_design', 'read', 'all'),
  ('admin', 'settings_design', 'update', 'all'),
  ('admin', 'settings_faq', 'read', 'all'),
  ('admin', 'settings_faq', 'create', 'all'),
  ('admin', 'settings_faq', 'update', 'all'),
  ('admin', 'settings_faq', 'delete', 'all')
ON CONFLICT (role, module, scope, action) DO NOTHING;

-- TEAM: Limited access to most modules
INSERT INTO public.role_permissions (role, module, action, scope) VALUES
  -- Dashboard
  ('team', 'dashboard', 'read', 'all'),
  -- CRM
  ('team', 'crm', 'read', 'limited'),
  ('team', 'crm', 'create', 'limited'),
  ('team', 'crm', 'update', 'limited'),
  ('team', 'crm', 'delete', 'limited'),
  -- Agencies
  ('team', 'agencies', 'read', 'limited'),
  ('team', 'agencies', 'update', 'limited'),
  -- Projects
  ('team', 'projects', 'read', 'limited'),
  ('team', 'projects', 'create', 'limited'),
  ('team', 'projects', 'update', 'limited'),
  -- Tasks
  ('team', 'tasks', 'read', 'limited'),
  ('team', 'tasks', 'create', 'limited'),
  ('team', 'tasks', 'update', 'limited'),
  -- FAQ
  ('team', 'faq', 'read', 'all'),
  -- Messages
  ('team', 'messages', 'read', 'all'),
  ('team', 'messages', 'create', 'all'),
  ('team', 'messages', 'update', 'all'),
  -- Activity
  ('team', 'settings', 'read', 'all'),
  -- Settings
  ('team', 'settings_profile', 'read', 'all'),
  ('team', 'settings_profile', 'update', 'all'),
  ('team', 'settings_security', 'read', 'all'),
  ('team', 'settings_security', 'update', 'all'),
  ('team', 'settings_notifications', 'read', 'all'),
  ('team', 'settings_notifications', 'update', 'all')
ON CONFLICT (role, module, scope, action) DO NOTHING;

-- CLIENT: Very limited access, only to their own data
INSERT INTO public.role_permissions (role, module, action, scope) VALUES
  -- Dashboard
  ('client', 'dashboard', 'read', 'all'),
  -- Projects (only their own)
  ('client', 'projects', 'read', 'limited'),
  -- Tasks (only their own)
  ('client', 'tasks', 'read', 'limited'),
  -- FAQ
  ('client', 'faq', 'read', 'limited'),
  -- Messages
  ('client', 'messages', 'read', 'all'),
  ('client', 'messages', 'create', 'all'),
  -- Settings
  ('client', 'settings_profile', 'read', 'all'),
  ('client', 'settings_profile', 'update', 'all'),
  ('client', 'settings_security', 'read', 'all'),
  ('client', 'settings_security', 'update', 'all'),
  ('client', 'settings_notifications', 'read', 'all'),
  ('client', 'settings_notifications', 'update', 'all')
ON CONFLICT (role, module, scope, action) DO NOTHING;

-- AGENCY: Limited access to assigned agencies and projects
INSERT INTO public.role_permissions (role, module, action, scope) VALUES
  -- Dashboard
  ('agency', 'dashboard', 'read', 'all'),
  -- CRM (only their clients)
  ('agency', 'crm', 'read', 'limited'),
  ('agency', 'crm', 'update', 'limited'),
  -- Agencies (only selected ones)
  ('agency', 'agencies', 'read', 'limited'),
  -- Projects (only their own)
  ('agency', 'projects', 'read', 'limited'),
  ('agency', 'projects', 'update', 'limited'),
  -- Tasks (only their own)
  ('agency', 'tasks', 'read', 'limited'),
  ('agency', 'tasks', 'update', 'limited'),
  -- FAQ
  ('agency', 'faq', 'read', 'limited'),
  -- Messages
  ('agency', 'messages', 'read', 'all'),
  ('agency', 'messages', 'create', 'all'),
  -- Settings
  ('agency', 'settings_profile', 'read', 'all'),
  ('agency', 'settings_profile', 'update', 'all'),
  ('agency', 'settings_security', 'read', 'all'),
  ('agency', 'settings_security', 'update', 'all'),
  ('agency', 'settings_notifications', 'read', 'all'),
  ('agency', 'settings_notifications', 'update', 'all')
ON CONFLICT (role, module, scope, action) DO NOTHING;