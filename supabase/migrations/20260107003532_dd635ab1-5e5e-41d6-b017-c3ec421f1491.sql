
-- Fix permissive RLS policy on audit_log by restricting inserts to authenticated users only
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

-- Audit logs are inserted via triggers with SECURITY DEFINER, so we don't need a public insert policy
-- The trigger function increment_vote_count() already has SECURITY DEFINER and handles inserts
