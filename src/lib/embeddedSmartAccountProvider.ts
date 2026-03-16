import { createWalletClient, http } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createModularAccountAlchemyClient } from '@alchemy/aa-alchemy';
import { WalletClientSigner } from '@alchemy/aa-core';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function getStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function getOrCreateEmbeddedPrivateKey(storageKey: string): `0x${string}` {
  const storage = getStorage();
  if (!storage) {
    throw new Error('Embedded smart account requires browser storage');
  }

  const existing = storage.getItem(storageKey);
  if (existing && /^0x[0-9a-fA-F]{64}$/.test(existing)) {
    return existing as `0x${string}`;
  }

  const pk = generatePrivateKey();
  storage.setItem(storageKey, pk);
  return pk;
}

/**
 * Embedded AA provider:
 * - creates/loads an in-app EOA key (stored in localStorage)
 * - uses it as the owner signer for an ERC-4337 Modular Account
 * - returns the counterfactual smart account address
 *
 * This avoids MetaMask while still producing an AA smart account.
 */
export async function getEmbeddedSmartAccountAddress(params: {
  apiKey: string;
  userId: string;
}): Promise<string> {
  const pkStorageKey = `bv:embeddedSigner:${params.userId}`;
  const privateKey = getOrCreateEmbeddedPrivateKey(pkStorageKey);
  const account = privateKeyToAccount(privateKey);

  const rpcUrl = `https://eth-sepolia.g.alchemy.com/v2/${params.apiKey}`;
  const walletClient = createWalletClient({
    account,
    chain: sepolia as any,
    transport: http(rpcUrl),
  });

  const signer = new WalletClientSigner(walletClient as any, 'embedded');
  const client = await createModularAccountAlchemyClient({
    apiKey: params.apiKey,
    chain: sepolia as any,
    signer,
  } as any);

  return (client as any).getAddress();
}

