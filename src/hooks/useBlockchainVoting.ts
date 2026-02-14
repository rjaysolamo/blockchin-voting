import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateVoteHash, generateVerificationCode, generateNonce } from '@/lib/blockchain';
import { VoteBlock, VoteVerificationResult } from '@/@types/blockchain';

interface CastVoteParams {
  candidateId: string;
  electionId: string;
  position: string;
}

export function useBlockchainVoting() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastVerificationCode, setLastVerificationCode] = useState<string | null>(null);

  const castVote = useCallback(async ({
    candidateId,
    electionId,
    position,
  }: CastVoteParams): Promise<{ success: boolean; verificationCode?: string; error?: string }> => {
    setIsSubmitting(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Get the latest block hash for this election
      const { data: latestHashData, error: hashError } = await supabase
        .rpc('get_latest_block_hash', { p_election_id: electionId });
      
      if (hashError) {
        console.error('Error getting latest hash:', hashError);
        return { success: false, error: 'Failed to get chain state' };
      }

      const previousHash = latestHashData || 'GENESIS';

      // Get next block number
      const { data: blockNumberData, error: blockError } = await supabase
        .rpc('get_next_block_number', { p_election_id: electionId });
      
      if (blockError) {
        console.error('Error getting block number:', blockError);
        return { success: false, error: 'Failed to get block number' };
      }

      const blockNumber = blockNumberData || 1;
      const timestamp = new Date().toISOString();
      const nonce = generateNonce();
      const verificationCode = generateVerificationCode();

      // Generate the hash for this block
      const currentHash = await generateVoteHash({
        previousHash,
        voterId: user.id,
        candidateId,
        electionId,
        position,
        timestamp,
        nonce,
      });

      // Insert the vote into the chain
      const { error: insertError } = await supabase
        .from('vote_chain')
        .insert({
          block_number: blockNumber,
          previous_hash: previousHash,
          current_hash: currentHash,
          voter_id: user.id,
          candidate_id: candidateId,
          election_id: electionId,
          position,
          timestamp,
          nonce,
          verification_code: verificationCode,
        });

      if (insertError) {
        console.error('Error inserting vote:', insertError);
        if (insertError.code === '23505') {
          return { success: false, error: 'You have already voted for this position' };
        }
        return { success: false, error: 'Failed to record vote' };
      }

      // Update voter registry
      await supabase
        .from('voter_registry')
        .upsert({
          voter_id: user.id,
          election_id: electionId,
          has_voted: true,
          voted_at: timestamp,
        });

      setLastVerificationCode(verificationCode);
      return { success: true, verificationCode };
    } catch (error) {
      console.error('Vote casting error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const verifyVote = useCallback(async (
    verificationCode: string
  ): Promise<VoteVerificationResult> => {
    try {
      const { data: vote, error } = await supabase
        .from('vote_chain')
        .select('*')
        .eq('verification_code', verificationCode)
        .maybeSingle();

      if (error || !vote) {
        return {
          verified: false,
          message: 'No vote found with this verification code',
        };
      }

      // Verify the hash is correct
      const computedHash = await generateVoteHash({
        previousHash: vote.previous_hash,
        voterId: vote.voter_id,
        candidateId: vote.candidate_id,
        electionId: vote.election_id,
        position: vote.position,
        timestamp: vote.timestamp,
        nonce: vote.nonce,
      });

      const hashValid = computedHash === vote.current_hash;

      return {
        verified: hashValid,
        block: vote as VoteBlock,
        chainValid: hashValid,
        message: hashValid
          ? 'Vote verified successfully! Your vote is securely recorded on the chain.'
          : 'Warning: Vote hash mismatch detected. The vote may have been tampered with.',
      };
    } catch (error) {
      console.error('Vote verification error:', error);
      return {
        verified: false,
        message: 'An error occurred during verification',
      };
    }
  }, []);

  const getMyVotes = useCallback(async (electionId: string): Promise<VoteBlock[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('vote_chain')
      .select('*')
      .eq('voter_id', user.id)
      .eq('election_id', electionId);

    if (error) {
      console.error('Error fetching votes:', error);
      return [];
    }

    return (data || []) as VoteBlock[];
  }, []);

  return {
    castVote,
    verifyVote,
    getMyVotes,
    isSubmitting,
    lastVerificationCode,
  };
}
