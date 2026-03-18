import { createModularAccountV2Client } from '@account-kit/smart-contracts';
import { alchemy, alchemyGasManagerMiddleware } from '@account-kit/infra';
import { createCredential } from 'webauthn-p256';
import { getChainFromNetwork, getSupportedNetwork } from './chain';

type Hex = `0x${string}`;
type SmartAccountClient = Awaited<ReturnType<typeof createModularAccountV2Client>>;

const env = import.meta.env as unknown as {
  VITE_PASSKEY_RP_ID?: string;
  VITE_PASSKEY_RP_NAME?: string;
  VITE_ALCHEMY_ACCOUNT_POLICY_ID?: string;
  VITE_ALCHEMY_GAS_POLICY_ID?: string;
  PROD?: boolean;
};

function assertBrowser() {
  if (typeof window === 'undefined') {
    throw new Error('Embedded smart account requires a browser environment');
  }
}

/**
 * Store passkey metadata in IndexedDB.
 *
 * This stores only public material (credential id + public key), NOT a private key.
 * Private key material remains inside the authenticator (passkey/WebAuthn).
 */
async function idbGet(dbName: string, storeName: string, key: string): Promise<string | null> {
  assertBrowser();
  return await new Promise((resolve, reject) => {
    const openReq = window.indexedDB.open(dbName, 1);
    openReq.onupgradeneeded = () => {
      const db = openReq.result;
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
    };
    openReq.onerror = () => reject(openReq.error);
    openReq.onsuccess = () => {
      const db = openReq.result;
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const getReq = store.get(key);
      getReq.onerror = () => reject(getReq.error);
      getReq.onsuccess = () => resolve((getReq.result as string | undefined) ?? null);
    };
  });
}

async function idbSet(dbName: string, storeName: string, key: string, value: string): Promise<void> {
  assertBrowser();
  return await new Promise((resolve, reject) => {
    const openReq = window.indexedDB.open(dbName, 1);
    openReq.onupgradeneeded = () => {
      const db = openReq.result;
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
    };
    openReq.onerror = () => reject(openReq.error);
    openReq.onsuccess = () => {
      const db = openReq.result;
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const putReq = store.put(value, key);
      putReq.onerror = () => reject(putReq.error);
      putReq.onsuccess = () => resolve();
    };
  });
}

type StoredPasskey = {
  credentialId: string;
  publicKey: Hex;
};

async function getStoredPasskey(userId: string): Promise<StoredPasskey | null> {
  assertBrowser();
  const storageKey = `bv:passkey:${userId}`;
  const existing = await idbGet('bv-aa', 'passkeys', storageKey);
  if (!existing) return null;
  try {
    const parsed = JSON.parse(existing) as StoredPasskey;
    if (parsed?.credentialId && /^0x[0-9a-fA-F]+$/.test(parsed.publicKey)) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function getRpId(): string {
  assertBrowser();
  const explicit = env.VITE_PASSKEY_RP_ID?.trim();
  const inferred = window.location.hostname;

  // In production, RP ID must be explicit to avoid "it worked on preview URL" failures.
  if (import.meta.env.PROD && !explicit) {
    throw new Error('Missing VITE_PASSKEY_RP_ID (required in production for passkeys/WebAuthn).');
  }

  return explicit || inferred;
}

export async function enrollEmbeddedPasskey(params: { userId: string }): Promise<StoredPasskey> {
  assertBrowser();

  // If the device already has a credential stored, treat enrollment as idempotent.
  const existing = await getStoredPasskey(params.userId);
  if (existing) return existing;

  const rpId = getRpId();

  const rpName =
    env.VITE_PASSKEY_RP_NAME || 'Blockchain Voting';

  const credential = await createCredential({
    name: `bv:${params.userId}`,
    rp: { id: rpId, name: rpName },
    authenticatorSelection: {
      // Production-grade defaults: discoverable credential + user verification required.
      residentKey: 'required',
      userVerification: 'required',
    },
  });

  const stored: StoredPasskey = {
    credentialId: credential.id,
    publicKey: credential.publicKey as Hex,
  };
  const storageKey = `bv:passkey:${params.userId}`;
  await idbSet('bv-aa', 'passkeys', storageKey, JSON.stringify(stored));
  return stored;
}

export async function hasEmbeddedPasskey(params: { userId: string }): Promise<boolean> {
  return (await getStoredPasskey(params.userId)) !== null;
}

/**
 * Passkey-based AA provider (recommended):
 * - creates/loads a WebAuthn passkey credential (no private key in JS)
 * - uses the credential to control an ERC-4337 Modular Account V2 (WebAuthn validation)
 * - optionally attaches Alchemy Gas Manager paymaster middleware for sponsorship
 */
export async function getEmbeddedSmartAccountAddress(params: {
  apiKey: string;
  userId: string;
}): Promise<string> {
  const client = await getEmbeddedSmartAccountClient(params);
  return await client.getAddress();
}

export async function getEmbeddedSmartAccountClient(params: {
  apiKey: string;
  userId: string;
  createIfMissing?: boolean;
}) {
  // Keep `createIfMissing` for backward compatibility, but production flow should call
  // `enrollEmbeddedPasskey()` explicitly and then connect without creating.
  const createIfMissing = params.createIfMissing ?? false;
  const passkey = createIfMissing
    ? await enrollEmbeddedPasskey({ userId: params.userId })
    : await getStoredPasskey(params.userId);

  if (!passkey) {
    throw new Error(
      'No passkey enrolled for this user on this device. Enroll a passkey first to enable the smart account.'
    );
  }
  const { credentialId, publicKey } = passkey;

  const rpId = getRpId();

  const accountPolicyId = env.VITE_ALCHEMY_ACCOUNT_POLICY_ID;
  if (!accountPolicyId) {
    throw new Error('Missing VITE_ALCHEMY_ACCOUNT_POLICY_ID (Account Kit smart account policy UUID)');
  }

  const gasPolicyId = env.VITE_ALCHEMY_GAS_POLICY_ID;

  const network = getSupportedNetwork();
  const chain = getChainFromNetwork(network);
  const transport = alchemy({ apiKey: params.apiKey });
  const middlewareConfig = gasPolicyId ? alchemyGasManagerMiddleware(gasPolicyId) : undefined;

  const config: Record<string, unknown> = {
    policyId: accountPolicyId,
    mode: 'webauthn',
    credential: { id: credentialId, publicKey },
    rpId,
    chain,
    transport,
  };

  // Account Kit returns a config fragment; merge it in a controlled way.
  if (middlewareConfig && typeof middlewareConfig === 'object') {
    Object.assign(config, middlewareConfig as Record<string, unknown>);
  }

  return (await createModularAccountV2Client(
    config as unknown as Parameters<typeof createModularAccountV2Client>[0]
  )) as SmartAccountClient;
}

