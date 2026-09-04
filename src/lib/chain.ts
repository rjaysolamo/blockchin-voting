import { http, type Chain, createPublicClient } from 'viem';
import { base, baseSepolia, sepolia } from '@account-kit/infra';

export type SupportedNetwork = 'baseSepolia' | 'base' | 'sepolia';

export function getSupportedNetwork(): SupportedNetwork {
  const raw = (import.meta.env.VITE_BLOCKCHAIN_NETWORK || 'baseSepolia').trim();
  if (raw === 'baseSepolia' || raw === 'base' || raw === 'sepolia') return raw;
  throw new Error(`Unsupported VITE_BLOCKCHAIN_NETWORK "${raw}" (expected baseSepolia | base | sepolia)`);
}

export function getChainFromNetwork(network: SupportedNetwork): Chain {
  switch (network) {
    case 'baseSepolia':
      return baseSepolia;
    case 'base':
      return base;
    case 'sepolia':
      return sepolia;
  }
}

export function getAlchemyRpcUrl(params: { apiKey: string; network?: SupportedNetwork }): string {
  const network = params.network ?? getSupportedNetwork();
  const override = (import.meta.env.VITE_ALCHEMY_RPC_URL as string | undefined)?.trim();
  if (override) return override;
  const apiKey = params.apiKey.trim();
  if (!apiKey || /\s/.test(apiKey) || apiKey.includes('/')) {
    throw new Error('Invalid Alchemy API key format. Use raw key only (no spaces, no URL).');
  }

  switch (network) {
    case 'baseSepolia':
      return `https://base-sepolia.g.alchemy.com/v2/${apiKey}`;
    case 'base':
      return `https://base-mainnet.g.alchemy.com/v2/${apiKey}`;
    case 'sepolia':
      return `https://eth-sepolia.g.alchemy.com/v2/${apiKey}`;
  }
}

export function createChainPublicClient(params: { apiKey: string; network?: SupportedNetwork }) {
  const network = params.network ?? getSupportedNetwork();
  const chain = getChainFromNetwork(network);
  const rpcUrl = getAlchemyRpcUrl({ apiKey: params.apiKey, network });
  return createPublicClient({ chain, transport: http(rpcUrl) });
}
