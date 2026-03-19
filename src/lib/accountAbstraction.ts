import type { Abi } from 'viem';
import { decodeEventLog } from 'viem';

export type Hex = `0x${string}`;

export type TxLogLike = {
  data: Hex;
  topics: readonly Hex[];
};

export type UserOpInclusionResult = {
  receipt?: { logs?: TxLogLike[]; transactionHash?: Hex } | { receipt?: { logs?: TxLogLike[]; transactionHash?: Hex } } | null;
  transactionHash?: Hex;
};

export type SmartAccountClientLike = {
  waitForUserOperationTransaction?: (userOpHash: Hex) => Promise<{ transactionHash?: Hex; hash?: Hex; logs?: TxLogLike[] }>;
  getUserOperationReceipt?: (userOpHash: Hex) => Promise<{ transactionHash?: Hex; receipt?: { logs?: TxLogLike[]; transactionHash?: Hex }; logs?: TxLogLike[] }>;
};

type ResolveUserOpOptions = {
  maxAttempts?: number;
  pollIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export async function waitForUserOpInclusion(
  client: SmartAccountClientLike,
  userOpHash: Hex,
  options?: ResolveUserOpOptions
): Promise<UserOpInclusionResult> {
  if (typeof client?.waitForUserOperationTransaction === 'function') {
    const res = await client.waitForUserOperationTransaction(userOpHash);
    return { receipt: res, transactionHash: res?.transactionHash ?? res?.hash };
  }

  if (typeof client?.getUserOperationReceipt === 'function') {
    const maxAttempts = options?.maxAttempts ?? 60;
    const pollIntervalMs = options?.pollIntervalMs ?? 1500;
    const sleep = options?.sleep ?? defaultSleep;

    for (let i = 0; i < maxAttempts; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const uoReceipt = await client.getUserOperationReceipt(userOpHash);
      const txHash = uoReceipt?.transactionHash ?? uoReceipt?.receipt?.transactionHash;
      if (txHash) return { receipt: uoReceipt?.receipt ?? uoReceipt, transactionHash: txHash };
      // eslint-disable-next-line no-await-in-loop
      await sleep(pollIntervalMs);
    }
  }

  throw new Error('AA client cannot wait for UserOperation inclusion (missing wait/get receipt helpers).');
}

export function hasVoteCastEvent(abi: Abi, logs: Array<{ data: Hex; topics: readonly Hex[] }>): boolean {
  for (const log of logs) {
    try {
      if (!log.topics || log.topics.length === 0) continue;
      const decoded = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics as unknown as [Hex, ...Hex[]],
      }) as unknown as { eventName: string; args: unknown };
      if (decoded.eventName === 'VoteCast') return true;
    } catch {
      // ignore logs that don't match this ABI
    }
  }
  return false;
}

export function mapVoteCastError(error: unknown): string {
  const errObj = error as { code?: unknown; message?: unknown };
  const message = typeof errObj?.message === 'string' ? errObj.message : '';
  const normalized = message.toLowerCase();

  if (errObj?.code === 'ACTION_REJECTED') return 'Transaction was rejected by user';
  if (normalized.includes('already voted for this position')) return 'You already voted for this position';
  if (normalized.includes('not whitelisted')) return 'Your wallet is not whitelisted for this election';
  if (normalized.includes('student inactive')) return 'Your student account is inactive';
  if (normalized.includes('student not registered')) return 'Your wallet is not registered as a student';
  if (normalized.includes('election inactive') || normalized.includes('election not started') || normalized.includes('election ended')) {
    return 'This election is not currently open';
  }
  if (normalized.includes('candidate not in election') || normalized.includes('candidate does not exist')) {
    return 'Selected candidate is invalid for this election';
  }
  if (normalized.includes('paymaster') || normalized.includes('bundler')) {
    return 'Transaction sponsorship failed. Please retry in a moment.';
  }

  return 'An unexpected error occurred';
}
