import { Hono } from "https://deno.land/x/hono@v3.12.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { generateHash, type HashRequest } from "../_shared/rust-client.ts";

const app = new Hono();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Handle preflight
app.options("*", (c) => new Response(null, { headers: corsHeaders }));

// Cast vote endpoint
app.post("/", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getUser(token);
    if (authError || !claims?.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userId = claims.user.id;
    const { candidateId, electionId, position } = await c.req.json();

    if (!candidateId || !electionId || !position) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Check if already voted for this position
    const { data: existingVote } = await supabase
      .from("vote_chain")
      .select("id")
      .eq("voter_id", userId)
      .eq("election_id", electionId)
      .eq("position", position)
      .maybeSingle();

    if (existingVote) {
      return c.json({ error: "Already voted for this position" }, 400);
    }

    // Get latest block hash
    const { data: latestHash } = await supabase.rpc("get_latest_block_hash", {
      p_election_id: electionId,
    });

    const previousHash = latestHash || "GENESIS";

    // Get next block number
    const { data: blockNumber } = await supabase.rpc("get_next_block_number", {
      p_election_id: electionId,
    });

    const timestamp = new Date().toISOString();
    const verificationCode = generateVerificationCode();

    // Generate hash using Rust service (with TypeScript fallback)
    const hashRequest: HashRequest = {
      previousHash,
      voterId: userId,
      candidateId,
      electionId,
      position,
      timestamp,
    };

    const { hash: currentHash, nonce, source } = await generateHash(hashRequest);
    
    console.log(`Hash generated via: ${source}`);

    // Insert vote
    const { error: insertError } = await supabase.from("vote_chain").insert({
      block_number: blockNumber || 1,
      previous_hash: previousHash,
      current_hash: currentHash,
      voter_id: userId,
      candidate_id: candidateId,
      election_id: electionId,
      position,
      timestamp,
      nonce,
      verification_code: verificationCode,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return c.json({ error: "Failed to record vote" }, 500);
    }

    // Update voter registry
    await supabase.from("voter_registry").upsert({
      voter_id: userId,
      election_id: electionId,
      has_voted: true,
      voted_at: timestamp,
    });

    return c.json({ 
      success: true, 
      verificationCode,
      cryptoSource: source 
    }, 200, corsHeaders);
  } catch (error) {
    console.error("Vote error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Verify vote endpoint
app.get("/verify/:code", async (c) => {
  try {
    const code = c.req.param("code");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: vote, error } = await supabase
      .from("vote_chain")
      .select("block_number, position, timestamp, current_hash")
      .eq("verification_code", code)
      .maybeSingle();

    if (error || !vote) {
      return c.json({ verified: false, message: "Vote not found" }, 404, corsHeaders);
    }

    return c.json({
      verified: true,
      block: {
        blockNumber: vote.block_number,
        position: vote.position,
        timestamp: vote.timestamp,
        hash: vote.current_hash.substring(0, 16) + "...",
      },
    }, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

function generateVerificationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  for (let i = 0; i < 12; i++) {
    code += chars[array[i] % chars.length];
    if (i === 3 || i === 7) code += "-";
  }
  return code;
}

Deno.serve(app.fetch);
