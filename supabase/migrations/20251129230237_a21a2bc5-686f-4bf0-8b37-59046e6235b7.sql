
-- Corriger les permissions pour le rôle 'agency' selon les exigences

-- 1. Supprimer toutes les permissions agency existantes
DELETE FROM role_permissions WHERE role = 'agency';

-- 2. Ajouter les permissions de lecture uniquement pour CRM
INSERT INTO role_permissions (role, module, action, scope)
VALUES 
  ('agency', 'crm', 'read', 'all');

-- 3. Ajouter les permissions de lecture uniquement pour Projects
INSERT INTO role_permissions (role, module, action, scope)
VALUES 
  ('agency', 'projects', 'read', 'all');

-- 4. Ajouter les permissions de lecture uniquement pour Tasks
INSERT INTO role_permissions (role, module, action, scope)
VALUES 
  ('agency', 'tasks', 'read', 'all');

-- 5. Ajouter les permissions limitées pour Agencies (seulement leur agence)
INSERT INTO role_permissions (role, module, action, scope)
VALUES 
  ('agency', 'agencies', 'read', 'limited'),
  ('agency', 'agencies', 'update', 'limited');

-- 6. Permissions Dashboard (feed)
INSERT INTO role_permissions (role, module, action, scope)
VALUES 
  ('agency', 'dashboard', 'read', 'all');

-- 7. Permissions Messages
INSERT INTO role_permissions (role, module, action, scope)
VALUES 
  ('agency', 'messages', 'read', 'all'),
  ('agency', 'messages', 'create', 'all');

-- 8. Permissions FAQ (lecture)
INSERT INTO role_permissions (role, module, action, scope)
VALUES 
  ('agency', 'faq', 'read', 'all');

-- 9. Permissions Settings profil uniquement
INSERT INTO role_permissions (role, module, action, scope)
VALUES 
  ('agency', 'settings_profile', 'read', 'all'),
  ('agency', 'settings_profile', 'update', 'all'),
  ('agency', 'settings_security', 'read', 'all'),
  ('agency', 'settings_security', 'update', 'all'),
  ('agency', 'settings_notifications', 'read', 'all'),
  ('agency', 'settings_notifications', 'update', 'all');
