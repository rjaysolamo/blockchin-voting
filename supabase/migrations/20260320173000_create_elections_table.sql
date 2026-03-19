-- Creates the elections table expected by the admin UI.
-- This resolves REST 404 errors like:
-- POST /rest/v1/elections?select=id -> "Not Found"

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'elections_start_before_end_check'
  ) THEN
    ALTER TABLE public.elections
      ADD CONSTRAINT elections_start_before_end_check
      CHECK (start_date < end_date);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_elections_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_elections_updated_at ON public.elections;
CREATE TRIGGER trg_elections_updated_at
BEFORE UPDATE ON public.elections
FOR EACH ROW
EXECUTE FUNCTION public.set_elections_updated_at();

ALTER TABLE public.elections DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.elections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.elections TO authenticated;
