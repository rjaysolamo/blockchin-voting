import { encodeFunctionData, type Abi } from 'viem';
import {
  hasVoteCastEvent,
  mapVoteCastError,
  waitForUserOpInclusion,
  type Hex,
  type SmartAccountClientLike,
  type TxLogLike,
} from '@/lib/accountAbstraction';

type ResolveOnchainVoteIds = {
  electionOnchainId: bigint | null;
  candidateOnchainId: bigint | null;
  error?: string | null;
};

type ProfileWalletLookup = {
  walletAddress: string | null;
  error?: string | null;
};

type SmartAccountVotingClient = SmartAccountClientLike & {
  getAddress: () => Promise<string>;
  sendUserOperation: (args: { uo: { target: Hex; data: Hex; value: bigint } }) => Promise<{ hash: Hex }>;
};

type TxReceiptClient = {
  getTransactionReceipt: (args: { hash: Hex }) => Promise<{
    logs: Array<{ address: string; data: Hex; topics: readonly Hex[] }>;
  }>;
};

export type OnChainVoteSupabaseGateway = {
  bootstrapVoter: (electionId: string) => Promise<{ error?: string | null }>;
  resolveOnchainVoteIds: (args: {
    electionId: string;
    candidateId: string;
    chain: string;
  }) => Promise<ResolveOnchainVoteIds>;
  getRegisteredWalletAddress: (userId: string) => Promise<ProfileWalletLookup>;
};

export type CastOnChainVoteParams = {
  candidateId: string;
  electionId: string;
  userId: string;
  apiKey: string;
  network: string;
  contractAddress: string;
  abi: Abi;
};

export type CastOnChainVoteDeps = {
  supabaseGateway: OnChainVoteSupabaseGateway;
  hasEmbeddedPasskey: (params: { userId: string }) => Promise<boolean>;
  getEmbeddedSmartAccountClient: (params: {
    apiKey: string;
    userId: string;
    createIfMissing?: boolean;
  }) => Promise<SmartAccountVotingClient>;
  createChainPublicClient: (params: { apiKey: string; network: string }) => TxReceiptClient;
};

export type CastOnChainVoteResult = {
  success: boolean;
  verificationCode?: string;
  error?: string;
  userOpHash?: Hex;
  transactionHash?: Hex;
};

export async function castOnChainVote(
  params: CastOnChainVoteParams,
  deps: CastOnChainVoteDeps
): Promise<CastOnChainVoteResult> {
  try {
    const bootstrap = await deps.supabaseGateway.bootstrapVoter(params.electionId);
    if (bootstrap.error) {
      return { success: false, error: bootstrap.error };
    }

    const enrolled = await deps.hasEmbeddedPasskey({ userId: params.userId });
    if (!enrolled) {
      return { success: false, error: 'No passkey enrolled on this device. Enroll a passkey before voting.' };
    }

    const mapping = await deps.supabaseGateway.resolveOnchainVoteIds({
      electionId: params.electionId,
      candidateId: params.candidateId,
      chain: params.network,
    });
    if (mapping.error) {
      return { success: false, error: mapping.error };
    }
    if (mapping.electionOnchainId === null || mapping.candidateOnchainId === null) {
      return {
        success: false,
        error: 'Missing on-chain ID mapping for election/candidate. Ask admin to sync entities on-chain first.',
      };
    }

    const client = await deps.getEmbeddedSmartAccountClient({
      apiKey: params.apiKey,
      userId: params.userId,
      createIfMissing: false,
    });
    const currentWalletAddress = (await client.getAddress()).toLowerCase();

    const profileWallet = await deps.supabaseGateway.getRegisteredWalletAddress(params.userId);
    if (profileWallet.error) {
      return { success: false, error: profileWallet.error };
    }
    const registeredWalletAddress = profileWallet.walletAddress?.toLowerCase() ?? null;
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
      abi: params.abi,
      functionName: 'castVote',
      args: [mapping.electionOnchainId, mapping.candidateOnchainId],
    });

    const { hash: userOpHash } = await client.sendUserOperation({
      uo: {
        target: params.contractAddress as Hex,
        data: data as Hex,
        value: 0n,
      },
    });

    const { receipt, transactionHash } = await waitForUserOpInclusion(client, userOpHash);
    const verificationCode: string = transactionHash ?? userOpHash;

    const inclusionLogs = (receipt && typeof receipt === 'object'
      ? ((receipt as { logs?: TxLogLike[]; receipt?: { logs?: TxLogLike[] } }).logs ??
          (receipt as { receipt?: { logs?: TxLogLike[] } }).receipt?.logs ??
          [])
      : []) as TxLogLike[];
    const voteEventFound = hasVoteCastEvent(params.abi, inclusionLogs);

    if (!voteEventFound) {
      if (!transactionHash) {
        return {
          success: false,
          error:
            'Vote was submitted, but the transaction hash is unavailable. Check smart account configuration and retry.',
        };
      }

      const publicClient = deps.createChainPublicClient({ apiKey: params.apiKey, network: params.network });
      const txReceipt = await publicClient.getTransactionReceipt({ hash: transactionHash });
      const relevantLogs = txReceipt.logs
        .filter((l) => String(l.address).toLowerCase() === params.contractAddress.toLowerCase())
        .map((l) => ({ data: l.data, topics: l.topics }));
      if (!hasVoteCastEvent(params.abi, relevantLogs)) {
        return {
          success: false,
          error:
            'Vote transaction was included, but VoteCast event was not found. Check contract address/network/ABI configuration.',
        };
      }
    }

    return {
      success: true,
      verificationCode,
      transactionHash,
      userOpHash,
    };
  } catch (error) {
    return { success: false, error: mapVoteCastError(error) };
  }
}
