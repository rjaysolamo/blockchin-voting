//! Cryptographic operations

use sha2::{Sha256, Digest};
use rand::Rng;
use rayon::prelude::*;

use crate::models::VoteBlock;

/// Generate SHA-256 hash for vote data
pub fn generate_vote_hash(
    previous_hash: &str,
    voter_id: &str,
    candidate_id: &str,
    election_id: &str,
    position: &str,
    timestamp: &str,
    nonce: u32,
) -> String {
    // Create JSON-like string matching TypeScript implementation
    let data = format!(
        r#"{{"previousHash":"{}","voterId":"{}","candidateId":"{}","electionId":"{}","position":"{}","timestamp":"{}","nonce":{}}}"#,
        previous_hash, voter_id, candidate_id, election_id, position, timestamp, nonce
    );

    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}

/// Generate cryptographically secure nonce
pub fn generate_nonce() -> u32 {
    let mut rng = rand::thread_rng();
    rng.gen()
}

/// Verify a single block's hash
pub fn verify_block_hash(block: &VoteBlock) -> bool {
    let computed_hash = generate_vote_hash(
        &block.previous_hash,
        &block.voter_id,
        &block.candidate_id,
        &block.election_id,
        &block.position,
        &block.timestamp,
        block.nonce as u32,
    );
    
    computed_hash == block.current_hash
}

/// Verify chain integrity in parallel using Rayon
pub fn verify_chain_parallel(blocks: &[VoteBlock]) -> (bool, Vec<i64>) {
    if blocks.is_empty() {
        return (true, vec![]);
    }

    // Sort by block number
    let mut sorted_blocks: Vec<&VoteBlock> = blocks.iter().collect();
    sorted_blocks.sort_by_key(|b| b.block_number);

    // Parallel hash verification
    let hash_results: Vec<(i64, bool)> = sorted_blocks
        .par_iter()
        .map(|block| (block.block_number, verify_block_hash(block)))
        .collect();

    // Sequential chain linkage verification (must be sequential)
    let mut invalid_blocks: Vec<i64> = vec![];
    
    for i in 0..sorted_blocks.len() {
        // Check hash validity
        if !hash_results[i].1 {
            invalid_blocks.push(sorted_blocks[i].block_number);
            continue;
        }

        // Check chain linkage (except for first block)
        if i > 0 {
            let prev_block = sorted_blocks[i - 1];
            let curr_block = sorted_blocks[i];
            
            if curr_block.previous_hash != prev_block.current_hash {
                invalid_blocks.push(curr_block.block_number);
            }
        }
    }

    (invalid_blocks.is_empty(), invalid_blocks)
}

/// Generate Merkle root from list of hashes
pub fn generate_merkle_root(hashes: &[String]) -> (String, Vec<String>) {
    if hashes.is_empty() {
        return (String::new(), vec![]);
    }

    if hashes.len() == 1 {
        return (hashes[0].clone(), vec![]);
    }

    let mut level: Vec<String> = hashes.to_vec();
    let mut proof: Vec<String> = vec![];

    while level.len() > 1 {
        proof.push(level[0].clone());

        let next_level: Vec<String> = level
            .par_chunks(2)
            .map(|pair| {
                let left = &pair[0];
                let right = pair.get(1).unwrap_or(left);
                
                let combined = format!("{}{}", left, right);
                let mut hasher = Sha256::new();
                hasher.update(combined.as_bytes());
                hex::encode(hasher.finalize())
            })
            .collect();

        level = next_level;
    }

    (level[0].clone(), proof)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_generation() {
        let hash = generate_vote_hash(
            "GENESIS",
            "voter123",
            "candidate456",
            "election789",
            "President",
            "2026-01-20T12:00:00.000Z",
            12345,
        );
        
        assert_eq!(hash.len(), 64);
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_nonce_generation() {
        let nonce1 = generate_nonce();
        let nonce2 = generate_nonce();
        
        // Should be different (extremely unlikely to be same)
        assert_ne!(nonce1, nonce2);
    }

    #[test]
    fn test_merkle_root_single() {
        let hashes = vec!["abc123".to_string()];
        let (root, proof) = generate_merkle_root(&hashes);
        
        assert_eq!(root, "abc123");
        assert!(proof.is_empty());
    }

    #[test]
    fn test_merkle_root_multiple() {
        let hashes = vec![
            "hash1".to_string(),
            "hash2".to_string(),
            "hash3".to_string(),
        ];
        let (root, _proof) = generate_merkle_root(&hashes);
        
        assert_eq!(root.len(), 64);
    }
}
