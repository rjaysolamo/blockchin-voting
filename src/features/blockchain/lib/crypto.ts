// Blockchain cryptography utilities

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
 * Format a hash for display (truncated)
 */
export function formatHashForDisplay(hash: string, length: number = 8): string {
  if (hash === 'GENESIS') return 'GENESIS';
  return `${hash.substring(0, length)}...${hash.substring(hash.length - 4)}`;
}
