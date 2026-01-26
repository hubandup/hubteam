-- Fix linter warnings (permissive insert policies) by removing overly-broad system INSERT policies.
-- Inserts are performed via backend functions using service credentials (bypass RLS), so client-side inserts should not be allowed.

DROP POLICY IF EXISTS "System can insert unsubscribes" ON public.email_unsubscribes;
DROP POLICY IF EXISTS "System can insert external_messages" ON public.external_messages;
DROP POLICY IF EXISTS "System can insert pending quote actions" ON public.pending_quote_actions;
DROP POLICY IF EXISTS "System can insert notification records" ON public.project_step_notifications;
DROP POLICY IF EXISTS "System can insert email logs" ON public.prospection_email_logs;
