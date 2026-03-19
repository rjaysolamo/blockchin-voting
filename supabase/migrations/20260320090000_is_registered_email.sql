-- Exposes a safe email-existence check for login fallback flows.
CREATE OR REPLACE FUNCTION public.is_registered_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(trim(u.email)) = lower(trim(p_email))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_registered_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.is_registered_email(TEXT) TO authenticated;
