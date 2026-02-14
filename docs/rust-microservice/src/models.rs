//! Request and response models

use serde::{Deserialize, Serialize};

/// Hash generation request
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HashRequest {
    pub previous_hash: String,
    pub voter_id: String,
    pub candidate_id: String,
    pub election_id: String,
    pub position: String,
    pub timestamp: String,
}

/// Hash generation response
#[derive(Debug, Serialize)]
pub struct HashResponse {
    pub hash: String,
    pub nonce: u32,
}

/// Single block for verification
#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct VoteBlock {
    pub block_number: i64,
    pub previous_hash: String,
    pub current_hash: String,
    pub voter_id: String,
    pub candidate_id: String,
    pub election_id: String,
    pub position: String,
    pub timestamp: String,
    pub nonce: i64,
}

/// Batch verification request
#[derive(Debug, Deserialize)]
pub struct VerifyBatchRequest {
    pub blocks: Vec<VoteBlock>,
}

/// Batch verification response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyBatchResponse {
    pub valid: bool,
    pub invalid_blocks: Vec<i64>,
    pub verified_count: usize,
    pub processing_time_ms: f64,
}

/// Merkle root generation request
#[derive(Debug, Deserialize)]
pub struct MerkleRootRequest {
    pub hashes: Vec<String>,
}

/// Merkle root generation response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MerkleRootResponse {
    pub root: String,
    pub proof: Vec<String>,
    pub leaf_count: usize,
}

/// Health check response
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
}
