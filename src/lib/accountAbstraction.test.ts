import { describe, expect, it, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, parseAbiItem } from 'viem';
import { BlockchainVotingABI } from '@/lib/abis/BlockchainVoting';
import {
  hasVoteCastEvent,
  mapVoteCastError,
  waitForUserOpInclusion,
  type Hex,
  type SmartAccountClientLike,
} from './accountAbstraction';

describe('accountAbstraction', () => {
  it('resolves inclusion via waitForUserOperationTransaction when available', async () => {
    const client: SmartAccountClientLike = {
      waitForUserOperationTransaction: vi.fn(async () => ({
        transactionHash: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
      })),
    };

    const res = await waitForUserOpInclusion(
      client,
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );

    expect(res.transactionHash).toBe('0x1111111111111111111111111111111111111111111111111111111111111111');
  });

  it('polls getUserOperationReceipt until transaction hash exists', async () => {
    const getReceipt = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        receipt: {
          transactionHash:
            '0x2222222222222222222222222222222222222222222222222222222222222222',
        },
      });

    const client: SmartAccountClientLike = {
      getUserOperationReceipt: getReceipt,
    };

    const res = await waitForUserOpInclusion(
      client,
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      { maxAttempts: 3, pollIntervalMs: 0, sleep: async () => undefined }
    );

    expect(getReceipt).toHaveBeenCalledTimes(2);
    expect(res.transactionHash).toBe('0x2222222222222222222222222222222222222222222222222222222222222222');
  });

  it('detects VoteCast event in logs', () => {
    const voteCastEvent = parseAbiItem(
      'event VoteCast(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter, uint8 position)'
    );

    const topics = encodeEventTopics({
      abi: [voteCastEvent],
      eventName: 'VoteCast',
      args: {
        electionId: 1n,
        candidateId: 2n,
        voter: '0x1234567890123456789012345678901234567890',
      },
    }) as readonly Hex[];

    const data = encodeAbiParameters([{ type: 'uint8' }], [0]);

    const found = hasVoteCastEvent(BlockchainVotingABI, [{ topics, data }]);
    expect(found).toBe(true);
  });

  it('maps expected on-chain and AA errors into user-safe messages', () => {
    expect(mapVoteCastError({ code: 'ACTION_REJECTED' })).toBe('Transaction was rejected by user');
    expect(mapVoteCastError({ message: 'execution reverted: Not whitelisted' })).toBe(
      'Your wallet is not whitelisted for this election'
    );
    expect(mapVoteCastError({ message: 'execution reverted: Already voted for this position' })).toBe(
      'You already voted for this position'
    );
    expect(mapVoteCastError({ message: 'bundler error: paymaster denied' })).toBe(
      'Transaction sponsorship failed. Please retry in a moment.'
    );
    expect(mapVoteCastError({ message: 'unknown failure' })).toBe('An unexpected error occurred');
  });
});
