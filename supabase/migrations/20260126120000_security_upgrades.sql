ALTER TABLE public.vote_chain
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_vote_chain_ip_address ON public.vote_chain(ip_address);
CREATE INDEX IF NOT EXISTS idx_vote_chain_timestamp ON public.vote_chain(timestamp);

DROP POLICY IF EXISTS "no deletes on vote_chain" ON public.vote_chain;
CREATE POLICY "no deletes on vote_chain"
ON public.vote_chain
FOR DELETE
USING (false);

ALTER TABLE public.audit_log
ADD COLUMN IF NOT EXISTS action_type TEXT,
ADD COLUMN IF NOT EXISTS actor_role TEXT,
ADD COLUMN IF NOT EXISTS actor_id UUID,
ADD COLUMN IF NOT EXISTS hash_snapshot TEXT,
ADD COLUMN IF NOT EXISTS severity TEXT CHECK (severity IN ('low', 'medium', 'high'));

UPDATE public.audit_log
SET action_type = COALESCE(action_type, action),
    severity = COALESCE(severity, 'low')
WHERE action_type IS NULL OR severity IS NULL;

CREATE OR REPLACE FUNCTION public.increment_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.candidates
    SET vote_count = vote_count + 1,
        updated_at = now()
    WHERE id = NEW.candidate_id;
    
    INSERT INTO public.audit_log (election_id, action, action_type, block_hash, block_number, position, actor_role, actor_id, hash_snapshot, severity, details)
    VALUES (
        NEW.election_id,
        'VOTE_CAST',
        'VOTE_CAST',
        NEW.current_hash,
        NEW.block_number,
        NEW.position,
        'student',
        NEW.voter_id,
        NEW.current_hash,
        'low',
        jsonb_build_object('verification_code_prefix', LEFT(NEW.verification_code, 8))
    );
    
    RETURN NEW;
END;
$$;

ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'not_started' CHECK (state IN ('not_started', 'checked_in', 'checked_out')),
ADD COLUMN IF NOT EXISTS last_scan_at TIMESTAMP WITH TIME ZONE;

UPDATE public.attendance
SET state = CASE
  WHEN checked_out_at IS NOT NULL THEN 'checked_out'
  ELSE 'checked_in'
END
WHERE state = 'not_started';

ALTER TABLE public.elections
ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS final_hash_summary TEXT;

CREATE TABLE IF NOT EXISTS public.fraud_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    message TEXT NOT NULL,
    actor_id UUID,
    ip_address TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view fraud alerts"
ON public.fraud_alerts FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update fraud alerts"
ON public.fraud_alerts FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.verification_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_code TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view verification attempts"
ON public.verification_attempts FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.detect_vote_fraud(
  p_election_id UUID,
  p_actor_id UUID,
  p_ip_address TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  ip_vote_count INTEGER;
  spike_count INTEGER;
BEGIN
  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(*)
    INTO ip_vote_count
    FROM public.vote_chain
    WHERE ip_address = p_ip_address
      AND timestamp > now() - interval '10 minutes';

    IF ip_vote_count >= 5 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.fraud_alerts
        WHERE alert_type = 'MULTIPLE_VOTES_IP'
          AND ip_address = p_ip_address
          AND created_at > now() - interval '10 minutes'
      ) THEN
        INSERT INTO public.fraud_alerts (election_id, alert_type, severity, message, actor_id, ip_address, metadata)
        VALUES (
          p_election_id,
          'MULTIPLE_VOTES_IP',
          'high',
          'Multiple votes detected from the same IP within a short window.',
          p_actor_id,
          p_ip_address,
          jsonb_build_object('count_last_10m', ip_vote_count)
        );
      END IF;
    END IF;
  END IF;

  SELECT COUNT(*)
  INTO spike_count
  FROM public.vote_chain
  WHERE election_id = p_election_id
    AND timestamp > now() - interval '2 minutes';

  IF spike_count >= 20 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.fraud_alerts
      WHERE alert_type = 'VOTE_SPIKE'
        AND election_id = p_election_id
        AND created_at > now() - interval '10 minutes'
    ) THEN
      INSERT INTO public.fraud_alerts (election_id, alert_type, severity, message, actor_id, metadata)
      VALUES (
        p_election_id,
        'VOTE_SPIKE',
        'medium',
        'Unusual voting spike detected in a short period.',
        p_actor_id,
        jsonb_build_object('count_last_2m', spike_count)
      );
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_verification_attempt(
  p_verification_code TEXT,
  p_ip_address TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  INSERT INTO public.verification_attempts (verification_code, ip_address)
  VALUES (p_verification_code, p_ip_address);

  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(*)
    INTO attempt_count
    FROM public.verification_attempts
    WHERE ip_address = p_ip_address
      AND created_at > now() - interval '5 minutes';

    IF attempt_count >= 8 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.fraud_alerts
        WHERE alert_type = 'FAILED_VERIFICATION_SPIKE'
          AND ip_address = p_ip_address
          AND created_at > now() - interval '10 minutes'
      ) THEN
        INSERT INTO public.fraud_alerts (alert_type, severity, message, ip_address, metadata)
        VALUES (
          'FAILED_VERIFICATION_SPIKE',
          'medium',
          'Repeated failed vote verifications detected.',
          p_ip_address,
          jsonb_build_object('count_last_5m', attempt_count)
        );
      END IF;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_vote_fraud(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_verification_attempt(TEXT, TEXT) TO anon, authenticated;
