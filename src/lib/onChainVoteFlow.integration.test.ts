import { describe, expect, it, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, parseAbiItem, type Abi } from 'viem';
import { BlockchainVotingABI } from '@/lib/abis/BlockchainVoting';
import { castOnChainVote } from './onChainVoteFlow';
import type { Hex } from './accountAbstraction';

const CONTRACT_ADDRESS = '0xf344bf655A88A9c881EA50011AAf52Bbe27262D1';
const USER_ID = 'user-1';
const API_KEY = 'test-api-key';
const NETWORK = 'baseSepolia';

function voteCastLog() {
  const event = parseAbiItem(
    'event VoteCast(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter, uint8 position)'
  );
  const topics = encodeEventTopics({
    abi: [event],
    eventName: 'VoteCast',
    args: {
      electionId: 1n,
      candidateId: 2n,
      voter: '0x1111111111111111111111111111111111111111',
    },
  }) as readonly Hex[];
  const data = encodeAbiParameters([{ type: 'uint8' }], [0]) as Hex;
  return { data, topics };
}

describe('castOnChainVote integration', () => {
  it('submits complete AA vote flow with Supabase bootstrap and bundler inclusion', async () => {
    const sendUserOperation = vi.fn(async () => ({
      hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex,
    }));

    const getAddress = vi.fn(async () => '0x1111111111111111111111111111111111111111');
    const waitForUserOperationTransaction = vi.fn(async () => ({
      transactionHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex,
      logs: [voteCastLog()],
    }));

    const res = await castOnChainVote(
      {
        candidateId: 'cand-2',
        electionId: 'elec-1',
        userId: USER_ID,
        apiKey: API_KEY,
        network: NETWORK,
        contractAddress: CONTRACT_ADDRESS,
        abi: BlockchainVotingABI as Abi,
      },
      {
        supabaseGateway: {
          bootstrapVoter: async () => ({}),
          resolveOnchainVoteIds: async () => ({
            electionOnchainId: 1n,
            candidateOnchainId: 2n,
          }),
          getRegisteredWalletAddress: async () => ({
            walletAddress: '0x1111111111111111111111111111111111111111',
          }),
          getWhitelistStatus: async () => ({ isWhitelisted: true }),
        },
        hasEmbeddedPasskey: async () => true,
        getEmbeddedSmartAccountClient: async () => ({
          getAddress,
          sendUserOperation,
          waitForUserOperationTransaction,
        }),
        createChainPublicClient: () => ({
          getTransactionReceipt: vi.fn(async () => ({ logs: [] })),
        }),
      }
    );

    expect(res.success).toBe(true);
    expect(res.verificationCode).toBe('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(getAddress).toHaveBeenCalledOnce();
    expect(sendUserOperation).toHaveBeenCalledOnce();
    expect(waitForUserOperationTransaction).toHaveBeenCalledOnce();
  });

  it('falls back to chain tx receipt when bundler receipt has no logs', async () => {
    const getTransactionReceipt = vi.fn(async () => ({
      logs: [
        {
          address: CONTRACT_ADDRESS,
          ...voteCastLog(),
        },
      ],
    }));

    const res = await castOnChainVote(
      {
        candidateId: 'cand-2',
        electionId: 'elec-1',
        userId: USER_ID,
        apiKey: API_KEY,
        network: NETWORK,
        contractAddress: CONTRACT_ADDRESS,
        abi: BlockchainVotingABI as Abi,
      },
      {
        supabaseGateway: {
          bootstrapVoter: async () => ({}),
          resolveOnchainVoteIds: async () => ({
            electionOnchainId: 1n,
            candidateOnchainId: 2n,
          }),
          getRegisteredWalletAddress: async () => ({
            walletAddress: '0x1111111111111111111111111111111111111111',
          }),
          getWhitelistStatus: async () => ({ isWhitelisted: true }),
        },
        hasEmbeddedPasskey: async () => true,
        getEmbeddedSmartAccountClient: async () => ({
          getAddress: async () => '0x1111111111111111111111111111111111111111',
          sendUserOperation: async () => ({
            hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex,
          }),
          waitForUserOperationTransaction: async () => ({
            transactionHash:
              '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' as Hex,
            logs: [],
          }),
        }),
        createChainPublicClient: () => ({
          getTransactionReceipt,
        }),
      }
    );

    expect(res.success).toBe(true);
    expect(res.verificationCode).toBe('0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc');
    expect(getTransactionReceipt).toHaveBeenCalledWith({
      hash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    });
  });

  it('blocks vote when registered wallet does not match smart account', async () => {
    const sendUserOperation = vi.fn();

    const res = await castOnChainVote(
      {
        candidateId: 'cand-2',
        electionId: 'elec-1',
        userId: USER_ID,
        apiKey: API_KEY,
        network: NETWORK,
        contractAddress: CONTRACT_ADDRESS,
        abi: BlockchainVotingABI as Abi,
      },
      {
        supabaseGateway: {
          bootstrapVoter: async () => ({}),
          resolveOnchainVoteIds: async () => ({
            electionOnchainId: 1n,
            candidateOnchainId: 2n,
          }),
          getRegisteredWalletAddress: async () => ({
            walletAddress: '0x9999999999999999999999999999999999999999',
          }),
          getWhitelistStatus: async () => ({ isWhitelisted: true }),
        },
        hasEmbeddedPasskey: async () => true,
        getEmbeddedSmartAccountClient: async () => ({
          getAddress: async () => '0x1111111111111111111111111111111111111111',
          sendUserOperation: sendUserOperation as never,
        }),
        createChainPublicClient: () => ({
          getTransactionReceipt: vi.fn(async () => ({ logs: [] })),
        }),
      }
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain('different smart account');
    expect(sendUserOperation).not.toHaveBeenCalled();
  });

  it('returns sponsorship error when bundler/paymaster rejects user operation', async () => {
    const res = await castOnChainVote(
      {
        candidateId: 'cand-2',
        electionId: 'elec-1',
        userId: USER_ID,
        apiKey: API_KEY,
        network: NETWORK,
        contractAddress: CONTRACT_ADDRESS,
        abi: BlockchainVotingABI as Abi,
      },
      {
        supabaseGateway: {
          bootstrapVoter: async () => ({}),
          resolveOnchainVoteIds: async () => ({
            electionOnchainId: 1n,
            candidateOnchainId: 2n,
          }),
          getRegisteredWalletAddress: async () => ({
            walletAddress: '0x1111111111111111111111111111111111111111',
          }),
          getWhitelistStatus: async () => ({ isWhitelisted: true }),
        },
        hasEmbeddedPasskey: async () => true,
        getEmbeddedSmartAccountClient: async () => ({
          getAddress: async () => '0x1111111111111111111111111111111111111111',
          sendUserOperation: async () => {
            throw new Error('paymaster rejected sponsorship');
          },
        }),
        createChainPublicClient: () => ({
          getTransactionReceipt: vi.fn(async () => ({ logs: [] })),
        }),
      }
    );

    expect(res.success).toBe(false);
    expect(res.error).toBe('Transaction sponsorship failed. Please retry in a moment.');
  });

  it('blocks vote for non-whitelisted wallet', async () => {
    const sendUserOperation = vi.fn();

    const res = await castOnChainVote(
      {
        candidateId: 'cand-2',
        electionId: 'elec-1',
        userId: USER_ID,
        apiKey: API_KEY,
        network: NETWORK,
        contractAddress: CONTRACT_ADDRESS,
        abi: BlockchainVotingABI as Abi,
      },
      {
        supabaseGateway: {
          bootstrapVoter: async () => ({}),
          resolveOnchainVoteIds: async () => ({
            electionOnchainId: 1n,
            candidateOnchainId: 2n,
          }),
          getRegisteredWalletAddress: async () => ({
            walletAddress: '0x1111111111111111111111111111111111111111',
          }),
          getWhitelistStatus: async () => ({ isWhitelisted: false }),
        },
        hasEmbeddedPasskey: async () => true,
        getEmbeddedSmartAccountClient: async () => ({
          getAddress: async () => '0x1111111111111111111111111111111111111111',
          sendUserOperation: sendUserOperation as never,
        }),
        createChainPublicClient: () => ({
          getTransactionReceipt: vi.fn(async () => ({ logs: [] })),
        }),
      }
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain('not whitelisted');
    expect(sendUserOperation).not.toHaveBeenCalled();
  });

  it('auto-recovers when mapping is initially missing and becomes available after bootstrap retry', async () => {
    const bootstrapVoter = vi
      .fn<() => Promise<{ error?: string | null }>>()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const resolveOnchainVoteIds = vi
      .fn<
        () => Promise<{
          electionOnchainId: bigint | null;
          candidateOnchainId: bigint | null;
          error?: string | null;
        }>
      >()
      .mockResolvedValueOnce({
        electionOnchainId: null,
        candidateOnchainId: null,
      })
      .mockResolvedValueOnce({
        electionOnchainId: 1n,
        candidateOnchainId: 2n,
      });

    const sendUserOperation = vi.fn(async () => ({
      hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex,
    }));

    const res = await castOnChainVote(
      {
        candidateId: 'cand-2',
        electionId: 'elec-1',
        userId: USER_ID,
        apiKey: API_KEY,
        network: NETWORK,
        contractAddress: CONTRACT_ADDRESS,
        abi: BlockchainVotingABI as Abi,
      },
      {
        supabaseGateway: {
          bootstrapVoter,
          resolveOnchainVoteIds,
          getRegisteredWalletAddress: async () => ({
            walletAddress: '0x1111111111111111111111111111111111111111',
          }),
          getWhitelistStatus: async () => ({ isWhitelisted: true }),
        },
        hasEmbeddedPasskey: async () => true,
        getEmbeddedSmartAccountClient: async () => ({
          getAddress: async () => '0x1111111111111111111111111111111111111111',
          sendUserOperation,
          waitForUserOperationTransaction: async () => ({
            transactionHash:
              '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex,
            logs: [voteCastLog()],
          }),
        }),
        createChainPublicClient: () => ({
          getTransactionReceipt: vi.fn(async () => ({ logs: [] })),
        }),
      }
    );

    expect(res.success).toBe(true);
    expect(bootstrapVoter).toHaveBeenCalledTimes(2);
    expect(resolveOnchainVoteIds).toHaveBeenCalledTimes(2);
    expect(sendUserOperation).toHaveBeenCalledTimes(1);
  });
});
