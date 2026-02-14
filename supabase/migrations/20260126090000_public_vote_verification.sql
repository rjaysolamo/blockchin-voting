CREATE POLICY "no updates on vote_chain"
ON public.vote_chain
FOR UPDATE
USING (false);

CREATE OR REPLACE FUNCTION public.get_vote_by_verification_code(p_code TEXT)
RETURNS TABLE (
  block_number BIGINT,
  previous_hash TEXT,
  current_hash TEXT,
  voter_id UUID,
  candidate_id UUID,
  election_id UUID,
  position TEXT,
  timestamp TIMESTAMP WITH TIME ZONE,
  nonce INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT block_number, previous_hash, current_hash, voter_id, candidate_id, election_id, position, timestamp, nonce
  FROM public.vote_chain
  WHERE verification_code = p_code
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_vote_chain_for_election(p_election_id UUID)
RETURNS TABLE (
  block_number BIGINT,
  previous_hash TEXT,
  current_hash TEXT,
  voter_id UUID,
  candidate_id UUID,
  election_id UUID,
  position TEXT,
  timestamp TIMESTAMP WITH TIME ZONE,
  nonce INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT block_number, previous_hash, current_hash, voter_id, candidate_id, election_id, position, timestamp, nonce
  FROM public.vote_chain
  WHERE election_id = p_election_id
  ORDER BY block_number ASC
$$;

GRANT EXECUTE ON FUNCTION public.get_vote_by_verification_code(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vote_chain_for_election(UUID) TO anon, authenticated;
