//! Voting Crypto Microservice
//! 
//! High-performance cryptographic operations for blockchain voting.

mod handlers;
mod crypto;
mod models;

use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "voting_crypto_service=debug,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router
    let app = Router::new()
        .route("/health", get(handlers::health_check))
        .route("/crypto/hash", post(handlers::generate_hash))
        .route("/crypto/verify-batch", post(handlers::verify_batch))
        .route("/crypto/merkle-root", post(handlers::merkle_root))
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    // Get port from environment or default
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .expect("PORT must be a number");

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    
    tracing::info!("Voting Crypto Service starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
