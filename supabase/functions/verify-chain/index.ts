import { Hono } from "https://deno.land/x/hono@v3.12.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { 
  verifyBatch, 
  generateMerkleRoot, 
  checkRustServiceHealth,
  isRustServiceConfigured 
} from "../_shared/rust-client.ts";

const app = new Hono();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Handle preflight
app.options("*", (c) => new Response(null, { headers: corsHeaders }));

/**
 * Verify entire chain integrity for an election
 * GET /verify-chain/:electionId
 */
app.get("/:electionId", async (c) => {
  try {
    const electionId = c.req.param("electionId");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    // Fetch all blocks for the election
    const { data: blocks, error } = await supabase
      .from("vote_chain")
      .select("block_number, previous_hash, current_hash, voter_id, candidate_id, election_id, position, timestamp, nonce")
      .eq("election_id", electionId)
      .order("block_number", { ascending: true });

    if (error) {
      console.error("Database error:", error);
      return c.json({ error: "Failed to fetch chain data" }, 500, corsHeaders);
    }

    if (!blocks || blocks.length === 0) {
      return c.json({
        valid: true,
        message: "No votes recorded yet",
        blockCount: 0,
        source: "none",
      }, 200, corsHeaders);
    }
    
    // Verify using Rust service (with TypeScript fallback)
    const result = await verifyBatch({ blocks });

    return c.json({
      valid: result.valid,
      blockCount: blocks.length,
      verifiedCount: result.verifiedCount,
      invalidBlocks: result.invalidBlocks,
      processingTimeMs: result.processingTimeMs,
      source: result.source,
      message: result.valid 
        ? "Chain integrity verified successfully" 
        : `Chain integrity compromised at block(s): ${result.invalidBlocks.join(", ")}`,
    }, 200, corsHeaders);
  } catch (error) {
    console.error("Verification error:", error);
    return c.json({ error: "Internal server error" }, 500, corsHeaders);
  }
});

/**
 * Generate Merkle root for audit purposes
 * GET /verify-chain/:electionId/merkle
 */
app.get("/:electionId/merkle", async (c) => {
  try {
    const electionId = c.req.param("electionId");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    // Fetch all hashes for the election
    const { data: blocks, error } = await supabase
      .from("vote_chain")
      .select("current_hash")
      .eq("election_id", electionId)
      .order("block_number", { ascending: true });

    if (error) {
      console.error("Database error:", error);
      return c.json({ error: "Failed to fetch chain data" }, 500, corsHeaders);
    }

    if (!blocks || blocks.length === 0) {
      return c.json({
        root: "",
        leafCount: 0,
        message: "No votes recorded yet",
      }, 200, corsHeaders);
    }

    const hashes = blocks.map(b => b.current_hash);
    const result = await generateMerkleRoot({ hashes });

    return c.json({
      root: result.root,
      leafCount: result.leafCount,
      proofLength: result.proof.length,
      source: result.source,
    }, 200, corsHeaders);
  } catch (error) {
    console.error("Merkle generation error:", error);
    return c.json({ error: "Internal server error" }, 500, corsHeaders);
  }
});

/**
 * Health check and status endpoint
 * GET /verify-chain/status
 */
app.get("/status", async (c) => {
  const rustHealth = await checkRustServiceHealth();

  return c.json({
    rustServiceConfigured: isRustServiceConfigured(),
    rustServiceAvailable: rustHealth.available,
    rustLatencyMs: rustHealth.latencyMs,
    fallbackAvailable: true,
    message: rustHealth.available 
      ? "Rust crypto service is operational" 
      : "Using TypeScript fallback for crypto operations",
  }, 200, corsHeaders);
});

Deno.serve(app.fetch);
