-- Ajouter 'faq' et 'messages' au type app_module
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'faq';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'messages';