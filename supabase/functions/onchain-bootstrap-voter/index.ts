import { Hono } from "https://deno.land/x/hono@v3.12.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Hex,
} from "https://esm.sh/viem@2.46.2";
import { privateKeyToAccount } from "https://esm.sh/viem@2.46.2/accounts";
import { base, baseSepolia, sepolia } from "https://esm.sh/viem@2.46.2/chains";

const app = new Hono();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTRACT_ABI = parseAbi([
  "function students(address) view returns (string studentId, string name, bool isRegistered, bool isActive)",
  "function isWhitelistedVoter(uint256 electionId, address wallet) view returns (bool)",
  "function registerStudent(string _studentId, string _name, address _wallet)",
  "function whitelistVoter(uint256 _electionId, address _wallet)",
]);

type ChainName = "baseSepolia" | "base" | "sepolia";

function getChain(chainName: ChainName) {
  switch (chainName) {
    case "base":
      return base;
    case "sepolia":
      return sepolia;
    case "baseSepolia":
    default:
      return baseSepolia;
  }
}

function normalizeHexPrivateKey(raw: string): Hex {
  const trimmed = raw.trim();
  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Invalid ONCHAIN_ADMIN_PRIVATE_KEY format");
  }
  return normalized as Hex;
}

function validateAddress(raw: string, envName: string): Hex {
  const value = raw.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Invalid ${envName} address format`);
  }
  return value as Hex;
}

async function getAuthenticatedUserId(authHeader: string, supabaseUrl: string, anonKey: string) {
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: authError } = await userClient.auth.getUser(token);
  if (authError || !claims?.user?.id) {
    throw new Error("Unauthorized");
  }

  return claims.user.id;
}

app.options("*", () => new Response(null, { headers: corsHeaders }));

app.post("/", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const rpcUrl = Deno.env.get("ONCHAIN_RPC_URL") || "";
    const privateKeyRaw = Deno.env.get("ONCHAIN_ADMIN_PRIVATE_KEY") || "";
    const contractAddressRaw = Deno.env.get("ONCHAIN_CONTRACT_ADDRESS") || "";
    const chainNameRaw = (Deno.env.get("ONCHAIN_NETWORK") || "baseSepolia").trim() as ChainName;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return c.json({ error: "Supabase environment is not configured" }, 500, corsHeaders);
    }
    if (!rpcUrl || !privateKeyRaw || !contractAddressRaw) {
      return c.json(
        { error: "Missing ONCHAIN_RPC_URL / ONCHAIN_ADMIN_PRIVATE_KEY / ONCHAIN_CONTRACT_ADDRESS" },
        500,
        corsHeaders
      );
    }

    const userId = await getAuthenticatedUserId(authHeader, supabaseUrl, anonKey);

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userRoleRows, error: userRoleError } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "student")
      .limit(1);

    if (userRoleError) {
      return c.json({ error: userRoleError.message }, 500, corsHeaders);
    }
    if (!userRoleRows || userRoleRows.length === 0) {
      return c.json({ error: "Only student accounts can bootstrap voter status" }, 403, corsHeaders);
    }

    const { electionId } = await c.req.json().catch(() => ({}));

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("full_name, student_id, wallet_address")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      return c.json({ error: profileError.message }, 500, corsHeaders);
    }

    const fullName = (profile?.full_name || "").trim();
    const studentId = (profile?.student_id || "").trim();
    const walletAddress = (profile?.wallet_address || "").toLowerCase();

    if (!fullName || !studentId || !walletAddress) {
      return c.json({ error: "Missing profile fields (full_name, student_id, wallet_address)" }, 400, corsHeaders);
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return c.json({ error: "Invalid profile.wallet_address format" }, 400, corsHeaders);
    }

    const chainName: ChainName = chainNameRaw === "base" || chainNameRaw === "sepolia" ? chainNameRaw : "baseSepolia";
    const chain = getChain(chainName);

    const account = privateKeyToAccount(normalizeHexPrivateKey(privateKeyRaw));
    const contractAddress = validateAddress(contractAddressRaw, "ONCHAIN_CONTRACT_ADDRESS");

    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

    let registrationTxHash: Hex | null = null;
    let isRegistered = false;

    const studentInfo = await publicClient.readContract({
      address: contractAddress,
      abi: CONTRACT_ABI,
      functionName: "students",
      args: [walletAddress as Hex],
    });

    const maybeStudent = studentInfo as { isRegistered?: boolean } | readonly unknown[];
    if (Array.isArray(maybeStudent)) {
      isRegistered = Boolean(maybeStudent[2]);
    } else {
      isRegistered = Boolean(maybeStudent.isRegistered);
    }

    if (!isRegistered) {
      registrationTxHash = await walletClient.writeContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: "registerStudent",
        args: [studentId, fullName, walletAddress as Hex],
      });

      await publicClient.waitForTransactionReceipt({ hash: registrationTxHash });
      isRegistered = true;
    }

    await serviceClient.from("onchain_student_registry").upsert({
      user_id: userId,
      wallet_address: walletAddress,
      student_id: studentId,
      chain: chainName,
      is_registered: true,
      registration_tx_hash: registrationTxHash,
      last_error: null,
      updated_at: new Date().toISOString(),
    });

    let electionsQuery = serviceClient
      .from("elections")
      .select("id")
      .eq("is_active", true);

    if (electionId) {
      electionsQuery = electionsQuery.eq("id", electionId);
    }

    const { data: activeElections, error: electionError } = await electionsQuery;
    if (electionError) {
      return c.json({ error: electionError.message }, 500, corsHeaders);
    }

    const activeElectionIds = (activeElections || []).map((e) => e.id);
    if (activeElectionIds.length === 0) {
      return c.json(
        {
          success: true,
          chain: chainName,
          registrationTxHash,
          whitelist: [],
          message: "Student registration ensured. No active election to whitelist.",
        },
        200,
        corsHeaders
      );
    }

    const { data: mappings, error: mappingError } = await serviceClient
      .from("onchain_entity_map")
      .select("offchain_id, onchain_id")
      .eq("entity_type", "election")
      .eq("chain", chainName)
      .in("offchain_id", activeElectionIds);

    if (mappingError) {
      return c.json({ error: mappingError.message }, 500, corsHeaders);
    }

    const mappedByElectionId = new Map<string, bigint>();
    for (const row of mappings || []) {
      try {
        mappedByElectionId.set(row.offchain_id, BigInt(row.onchain_id));
      } catch {
        // Ignore malformed rows; they will be reported as missing mappings below.
      }
    }

    const missingMappings = activeElectionIds.filter((id) => !mappedByElectionId.has(id));
    if (missingMappings.length > 0) {
      return c.json(
        {
          error: "Missing on-chain election mapping",
          details: {
            chain: chainName,
            electionIds: missingMappings,
          },
        },
        400,
        corsHeaders
      );
    }

    const whitelistResults: Array<{ electionId: string; onchainElectionId: string; txHash: Hex | null; alreadyWhitelisted: boolean }> = [];

    for (const dbElectionId of activeElectionIds) {
      const onchainElectionId = mappedByElectionId.get(dbElectionId)!;

      const currentlyWhitelisted = await publicClient.readContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: "isWhitelistedVoter",
        args: [onchainElectionId, walletAddress as Hex],
      });

      let whitelistTxHash: Hex | null = null;
      if (!currentlyWhitelisted) {
        whitelistTxHash = await walletClient.writeContract({
          address: contractAddress,
          abi: CONTRACT_ABI,
          functionName: "whitelistVoter",
          args: [onchainElectionId, walletAddress as Hex],
        });
        await publicClient.waitForTransactionReceipt({ hash: whitelistTxHash });
      }

      await serviceClient.from("onchain_voter_whitelist").upsert({
        user_id: userId,
        election_id: dbElectionId,
        wallet_address: walletAddress,
        chain: chainName,
        is_whitelisted: true,
        whitelist_tx_hash: whitelistTxHash,
        last_error: null,
        updated_at: new Date().toISOString(),
      });

      whitelistResults.push({
        electionId: dbElectionId,
        onchainElectionId: onchainElectionId.toString(),
        txHash: whitelistTxHash,
        alreadyWhitelisted: Boolean(currentlyWhitelisted),
      });
    }

    return c.json(
      {
        success: true,
        chain: chainName,
        registrationTxHash,
        whitelist: whitelistResults,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return c.json({ error: message }, 500, corsHeaders);
  }
});

Deno.serve(app.fetch);
