import { generateVoteHash } from './crypto';

interface VoteBlock {
  block_number: number;
  previous_hash: string;
  current_hash: string;
  voter_id: string;
  candidate_id: string;
  election_id: string;
  position: string;
  timestamp: string;
  nonce: number;
}

/**
 * Verify the integrity of a vote chain
 */
export async function verifyChainIntegrity(
  blocks: VoteBlock[]
): Promise<{ valid: boolean; invalidBlockNumber?: number }> {
  const sortedBlocks = [...blocks].sort((a, b) => a.block_number - b.block_number);

  for (let i = 0; i < sortedBlocks.length; i++) {
    const block = sortedBlocks[i];

    // Verify hash chain linkage (except for first block)
    if (i > 0) {
      const previousBlock = sortedBlocks[i - 1];
      if (block.previous_hash !== previousBlock.current_hash) {
        return { valid: false, invalidBlockNumber: block.block_number };
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
