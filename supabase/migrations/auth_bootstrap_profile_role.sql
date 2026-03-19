-- Auto-bootstrap profile + default student role for authenticated users.
-- This fixes cases where users can authenticate but have no user_roles/profile rows.

CREATE OR REPLACE FUNCTION public.ensure_user_bootstrap(
  p_user_id UUID,
  p_email TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_full_name TEXT;
  v_student_id TEXT;
  v_department TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  v_full_name := NULLIF(TRIM(COALESCE(p_metadata ->> 'full_name', p_metadata ->> 'name', '')), '');
  v_student_id := NULLIF(TRIM(COALESCE(p_metadata ->> 'student_id', '')), '');
  v_department := NULLIF(TRIM(COALESCE(p_metadata ->> 'department', '')), '');

  INSERT INTO public.profiles (user_id, full_name, student_id, department)
  VALUES (p_user_id, v_full_name, v_student_id, v_department)
  ON CONFLICT (user_id) DO NOTHING;

  -- Only assign default student role when the user has no roles yet.
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, 'student'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_current_user_bootstrap()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid UUID;
  v_email TEXT;
  v_metadata JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT u.email, u.raw_user_meta_data
  INTO v_email, v_metadata
  FROM auth.users u
  WHERE u.id = v_uid;

  PERFORM public.ensure_user_bootstrap(v_uid, v_email, COALESCE(v_metadata, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_bootstrap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  PERFORM public.ensure_user_bootstrap(
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data, '{}'::jsonb)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap ON auth.users;
CREATE TRIGGER on_auth_user_created_bootstrap
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user_bootstrap();

-- Backfill existing users who currently have no role rows.
DO $$
DECLARE
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = u.id
    )
  LOOP
    PERFORM public.ensure_user_bootstrap(
      v_user.id,
      v_user.email,
      COALESCE(v_user.raw_user_meta_data, '{}'::jsonb)
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_current_user_bootstrap() TO authenticated;
