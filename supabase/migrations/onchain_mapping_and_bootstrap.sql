-- On-chain ID mapping and voter bootstrap tracking

-- 1) Generic mapping table: off-chain UUID entities -> on-chain uint256 ids
CREATE TABLE IF NOT EXISTS public.onchain_entity_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('election', 'candidate')),
    offchain_id UUID NOT NULL,
    onchain_id BIGINT NOT NULL CHECK (onchain_id >= 0),
    chain TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (entity_type, offchain_id, chain),
    UNIQUE (entity_type, onchain_id, chain)
);

ALTER TABLE public.onchain_entity_map ENABLE ROW LEVEL SECURITY;

-- Read access is needed by authenticated app users (used to resolve IDs for on-chain voting).
DROP POLICY IF EXISTS "Authenticated users can view onchain entity mapping" ON public.onchain_entity_map;
CREATE POLICY "Authenticated users can view onchain entity mapping"
ON public.onchain_entity_map FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage mappings directly.
DROP POLICY IF EXISTS "Admins can manage onchain entity mapping" ON public.onchain_entity_map;
CREATE POLICY "Admins can manage onchain entity mapping"
ON public.onchain_entity_map FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_onchain_entity_map_lookup
ON public.onchain_entity_map(entity_type, offchain_id, chain);


-- 2) Student registration status on-chain (global per user+chain)
CREATE TABLE IF NOT EXISTS public.onchain_student_registry (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    student_id TEXT,
    chain TEXT NOT NULL,
    is_registered BOOLEAN NOT NULL DEFAULT false,
    registration_tx_hash TEXT,
    last_error TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, chain),
    CONSTRAINT valid_registry_wallet_format CHECK (public.is_valid_ethereum_address(wallet_address))
);

ALTER TABLE public.onchain_student_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own onchain student registry" ON public.onchain_student_registry;
CREATE POLICY "Users can view own onchain student registry"
ON public.onchain_student_registry FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage onchain student registry" ON public.onchain_student_registry;
CREATE POLICY "Admins can manage onchain student registry"
ON public.onchain_student_registry FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- 3) Whitelist status per user+election+chain
CREATE TABLE IF NOT EXISTS public.onchain_voter_whitelist (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    chain TEXT NOT NULL,
    is_whitelisted BOOLEAN NOT NULL DEFAULT false,
    whitelist_tx_hash TEXT,
    last_error TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, election_id, chain),
    CONSTRAINT valid_whitelist_wallet_format CHECK (public.is_valid_ethereum_address(wallet_address))
);

ALTER TABLE public.onchain_voter_whitelist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own onchain whitelist" ON public.onchain_voter_whitelist;
CREATE POLICY "Users can view own onchain whitelist"
ON public.onchain_voter_whitelist FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage onchain whitelist" ON public.onchain_voter_whitelist;
CREATE POLICY "Admins can manage onchain whitelist"
ON public.onchain_voter_whitelist FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_onchain_voter_whitelist_election
ON public.onchain_voter_whitelist(election_id, chain, is_whitelisted);


-- 4) Resolve DB UUID ids into on-chain uint ids in one call
CREATE OR REPLACE FUNCTION public.resolve_onchain_vote_ids(
    p_election_id UUID,
    p_candidate_id UUID,
    p_chain TEXT
)
RETURNS TABLE (
    election_onchain_id BIGINT,
    candidate_onchain_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        em_election.onchain_id,
        em_candidate.onchain_id
    FROM public.onchain_entity_map em_election
    JOIN public.onchain_entity_map em_candidate
      ON em_candidate.entity_type = 'candidate'
     AND em_candidate.offchain_id = p_candidate_id
     AND em_candidate.chain = p_chain
    WHERE em_election.entity_type = 'election'
      AND em_election.offchain_id = p_election_id
      AND em_election.chain = p_chain
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_onchain_vote_ids(UUID, UUID, TEXT) TO authenticated;
