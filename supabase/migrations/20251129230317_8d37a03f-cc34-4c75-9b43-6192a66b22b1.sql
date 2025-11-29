
-- Supprimer les permissions UPDATE pour les agences sur projects, clients et tasks

-- 1. Supprimer la policy permettant aux agences de modifier les projects
DROP POLICY IF EXISTS "Agency users can update their projects" ON projects;

-- 2. Supprimer la policy permettant aux agences de modifier les clients
DROP POLICY IF EXISTS "Agency users can update their clients" ON clients;

-- 3. Supprimer la policy permettant aux agences de modifier les tasks
DROP POLICY IF EXISTS "Agency users can manage their tasks" ON tasks;
DROP POLICY IF EXISTS "Agency users can update their tasks" ON tasks;

-- Les agences gardent uniquement les permissions de lecture (SELECT) pour projects, clients et tasks
-- qui sont déjà définies par les policies existantes :
-- - "Agency users can view their projects" sur projects
-- - "Agency users can view their clients" sur clients  
-- - "Agency users can view their tasks" sur tasks
