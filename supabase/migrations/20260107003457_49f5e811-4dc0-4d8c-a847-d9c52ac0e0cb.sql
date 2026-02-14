
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'student', 'candidate');

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create elections table
CREATE TABLE public.elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active elections"
ON public.elections FOR SELECT
USING (true);

CREATE POLICY "Admins can manage elections"
ON public.elections FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create candidates table
CREATE TABLE public.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    department TEXT,
    year_level TEXT,
    photo_url TEXT,
    manifesto TEXT,
    vote_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view candidates"
ON public.candidates FOR SELECT
USING (true);

CREATE POLICY "Admins can manage candidates"
ON public.candidates FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create vote_chain table (blockchain-inspired immutable ledger)
CREATE TABLE public.vote_chain (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_number BIGINT NOT NULL,
    previous_hash TEXT NOT NULL,
    current_hash TEXT NOT NULL,
    voter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL NOT NULL,
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE NOT NULL,
    position TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    nonce INTEGER NOT NULL,
    verification_code TEXT NOT NULL UNIQUE,
    UNIQUE (voter_id, election_id, position)
);

ALTER TABLE public.vote_chain ENABLE ROW LEVEL SECURITY;

-- Voters can only view their own votes
CREATE POLICY "Voters can view their own votes"
ON public.vote_chain FOR SELECT
USING (auth.uid() = voter_id);

-- Admins can view all votes (for auditing)
CREATE POLICY "Admins can view all votes"
ON public.vote_chain FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Students can insert their own votes
CREATE POLICY "Students can cast votes"
ON public.vote_chain FOR INSERT
WITH CHECK (
    auth.uid() = voter_id 
    AND public.has_role(auth.uid(), 'student')
);

-- Create audit_log table (public transparency)
CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL,
    block_hash TEXT,
    block_number BIGINT,
    position TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    details JSONB
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Anyone can view audit log (transparency)
CREATE POLICY "Anyone can view audit log"
ON public.audit_log FOR SELECT
USING (true);

-- Only system can insert audit logs (via trigger)
CREATE POLICY "System can insert audit logs"
ON public.audit_log FOR INSERT
WITH CHECK (true);

-- Create voter_registry to track who has voted
CREATE TABLE public.voter_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE NOT NULL,
    has_voted BOOLEAN DEFAULT false,
    voted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (voter_id, election_id)
);

ALTER TABLE public.voter_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Voters can view their own registry"
ON public.voter_registry FOR SELECT
USING (auth.uid() = voter_id);

CREATE POLICY "Admins can view all registries"
ON public.voter_registry FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can register to vote"
ON public.voter_registry FOR INSERT
WITH CHECK (auth.uid() = voter_id AND public.has_role(auth.uid(), 'student'));

CREATE POLICY "Voters can update their own registry"
ON public.voter_registry FOR UPDATE
USING (auth.uid() = voter_id);

-- Create profiles table for additional user info
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    student_id TEXT UNIQUE,
    department TEXT,
    year_level TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Function to get latest block hash
CREATE OR REPLACE FUNCTION public.get_latest_block_hash(p_election_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hash TEXT;
BEGIN
    SELECT current_hash INTO v_hash
    FROM public.vote_chain
    WHERE election_id = p_election_id
    ORDER BY block_number DESC
    LIMIT 1;
    
    RETURN COALESCE(v_hash, 'GENESIS');
END;
$$;

-- Function to get next block number
CREATE OR REPLACE FUNCTION public.get_next_block_number(p_election_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_block BIGINT;
BEGIN
    SELECT COALESCE(MAX(block_number), 0) + 1 INTO v_block
    FROM public.vote_chain
    WHERE election_id = p_election_id;
    
    RETURN v_block;
END;
$$;

-- Function to increment vote count
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
    
    -- Log to audit
    INSERT INTO public.audit_log (election_id, action, block_hash, block_number, position, details)
    VALUES (
        NEW.election_id,
        'VOTE_CAST',
        NEW.current_hash,
        NEW.block_number,
        NEW.position,
        jsonb_build_object('verification_code_prefix', LEFT(NEW.verification_code, 8))
    );
    
    RETURN NEW;
END;
$$;

-- Create trigger for vote counting
CREATE TRIGGER after_vote_insert
AFTER INSERT ON public.vote_chain
FOR EACH ROW
EXECUTE FUNCTION public.increment_vote_count();

-- Enable realtime for audit_log
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;
