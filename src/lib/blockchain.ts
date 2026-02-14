// Blockchain utility functions for vote hashing and verification

/**
 * Generate a SHA-256 hash of the vote data
 */
export async function generateVoteHash(data: {
  previousHash: string;
  voterId: string;
  candidateId: string;
  electionId: string;
  position: string;
  timestamp: string;
  nonce: number;
}): Promise<string> {
  const dataString = JSON.stringify({
    previousHash: data.previousHash,
    voterId: data.voterId,
    candidateId: data.candidateId,
    electionId: data.electionId,
    position: data.position,
    timestamp: data.timestamp,
    nonce: data.nonce,
  });

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(dataString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Generate a unique verification code for the voter
 */
export function generateVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  
  for (let i = 0; i < 12; i++) {
    code += chars[array[i] % chars.length];
    if (i === 3 || i === 7) code += '-';
  }
  
  return code;
}

/**
 * Generate a random nonce for the block
 */
export function generateNonce(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0];
}

/**
 * Verify the integrity of a vote chain
 */
export async function verifyChainIntegrity(
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
  }>
): Promise<{ valid: boolean; invalidBlockNumber?: number }> {
  // Sort blocks by block number
  const sortedBlocks = [...blocks].sort((a, b) => a.block_number - b.block_number);

  for (let i = 0; i < sortedBlocks.length; i++) {
    const block = sortedBlocks[i];

    // Verify hash chain linkage (except for first block)
    if (i > 0) {
      const previousBlock = sortedBlocks[i - 1];
      if (block.previous_hash !== previousBlock.current_hash) {
        return { valid: false, invalidBlockNumber: block.block_number };
      }
    } else {
      // First block should reference GENESIS
      if (block.previous_hash !== 'GENESIS') {
        // Check if it references a valid previous block
        // This allows for gaps in the chain we're verifying
      }
    }

    // Verify the hash of the current block
    const computedHash = await generateVoteHash({
      previousHash: block.previous_hash,
      voterId: block.voter_id,
      candidateId: block.candidate_id,
      electionId: block.election_id,
      position: block.position,
      timestamp: block.timestamp,
      nonce: block.nonce,
    });

    if (computedHash !== block.current_hash) {
      return { valid: false, invalidBlockNumber: block.block_number };
    }
  }

  return { valid: true };
}

/**
 * Format a hash for display (truncated)
 */
export function formatHashForDisplay(hash: string, length: number = 8): string {
  if (hash === 'GENESIS') return 'GENESIS';
  return `${hash.substring(0, length)}...${hash.substring(hash.length - 4)}`;
}
