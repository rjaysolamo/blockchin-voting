# Deployment Guide

## 1. Prerequisites

- [Docker](https://www.docker.com/) installed
- [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/) or [Railway CLI](https://docs.railway.app/guides/cli) installed
- GitHub repository with this code

## 2. Deploy to Railway

1.  **Login to Railway**
    ```bash
    railway login
    ```

2.  **Initialize Project**
    Run this in the `docs/rust-microservice` directory:
    ```bash
    cd docs/rust-microservice
    railway init
    ```

3.  **Deploy**
    ```bash
    railway up
    ```

4.  **Get URL**
    Once deployed, Railway will provide a domain (e.g., `https://voting-crypto-production.up.railway.app`).

5.  **Set Environment Variable in Main App**
    Add `RUST_CRYPTO_URL` to your main application's environment variables (e.g., in Supabase Dashboard -> Edge Functions -> Secrets).
    ```
    RUST_CRYPTO_URL=https://your-railway-app-url.up.railway.app
    ```

## 3. Deploy to Fly.io

1.  **Login to Fly.io**
    ```bash
    fly auth login
    ```

2.  **Launch App**
    Run this in the `docs/rust-microservice` directory:
    ```bash
    cd docs/rust-microservice
    fly launch
    ```
    - Choose a unique app name (e.g., `voting-crypto-service`).
    - Select a region close to your Supabase instance.
    - It will generate a `fly.toml` file.

3.  **Deploy**
    ```bash
    fly deploy
    ```

4.  **Get URL**
    The URL will be `https://<app-name>.fly.dev`.

5.  **Set Environment Variable in Main App**
    Add `RUST_CRYPTO_URL` to your main application's environment variables.
    ```
    RUST_CRYPTO_URL=https://<app-name>.fly.dev
    ```

## 4. Local Testing with Docker

1.  **Build Image**
    ```bash
    docker build -t voting-crypto .
    ```

2.  **Run Container**
    ```bash
    docker run -p 8080:8080 voting-crypto
    ```

3.  **Test**
    ```bash
    curl http://localhost:8080/health
    ```
