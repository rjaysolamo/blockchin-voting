//! HTTP request handlers

use axum::{http::StatusCode, Json};
use std::time::Instant;

use crate::crypto;
use crate::models::{
    HashRequest, HashResponse,
    VerifyBatchRequest, VerifyBatchResponse,
    MerkleRootRequest, MerkleRootResponse,
    HealthResponse,
};

/// Health check endpoint
pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// Generate vote hash
pub async fn generate_hash(
    Json(payload): Json<HashRequest>,
) -> Result<Json<HashResponse>, StatusCode> {
    let nonce = crypto::generate_nonce();
    
    let hash = crypto::generate_vote_hash(
        &payload.previous_hash,
        &payload.voter_id,
        &payload.candidate_id,
        &payload.election_id,
        &payload.position,
        &payload.timestamp,
        nonce,
    );

    Ok(Json(HashResponse { hash, nonce }))
}

/// Batch verify chain integrity
pub async fn verify_batch(
    Json(payload): Json<VerifyBatchRequest>,
) -> Result<Json<VerifyBatchResponse>, StatusCode> {
    let start = Instant::now();
    let block_count = payload.blocks.len();
    
    let (valid, invalid_blocks) = crypto::verify_chain_parallel(&payload.blocks);
    
    let processing_time_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(Json(VerifyBatchResponse {
        valid,
        invalid_blocks,
        verified_count: block_count,
        processing_time_ms,
    }))
}

/// Generate Merkle root
pub async fn merkle_root(
    Json(payload): Json<MerkleRootRequest>,
) -> Result<Json<MerkleRootResponse>, StatusCode> {
    let leaf_count = payload.hashes.len();
    let (root, proof) = crypto::generate_merkle_root(&payload.hashes);

    Ok(Json(MerkleRootResponse {
        root,
        proof,
        leaf_count,
    }))
}
