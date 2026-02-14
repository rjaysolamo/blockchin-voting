import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateVoteHash } from '../lib/crypto';
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data, error } = await supabase.functions.invoke('vote', {
        body: { candidateId, electionId, position },
      });

      if (error) {
        console.error('Vote function error:', error);
        return { success: false, error: 'Failed to cast vote. Please try again.' };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      setLastVerificationCode(data.verificationCode);
      return { success: true, verificationCode: data.verificationCode };
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
