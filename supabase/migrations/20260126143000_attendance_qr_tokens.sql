CREATE TABLE IF NOT EXISTS public.attendance_qr_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    short_code TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    device_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_qr_tokens_token ON public.attendance_qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_attendance_qr_tokens_short_code ON public.attendance_qr_tokens(short_code);
CREATE INDEX IF NOT EXISTS idx_attendance_qr_tokens_student_id ON public.attendance_qr_tokens(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_qr_tokens_expires_at ON public.attendance_qr_tokens(expires_at);

ALTER TABLE public.attendance_qr_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own qr tokens"
ON public.attendance_qr_tokens FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students can create own qr tokens"
ON public.attendance_qr_tokens FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Admins and staff can view qr tokens"
ON public.attendance_qr_tokens FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins and staff can update qr tokens"
ON public.attendance_qr_tokens FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE TABLE IF NOT EXISTS public.attendance_scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    student_id UUID,
    scanned_by UUID,
    scan_mode TEXT NOT NULL CHECK (scan_mode IN ('checkin', 'checkout', 'manual_checkin', 'manual_checkout')),
    scan_status TEXT NOT NULL CHECK (scan_status IN ('success', 'failed')),
    reason TEXT,
    token_id UUID REFERENCES public.attendance_qr_tokens(id) ON DELETE SET NULL,
    device_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_scan_logs_event_id ON public.attendance_scan_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_scan_logs_created_at ON public.attendance_scan_logs(created_at);

ALTER TABLE public.attendance_scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and staff can view scan logs"
ON public.attendance_scan_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins and staff can insert scan logs"
ON public.attendance_scan_logs FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE OR REPLACE FUNCTION public.issue_attendance_qr_token(
  p_device_id TEXT DEFAULT NULL,
  p_ttl_seconds INTEGER DEFAULT 45
)
RETURNS TABLE(token TEXT, short_code TEXT, expires_at TIMESTAMP WITH TIME ZONE, token_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token TEXT;
  new_short TEXT;
  expiry TIMESTAMP WITH TIME ZONE;
  new_token_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  new_token := encode(gen_random_bytes(24), 'hex');
  new_short := upper(encode(gen_random_bytes(4), 'hex'));
  expiry := now() + make_interval(secs => p_ttl_seconds);

  INSERT INTO public.attendance_qr_tokens (student_id, token, short_code, expires_at, device_id)
  VALUES (auth.uid(), new_token, new_short, expiry, p_device_id)
  RETURNING id INTO new_token_id;

  RETURN QUERY SELECT new_token, new_short, expiry, new_token_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_attendance_qr_token(
  p_token TEXT,
  p_short_code TEXT DEFAULT NULL
)
RETURNS TABLE(is_valid BOOLEAN, student_id UUID, token_id UUID, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  token_row RECORD;
BEGIN
  IF p_token IS NULL AND p_short_code IS NULL THEN
    RETURN QUERY SELECT false, NULL, NULL, 'Token missing';
    RETURN;
  END IF;

  SELECT *
  INTO token_row
  FROM public.attendance_qr_tokens
  WHERE token = p_token
     OR (p_short_code IS NOT NULL AND short_code = p_short_code)
  ORDER BY created_at DESC
  LIMIT 1;

  IF token_row IS NULL THEN
    RETURN QUERY SELECT false, NULL, NULL, 'Token not found';
    RETURN;
  END IF;

  IF token_row.used_at IS NOT NULL THEN
    RETURN QUERY SELECT false, token_row.student_id, token_row.id, 'Token already used';
    RETURN;
  END IF;

  IF token_row.expires_at < now() THEN
    RETURN QUERY SELECT false, token_row.student_id, token_row.id, 'Token expired';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, token_row.student_id, token_row.id, NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_attendance_qr_token(p_token_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.attendance_qr_tokens
  SET used_at = now()
  WHERE id = p_token_id AND used_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.issue_attendance_qr_token(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_attendance_qr_token(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_attendance_qr_token(UUID) TO authenticated;
