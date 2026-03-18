'use client';

import { useState, useCallback } from 'react';
import { encodeFunctionData, decodeEventLog } from 'viem';
import { useSupabaseAuth } from './useSupabaseAuth';
import { useToast } from './use-toast';
import { CONTRACT_ADDRESS as ENV_CONTRACT_ADDRESS } from '@/lib/constants';
import { getEmbeddedSmartAccountClient, hasEmbeddedPasskey } from '@/lib/embeddedSmartAccountProvider';
import { createChainPublicClient, getSupportedNetwork } from '@/lib/chain';

type Hex = `0x${string}`;

type TxLogLike = {
  data: Hex;
  topics: readonly Hex[];
};

type UserOpInclusionResult = {
  receipt?: { logs?: TxLogLike[]; transactionHash?: Hex } | { receipt?: { logs?: TxLogLike[]; transactionHash?: Hex } } | null;
  transactionHash?: Hex;
};

type SmartAccountClientLike = {
  sendUserOperation: (args: { uo: { target: Hex; data: Hex; value: bigint } }) => Promise<{ hash: Hex }>;
  waitForUserOperationTransaction?: (userOpHash: Hex) => Promise<{ transactionHash?: Hex; hash?: Hex; logs?: TxLogLike[] }>;
  getUserOperationReceipt?: (userOpHash: Hex) => Promise<{ transactionHash?: Hex; receipt?: { logs?: TxLogLike[]; transactionHash?: Hex }; logs?: TxLogLike[] }>;
};

const CONTRACT_ABI = [
  {
    name: 'castVote',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_electionId', type: 'uint256' },
      { name: '_candidateId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'VoteCast',
    type: 'event',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'blockNumber', type: 'uint256' },
      { indexed: true, name: 'voter', type: 'address' },
      { indexed: false, name: 'electionId', type: 'uint256' },
      { indexed: false, name: 'candidateId', type: 'uint256' },
      { indexed: false, name: 'voteHash', type: 'bytes32' },
      { indexed: false, name: 'verificationCode', type: 'string' },
    ],
  },
] as const;

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
      if (decoded.eventName === 'VoteCast') {
        const args = decoded.args as { verificationCode?: unknown };
        const code = args.verificationCode;
        if (typeof code === 'string' && code.length > 0) return code;
      }
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

      const enrolled = await hasEmbeddedPasskey({ userId: user.id });
      if (!enrolled) {
        return { success: false, error: 'No passkey enrolled on this device. Enroll a passkey before voting.' };
      }

      // Convert string IDs to numbers for the contract
      const electionIdNum = parseInt(electionId, 10);
      const candidateIdNum = parseInt(candidateId, 10);

      if (isNaN(electionIdNum) || isNaN(candidateIdNum)) {
        return { success: false, error: 'Invalid election or candidate ID' };
      }

      const client = (await getEmbeddedSmartAccountClient({
        apiKey,
        userId: user.id,
        // Production-grade flow: enrollment is separate; voting must not create credentials.
        createIfMissing: false,
      })) as unknown as SmartAccountClientLike;

      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'castVote',
        args: [BigInt(electionIdNum), BigInt(candidateIdNum)],
      });

      const { hash: userOpHash } = await client.sendUserOperation({
        uo: {
          target: contractAddress as Hex,
          data: data as Hex,
          value: BigInt(0),
        },
      });

      const { receipt, transactionHash } = await waitForUserOpInclusion(client, userOpHash);

      // Production guarantee: verification code must come from on-chain event logs.
      let verificationCode: string | null = null;

      const inclusionLogs = (receipt && typeof receipt === 'object'
        ? ((receipt as { logs?: TxLogLike[]; receipt?: { logs?: TxLogLike[] } }).logs ??
            (receipt as { receipt?: { logs?: TxLogLike[] } }).receipt?.logs ??
            [])
        : []) as TxLogLike[];
      verificationCode = extractVerificationCodeFromLogs(inclusionLogs);

      // If the AA SDK receipt doesn't contain logs reliably, fetch tx receipt via RPC and decode from there.
      if (!verificationCode && transactionHash) {
        const network = getSupportedNetwork();
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
        verificationCode = extractVerificationCodeFromLogs(relevantLogs);
      }

      if (!verificationCode) {
        return {
          success: false,
          error:
            'Vote transaction included, but verification code event was not found. This indicates an on-chain/ABI mismatch or a receipt parsing issue.',
        };
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
