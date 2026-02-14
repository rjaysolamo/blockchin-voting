/**
 * Rust Microservice Client for Edge Functions
 * 
 * Provides HTTP client wrapper for calling external Rust crypto service
 * with automatic retry logic and TypeScript fallback.
 */

export interface HashRequest {
  previousHash: string;
  voterId: string;
  candidateId: string;
  electionId: string;
  position: string;
  timestamp: string;
}

export interface HashResponse {
  hash: string;
  nonce: number;
}

export interface VerifyBatchRequest {
  blocks: Array<{
    block_number: number;
    previous_hash: string;
    current_hash: string;
    voter_id: string;
    candidate_id: string;
    election_id: string;
    position: string;
    timestamp: string;
    nonce: number;
  }>;
}

export interface VerifyBatchResponse {
  valid: boolean;
  invalidBlocks: number[];
  verifiedCount: number;
  processingTimeMs: number;
}

export interface MerkleRootRequest {
  hashes: string[];
}

export interface MerkleRootResponse {
  root: string;
  proof: string[];
  leafCount: number;
}

// Configuration
const RUST_SERVICE_URL = Deno.env.get("RUST_CRYPTO_URL") || "";
const REQUEST_TIMEOUT_MS = 5000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 100;

/**
 * Check if Rust service is configured and available
 */
export function isRustServiceConfigured(): boolean {
  return RUST_SERVICE_URL.length > 0;
}

/**
 * Call Rust microservice with retry logic
 */
async function callRustService<T>(
  endpoint: string,
  body: unknown,
  retries = MAX_RETRIES
): Promise<T | null> {
  if (!isRustServiceConfigured()) {
    return null;
  }

  const url = `${RUST_SERVICE_URL}${endpoint}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Rust service error: ${response.status}`);
        if (attempt < retries) {
          await delay(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        return null;
      }

      return await response.json() as T;
    } catch (error) {
      console.error(`Rust service call failed (attempt ${attempt + 1}):`, error);
      if (attempt < retries) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      return null;
    }
  }

  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============= TypeScript Fallback Implementations =============

/**
 * Generate SHA-256 hash using Web Crypto API (fallback)
 */
async function generateHashFallback(data: HashRequest): Promise<HashResponse> {
  const nonce = generateNonceFallback();
  const dataString = JSON.stringify({
    previousHash: data.previousHash,
    voterId: data.voterId,
    candidateId: data.candidateId,
    electionId: data.electionId,
    position: data.position,
    timestamp: data.timestamp,
    nonce,
  });

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(dataString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return { hash, nonce };
}

/**
 * Generate random nonce (fallback)
 */
function generateNonceFallback(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0];
}

/**
 * Verify chain integrity using TypeScript (fallback)
 */
async function verifyBatchFallback(request: VerifyBatchRequest): Promise<VerifyBatchResponse> {
  const startTime = performance.now();
  const sortedBlocks = [...request.blocks].sort((a, b) => a.block_number - b.block_number);
  const invalidBlocks: number[] = [];

  for (let i = 0; i < sortedBlocks.length; i++) {
    const block = sortedBlocks[i];

    // Verify hash chain linkage (except for first block)
    if (i > 0) {
      const previousBlock = sortedBlocks[i - 1];
      if (block.previous_hash !== previousBlock.current_hash) {
        invalidBlocks.push(block.block_number);
        continue;
      }
    }

    // Verify the hash of the current block
    const dataString = JSON.stringify({
      previousHash: block.previous_hash,
      voterId: block.voter_id,
      candidateId: block.candidate_id,
      electionId: block.election_id,
      position: block.position,
      timestamp: block.timestamp,
      nonce: block.nonce,
    });

    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(dataString)
    );
    const computedHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (computedHash !== block.current_hash) {
      invalidBlocks.push(block.block_number);
    }
  }

  return {
    valid: invalidBlocks.length === 0,
    invalidBlocks,
    verifiedCount: sortedBlocks.length,
    processingTimeMs: performance.now() - startTime,
  };
}

/**
 * Generate Merkle root (fallback - simplified)
 */
async function merkleRootFallback(request: MerkleRootRequest): Promise<MerkleRootResponse> {
  const { hashes } = request;
  
  if (hashes.length === 0) {
    return { root: "", proof: [], leafCount: 0 };
  }

  if (hashes.length === 1) {
    return { root: hashes[0], proof: [], leafCount: 1 };
  }

  let level = [...hashes];
  const proof: string[] = [];

  while (level.length > 1) {
    const nextLevel: string[] = [];
    proof.push(level[0]); // Simplified proof

    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left; // Duplicate if odd
      
      const combined = left + right;
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(combined)
      );
      const hash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      
      nextLevel.push(hash);
    }
    level = nextLevel;
  }

  return {
    root: level[0],
    proof,
    leafCount: hashes.length,
  };
}

// ============= Public API with Fallback Logic =============

/**
 * Generate vote hash - tries Rust service first, falls back to TypeScript
 */
export async function generateHash(data: HashRequest): Promise<HashResponse & { source: "rust" | "typescript" }> {
  const rustResult = await callRustService<HashResponse>("/crypto/hash", data);
  
  if (rustResult) {
    return { ...rustResult, source: "rust" };
  }

  const fallbackResult = await generateHashFallback(data);
  return { ...fallbackResult, source: "typescript" };
}

/**
 * Batch verify chain - tries Rust service first, falls back to TypeScript
 */
export async function verifyBatch(request: VerifyBatchRequest): Promise<VerifyBatchResponse & { source: "rust" | "typescript" }> {
  const rustResult = await callRustService<VerifyBatchResponse>("/crypto/verify-batch", request);
  
  if (rustResult) {
    return { ...rustResult, source: "rust" };
  }

  const fallbackResult = await verifyBatchFallback(request);
  return { ...fallbackResult, source: "typescript" };
}

/**
 * Generate Merkle root - tries Rust service first, falls back to TypeScript
 */
export async function generateMerkleRoot(request: MerkleRootRequest): Promise<MerkleRootResponse & { source: "rust" | "typescript" }> {
  const rustResult = await callRustService<MerkleRootResponse>("/crypto/merkle-root", request);
  
  if (rustResult) {
    return { ...rustResult, source: "rust" };
  }

  const fallbackResult = await merkleRootFallback(request);
  return { ...fallbackResult, source: "typescript" };
}

/**
 * Health check for Rust service
 */
export async function checkRustServiceHealth(): Promise<{ available: boolean; latencyMs: number }> {
  if (!isRustServiceConfigured()) {
    return { available: false, latencyMs: -1 };
  }

  const startTime = performance.now();
  try {
    const response = await fetch(`${RUST_SERVICE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    
    return {
      available: response.ok,
      latencyMs: performance.now() - startTime,
    };
  } catch {
    return { available: false, latencyMs: -1 };
  }
}
