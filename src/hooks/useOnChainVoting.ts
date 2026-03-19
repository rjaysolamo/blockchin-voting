'use client';

import { useState, useCallback } from 'react';
import { useSupabaseAuth } from './useSupabaseAuth';
import { useToast } from './use-toast';
import { CONTRACT_ADDRESS as ENV_CONTRACT_ADDRESS } from '@/lib/constants';
import { getEmbeddedSmartAccountClient, hasEmbeddedPasskey } from '@/lib/embeddedSmartAccountProvider';
import { createChainPublicClient, getSupportedNetwork } from '@/lib/chain';
import { BlockchainVotingABI } from '@/lib/abis/BlockchainVoting';
import { supabase } from '@/integrations/supabase/client';
import { castOnChainVote } from '@/lib/onChainVoteFlow';

const CONTRACT_ABI = BlockchainVotingABI;

interface CastVoteParams {
  candidateId: string;
  electionId: string;
}

interface UseOnChainVotingReturn {
      castVote: (params: CastVoteParams) => Promise<{ success: boolean; verificationCode?: string; error?: string }>;
  isSubmitting: boolean;
  lastVerificationCode: string | null;
}

export function useOnChainVoting(): UseOnChainVotingReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastVerificationCode, setLastVerificationCode] = useState<string | null>(null);
  const { user } = useSupabaseAuth();
  const { toast } = useToast();

  const castVote = useCallback(async ({
    candidateId,
    electionId,
  }: CastVoteParams): Promise<{ success: boolean; verificationCode?: string; error?: string }> => {
    setIsSubmitting(true);

    try {
      if (!user?.id) {
        return { success: false, error: 'You must be signed in to vote' };
      }

      const apiKey = import.meta.env.VITE_ALCHEMY_API_KEY as string | undefined;
      if (!apiKey) {
        return { success: false, error: 'Missing VITE_ALCHEMY_API_KEY' };
      }

      const contractAddress = (ENV_CONTRACT_ADDRESS || '').trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
        return { success: false, error: 'Missing or invalid VITE_CONTRACT_ADDRESS' };
      }

      const network = getSupportedNetwork();
      const result = await castOnChainVote(
        {
          candidateId,
          electionId,
          userId: user.id,
          apiKey,
          network,
          contractAddress,
          abi: CONTRACT_ABI,
        },
        {
          supabaseGateway: {
            bootstrapVoter: async (electionIdParam) => {
              const { error: bootstrapError, data: bootstrapData } = await supabase.functions.invoke(
                'onchain-bootstrap-voter',
                { body: { electionId: electionIdParam } }
              );
              return {
                error:
                  bootstrapError?.message ||
                  bootstrapData?.error ||
                  null,
              };
            },
            resolveOnchainVoteIds: async ({ electionId: eId, candidateId: cId, chain }) => {
              const { data: onchainIds, error: mappingError } = await supabase.rpc(
                'resolve_onchain_vote_ids' as never,
                {
                  p_election_id: eId,
                  p_candidate_id: cId,
                  p_chain: chain,
                } as never
              );
              const mappedRow = (Array.isArray(onchainIds) ? onchainIds[0] : null) as
                | { election_onchain_id: string | number | null; candidate_onchain_id: string | number | null }
                | null;
              return {
                electionOnchainId:
                  mappedRow && mappedRow.election_onchain_id != null
                    ? BigInt(String(mappedRow.election_onchain_id))
                    : null,
                candidateOnchainId:
                  mappedRow && mappedRow.candidate_onchain_id != null
                    ? BigInt(String(mappedRow.candidate_onchain_id))
                    : null,
                error: mappingError?.message || null,
              };
            },
            getRegisteredWalletAddress: async (userIdParam) => {
              const { data: profileWalletData, error: profileWalletError } = await supabase
                .from('profiles')
                .select('wallet_address')
                .eq('user_id', userIdParam)
                .maybeSingle();

              return {
                walletAddress: profileWalletData?.wallet_address?.toLowerCase() ?? null,
                error: profileWalletError?.message || null,
              };
            },
          },
          hasEmbeddedPasskey,
          getEmbeddedSmartAccountClient,
          createChainPublicClient: ({ apiKey: key, network: net }) =>
            createChainPublicClient({ apiKey: key, network: net as ReturnType<typeof getSupportedNetwork> }),
        }
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      setLastVerificationCode(result.verificationCode ?? null);
      
      toast({
        title: 'Vote Cast Successfully',
        description: `Your vote has been recorded on the blockchain. ${result.transactionHash ? `Transaction: ${result.transactionHash}` : `UserOp: ${result.userOpHash}`}`,
      });

      return { success: true, verificationCode: result.verificationCode };
    } catch (error: unknown) {
      console.error('Vote casting error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.id, toast]);

  return {
    castVote,
    isSubmitting,
    lastVerificationCode,
  };
}
