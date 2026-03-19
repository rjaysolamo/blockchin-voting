'use client';

import { useState, useCallback } from 'react';
import { encodeFunctionData, decodeEventLog } from 'viem';
import { useSupabaseAuth } from './useSupabaseAuth';
import { useToast } from './use-toast';
import { CONTRACT_ADDRESS as ENV_CONTRACT_ADDRESS } from '@/lib/constants';
import { getEmbeddedSmartAccountClient, hasEmbeddedPasskey } from '@/lib/embeddedSmartAccountProvider';
import { createChainPublicClient, getSupportedNetwork } from '@/lib/chain';
import { BlockchainVotingABI } from '@/lib/abis/BlockchainVoting';
import { supabase } from '@/integrations/supabase/client';

type Hex = `0x${string}`;

type TxLogLike = {
  data: Hex;
  topics: readonly Hex[];
};

type UserOpInclusionResult = {
  receipt?: { logs?: TxLogLike[]; transactionHash?: Hex } | { receipt?: { logs?: TxLogLike[]; transactionHash?: Hex } } | null;
  transactionHash?: Hex;
};

type ResolveOnchainVoteIdsRow = {
  election_onchain_id: string | number | null;
  candidate_onchain_id: string | number | null;
};

type SmartAccountClientLike = {
  getAddress: () => Promise<string>;
  sendUserOperation: (args: { uo: { target: Hex; data: Hex; value: bigint } }) => Promise<{ hash: Hex }>;
  waitForUserOperationTransaction?: (userOpHash: Hex) => Promise<{ transactionHash?: Hex; hash?: Hex; logs?: TxLogLike[] }>;
  getUserOperationReceipt?: (userOpHash: Hex) => Promise<{ transactionHash?: Hex; receipt?: { logs?: TxLogLike[]; transactionHash?: Hex }; logs?: TxLogLike[] }>;
};

const CONTRACT_ABI = BlockchainVotingABI;

async function waitForUserOpInclusion(client: SmartAccountClientLike, userOpHash: Hex): Promise<UserOpInclusionResult> {
  // Prefer first-class helper if available (Alchemy Account Kit exposes this on the smart account client).
  if (typeof client?.waitForUserOperationTransaction === 'function') {
    const res = await client.waitForUserOperationTransaction(userOpHash);
    return { receipt: res, transactionHash: res?.transactionHash ?? res?.hash };
  }

  if (typeof client?.getUserOperationReceipt === 'function') {
    for (let i = 0; i < 60; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const uoReceipt = await client.getUserOperationReceipt(userOpHash);
      const txHash = uoReceipt?.transactionHash ?? uoReceipt?.receipt?.transactionHash;
      if (txHash) return { receipt: uoReceipt?.receipt ?? uoReceipt, transactionHash: txHash };
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  throw new Error('AA client cannot wait for UserOperation inclusion (missing wait/get receipt helpers).');
}

function extractVerificationCodeFromLogs(
  logs: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }>
): string | null {
  for (const log of logs) {
    try {
      if (!log.topics || log.topics.length === 0) continue;
      const decoded = decodeEventLog({
        abi: CONTRACT_ABI,
        data: log.data,
        topics: log.topics as unknown as [Hex, ...Hex[]],
      }) as unknown as { eventName: string; args: unknown };
      if (decoded.eventName === 'VoteCast') return 'vote-cast';
    } catch {
      // ignore logs that don't match this ABI
    }
  }
  return null;
}

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

      // Mandatory server-side orchestration: ensure on-chain registration + election whitelist first.
      const { error: bootstrapError, data: bootstrapData } = await supabase.functions.invoke(
        'onchain-bootstrap-voter',
        { body: { electionId } }
      );
      if (bootstrapError || bootstrapData?.error) {
        return {
          success: false,
          error:
            bootstrapError?.message ||
            bootstrapData?.error ||
            'Failed to bootstrap on-chain voter eligibility',
        };
      }

      const enrolled = await hasEmbeddedPasskey({ userId: user.id });
      if (!enrolled) {
        return { success: false, error: 'No passkey enrolled on this device. Enroll a passkey before voting.' };
      }

      const { data: onchainIds, error: mappingError } = await supabase.rpc(
        'resolve_onchain_vote_ids' as never,
        {
          p_election_id: electionId,
          p_candidate_id: candidateId,
          p_chain: network,
        } as never
      );
      if (mappingError) {
        return {
          success: false,
          error: mappingError.message || 'Failed to resolve on-chain election/candidate IDs',
        };
      }

      const mappedRow = (Array.isArray(onchainIds) ? onchainIds[0] : null) as ResolveOnchainVoteIdsRow | null;
      const electionIdNum =
        mappedRow && mappedRow.election_onchain_id != null
          ? BigInt(String(mappedRow.election_onchain_id))
          : null;
      const candidateIdNum =
        mappedRow && mappedRow.candidate_onchain_id != null
          ? BigInt(String(mappedRow.candidate_onchain_id))
          : null;

      if (electionIdNum === null || candidateIdNum === null) {
        return {
          success: false,
          error:
            'Missing on-chain ID mapping for election/candidate. Ask admin to sync entities on-chain first.',
        };
      }

      const client = (await getEmbeddedSmartAccountClient({
        apiKey,
        userId: user.id,
        // Production-grade flow: enrollment is separate; voting must not create credentials.
        createIfMissing: false,
      })) as unknown as SmartAccountClientLike;
      const currentWalletAddress = (await client.getAddress()).toLowerCase();

      const { data: profileWalletData, error: profileWalletError } = await supabase
        .from('profiles')
        .select('wallet_address')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileWalletError) {
        return {
          success: false,
          error: profileWalletError.message || 'Failed to load registered wallet address',
        };
      }

      const registeredWalletAddress = profileWalletData?.wallet_address?.toLowerCase() ?? null;
      if (!registeredWalletAddress) {
        return {
          success: false,
          error: 'No registered wallet found on your profile. Please contact admin to complete wallet setup.',
        };
      }

      if (registeredWalletAddress !== currentWalletAddress) {
        return {
          success: false,
          error:
            'This passkey controls a different smart account than your registered voter wallet. Use your original device/passkey or ask admin to migrate your wallet.',
        };
      }

      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'castVote',
        args: [electionIdNum, candidateIdNum],
      });

      const { hash: userOpHash } = await client.sendUserOperation({
        uo: {
          target: contractAddress as Hex,
          data: data as Hex,
          value: BigInt(0),
        },
      });

      const { receipt, transactionHash } = await waitForUserOpInclusion(client, userOpHash);

      // This contract emits VoteCast but does not emit a verification code.
      // We use tx hash (or userOp hash fallback) as a deterministic receipt code.
      const verificationCode: string | null = transactionHash ?? userOpHash;

      const inclusionLogs = (receipt && typeof receipt === 'object'
        ? ((receipt as { logs?: TxLogLike[]; receipt?: { logs?: TxLogLike[] } }).logs ??
            (receipt as { receipt?: { logs?: TxLogLike[] } }).receipt?.logs ??
            [])
        : []) as TxLogLike[];
      const voteEventFound = !!extractVerificationCodeFromLogs(inclusionLogs);

      // If the AA SDK receipt doesn't contain logs reliably, fetch tx receipt via RPC and decode from there.
      if (!voteEventFound) {
        if (!transactionHash) {
          return {
            success: false,
            error:
              'Vote was submitted, but the transaction hash is unavailable. Check smart account configuration and retry.',
          };
        }

        const publicClient = createChainPublicClient({ apiKey, network });
        const txReceipt = await publicClient.getTransactionReceipt({ hash: transactionHash });
        const relevantLogs = txReceipt.logs
          .filter((l) => String(l.address).toLowerCase() === contractAddress.toLowerCase())
          .map((l) => {
            const topics = (typeof l === 'object' && l !== null && 'topics' in l ? (l as { topics?: unknown }).topics : []) ?? [];
            return {
              data: (l as { data: Hex }).data,
              topics: (Array.isArray(topics) ? topics : []) as readonly Hex[],
            };
          });
        if (!extractVerificationCodeFromLogs(relevantLogs)) {
          return {
            success: false,
            error:
              'Vote transaction was included, but VoteCast event was not found. Check contract address/network/ABI configuration.',
          };
        }
      }

      setLastVerificationCode(verificationCode);
      
      toast({
        title: 'Vote Cast Successfully',
        description: `Your vote has been recorded on the blockchain. ${transactionHash ? `Transaction: ${transactionHash}` : `UserOp: ${userOpHash}`}`,
      });

      return { success: true, verificationCode: verificationCode };
    } catch (error: unknown) {
      console.error('Vote casting error:', error);
      
      let errorMessage = 'An unexpected error occurred';
      
      const errObj = error as { code?: unknown; message?: unknown };
      const message = typeof errObj?.message === 'string' ? errObj.message : '';

      if (errObj?.code === 'ACTION_REJECTED') {
        errorMessage = 'Transaction was rejected by user';
      } else if (message.includes('already voted')) {
        errorMessage = 'You have already voted in this election';
      } else if (message.includes('Election is not active')) {
        errorMessage = 'The election is not currently active';
      } else if (message.includes('Voter has already voted')) {
        errorMessage = 'You have already voted in this election';
      }

      return { success: false, error: errorMessage };
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
