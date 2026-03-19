import { Hono } from "https://deno.land/x/hono@v3.12.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  parseAbi,
  recoverMessageAddress,
  toHex,
  type Hex,
} from "https://esm.sh/viem@2.46.2";
import { privateKeyToAccount } from "https://esm.sh/viem@2.46.2/accounts";
import { base, baseSepolia, sepolia } from "https://esm.sh/viem@2.46.2/chains";

const app = new Hono();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const CONTRACT_ABI = parseAbi([
  "event ElectionCreated(uint256 indexed electionId, string title, uint256 startDate, uint256 endDate)",
  "event CandidateRegistered(uint256 indexed candidateId, uint256 indexed electionId, string name, uint8 position)",
  "function createElection(string _title, uint256 _startDate, uint256 _endDate) returns (uint256)",
  "function registerCandidate(uint256 _electionId, string _name, uint8 _position) returns (uint256)",
]);

type ChainName = "baseSepolia" | "base" | "sepolia";

type SyncAction = "create-election" | "create-candidate" | "create-candidate-direct";

type SyncRequest = {
  action: SyncAction;
  electionId?: string;
  candidateId?: string;
  candidateName?: string;
  candidatePosition?: string;
  candidateDepartment?: string | null;
  candidateYearLevel?: string | null;
  candidateManifesto?: string | null;
  candidatePhotoUrl?: string | null;
  signedMessage?: string;
  walletSignature?: string;
  adminWallet?: string;
};

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

function mapPositionToOnchainIndex(position: string): number {
  const normalized = position
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const map: Record<string, number> = {
    president: 0,
    vice_president: 1,
    secretary: 2,
    treasurer: 3,
    auditor: 4,
    pro_communications: 5,
    business_manager_finance_officer: 6,
    academic_affairs_officer: 7,
    student_welfare_officer: 8,
    year_level_department_representative: 9,
  };

  const index = map[normalized];
  if (index === undefined) {
    throw new Error(
      `Unsupported position "${position}". Add mapping in onchain-admin-sync before creating this candidate on-chain.`
    );
  }

  return index;
}

function toUnixSeconds(isoDate: string): bigint {
  const ms = Date.parse(isoDate);
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid datetime: ${isoDate}`);
  }
  return BigInt(Math.floor(ms / 1000));
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

async function assertAdminRole(serviceClient: ReturnType<typeof createClient>, userId: string): Promise<void> {
  const { data, error } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Only admin users can run on-chain sync");
}

async function authorizeAdmin(
  body: SyncRequest,
  authHeader: string | undefined,
  supabaseUrl: string,
  anonKey: string,
  serviceClient: ReturnType<typeof createClient>,
  expectedAdminWallet: string
): Promise<void> {
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const userId = await getAuthenticatedUserId(authHeader, supabaseUrl, anonKey);
      await assertAdminRole(serviceClient, userId);
      return;
    } catch {
      // Fall through to wallet-signature authorization.
    }
  }

  const signedMessage = body.signedMessage?.trim();
  const walletSignature = body.walletSignature?.trim();
  const adminWallet = body.adminWallet?.trim().toLowerCase();
  const normalizedExpected = expectedAdminWallet.trim().toLowerCase();

  if (!signedMessage || !walletSignature || !adminWallet) {
    throw new Error("Unauthorized: missing wallet signature payload");
  }
  if (adminWallet !== normalizedExpected) {
    throw new Error("Unauthorized: wallet does not match configured admin wallet");
  }

  let recovered: string | null = null;

  try {
    recovered = await recoverMessageAddress({
      message: signedMessage,
      signature: walletSignature as Hex,
    });
  } catch {
    recovered = null;
  }

  if (!recovered || recovered.toLowerCase() !== normalizedExpected) {
    try {
      recovered = await recoverMessageAddress({
        message: { raw: toHex(signedMessage) },
        signature: walletSignature as Hex,
      });
    } catch {
      recovered = null;
    }
  }

  if (!recovered || recovered.toLowerCase() !== normalizedExpected) {
    throw new Error("Unauthorized: invalid wallet signature");
  }
}

function extractIndexedUintFromLog(logs: readonly { data: Hex; topics: readonly Hex[] }[], eventName: "ElectionCreated" | "CandidateRegistered"): bigint | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: CONTRACT_ABI, data: log.data, topics: log.topics as [Hex, ...Hex[]] });
      if (decoded.eventName !== eventName) continue;
      if (eventName === "ElectionCreated") {
        const value = (decoded.args as { electionId?: bigint }).electionId;
        if (typeof value === "bigint") return value;
      }
      if (eventName === "CandidateRegistered") {
        const value = (decoded.args as { candidateId?: bigint }).candidateId;
        if (typeof value === "bigint") return value;
      }
    } catch {
      // Ignore unrelated logs.
    }
  }

  return null;
}

app.options("*", () => new Response("ok", { status: 200, headers: corsHeaders }));

app.post("*", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");

    const body = (await c.req.json().catch(() => ({}))) as SyncRequest;
    if (!body.action || (body.action !== "create-election" && body.action !== "create-candidate" && body.action !== "create-candidate-direct")) {
      return c.json({ error: "Invalid action" }, 400, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const rpcUrl = Deno.env.get("ONCHAIN_RPC_URL") || "";
    const privateKeyRaw = Deno.env.get("ONCHAIN_ADMIN_PRIVATE_KEY") || "";
    const adminWalletRaw = Deno.env.get("ONCHAIN_ADMIN_WALLET") || "";
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

    const chainName: ChainName = chainNameRaw === "base" || chainNameRaw === "sepolia" ? chainNameRaw : "baseSepolia";
    const chain = getChain(chainName);

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const account = privateKeyToAccount(normalizeHexPrivateKey(privateKeyRaw));
    const expectedAdminWallet = adminWalletRaw.trim() || account.address;
    const contractAddress = validateAddress(contractAddressRaw, "ONCHAIN_CONTRACT_ADDRESS");

    await authorizeAdmin(
      body,
      authHeader,
      supabaseUrl,
      anonKey,
      serviceClient,
      expectedAdminWallet
    );

    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

    if (body.action === "create-election") {
      if (!body.electionId) {
        return c.json({ error: "Missing electionId" }, 400, corsHeaders);
      }

      const { data: election, error: electionError } = await serviceClient
        .from("elections")
        .select("id, title, start_date, end_date")
        .eq("id", body.electionId)
        .maybeSingle();

      if (electionError) return c.json({ error: electionError.message }, 500, corsHeaders);
      if (!election) return c.json({ error: "Election not found" }, 404, corsHeaders);

      const { data: existingMap } = await serviceClient
        .from("onchain_entity_map")
        .select("onchain_id")
        .eq("entity_type", "election")
        .eq("offchain_id", election.id)
        .eq("chain", chainName)
        .maybeSingle();

      if (existingMap?.onchain_id !== undefined && existingMap?.onchain_id !== null) {
        return c.json(
          {
            success: true,
            chain: chainName,
            electionId: election.id,
            onchainElectionId: String(existingMap.onchain_id),
            txHash: null,
            alreadyMapped: true,
          },
          200,
          corsHeaders
        );
      }

      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: "createElection",
        args: [election.title, toUnixSeconds(election.start_date), toUnixSeconds(election.end_date)],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const onchainElectionId = extractIndexedUintFromLog(receipt.logs as readonly { data: Hex; topics: readonly Hex[] }[], "ElectionCreated");
      if (onchainElectionId === null) {
        return c.json({ error: "ElectionCreated event not found in receipt" }, 500, corsHeaders);
      }

      const { error: upsertError } = await serviceClient.from("onchain_entity_map").upsert({
        entity_type: "election",
        offchain_id: election.id,
        onchain_id: onchainElectionId.toString(),
        chain: chainName,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) return c.json({ error: upsertError.message }, 500, corsHeaders);

      return c.json(
        {
          success: true,
          chain: chainName,
          electionId: election.id,
          onchainElectionId: onchainElectionId.toString(),
          txHash,
          alreadyMapped: false,
        },
        200,
        corsHeaders
      );
    }

    if (body.action === "create-candidate-direct") {
      if (!body.electionId || !body.candidateName || !body.candidatePosition) {
        return c.json({ error: "Missing electionId, candidateName, or candidatePosition" }, 400, corsHeaders);
      }

      const { data: insertedCandidate, error: insertError } = await serviceClient
        .from("candidates")
        .insert({
          election_id: body.electionId,
          name: body.candidateName,
          position: body.candidatePosition,
          department: body.candidateDepartment ?? null,
          year_level: body.candidateYearLevel ?? null,
          manifesto: body.candidateManifesto ?? null,
          photo_url: body.candidatePhotoUrl ?? null,
        })
        .select("id, election_id, name, position")
        .single();

      if (insertError || !insertedCandidate) {
        return c.json({ error: insertError?.message || "Failed to create candidate" }, 500, corsHeaders);
      }

      const { data: electionMap, error: electionMapError } = await serviceClient
        .from("onchain_entity_map")
        .select("onchain_id")
        .eq("entity_type", "election")
        .eq("offchain_id", insertedCandidate.election_id)
        .eq("chain", chainName)
        .maybeSingle();

      if (electionMapError || !electionMap?.onchain_id) {
        await serviceClient.from("candidates").delete().eq("id", insertedCandidate.id);
        return c.json({ error: electionMapError?.message || "Election mapping missing. Sync election on-chain first." }, 400, corsHeaders);
      }

      const onchainElectionId = BigInt(electionMap.onchain_id);
      const positionIndex = mapPositionToOnchainIndex(insertedCandidate.position);

      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: "registerCandidate",
        args: [onchainElectionId, insertedCandidate.name, positionIndex],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const onchainCandidateId = extractIndexedUintFromLog(receipt.logs as readonly { data: Hex; topics: readonly Hex[] }[], "CandidateRegistered");
      if (onchainCandidateId === null) {
        await serviceClient.from("candidates").delete().eq("id", insertedCandidate.id);
        return c.json({ error: "CandidateRegistered event not found in receipt" }, 500, corsHeaders);
      }

      const { error: upsertError } = await serviceClient.from("onchain_entity_map").upsert({
        entity_type: "candidate",
        offchain_id: insertedCandidate.id,
        onchain_id: onchainCandidateId.toString(),
        chain: chainName,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) {
        await serviceClient.from("candidates").delete().eq("id", insertedCandidate.id);
        return c.json({ error: upsertError.message }, 500, corsHeaders);
      }

      return c.json(
        {
          success: true,
          chain: chainName,
          candidateId: insertedCandidate.id,
          onchainElectionId: onchainElectionId.toString(),
          onchainCandidateId: onchainCandidateId.toString(),
          txHash,
          alreadyMapped: false,
        },
        200,
        corsHeaders
      );
    }

    if (!body.candidateId) {
      return c.json({ error: "Missing candidateId" }, 400, corsHeaders);
    }

    const { data: candidate, error: candidateError } = await serviceClient
      .from("candidates")
      .select("id, election_id, name, position")
      .eq("id", body.candidateId)
      .maybeSingle();

    if (candidateError) return c.json({ error: candidateError.message }, 500, corsHeaders);
    if (!candidate) return c.json({ error: "Candidate not found" }, 404, corsHeaders);

    const { data: existingCandidateMap } = await serviceClient
      .from("onchain_entity_map")
      .select("onchain_id")
      .eq("entity_type", "candidate")
      .eq("offchain_id", candidate.id)
      .eq("chain", chainName)
      .maybeSingle();

    if (existingCandidateMap?.onchain_id !== undefined && existingCandidateMap?.onchain_id !== null) {
      return c.json(
        {
          success: true,
          chain: chainName,
          candidateId: candidate.id,
          onchainCandidateId: String(existingCandidateMap.onchain_id),
          txHash: null,
          alreadyMapped: true,
        },
        200,
        corsHeaders
      );
    }

    const { data: electionMap, error: electionMapError } = await serviceClient
      .from("onchain_entity_map")
      .select("onchain_id")
      .eq("entity_type", "election")
      .eq("offchain_id", candidate.election_id)
      .eq("chain", chainName)
      .maybeSingle();

    if (electionMapError) return c.json({ error: electionMapError.message }, 500, corsHeaders);
    if (!electionMap?.onchain_id) {
      return c.json({ error: "Election mapping missing. Sync election on-chain first." }, 400, corsHeaders);
    }

    const onchainElectionId = BigInt(electionMap.onchain_id);
    const positionIndex = mapPositionToOnchainIndex(candidate.position);

    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: CONTRACT_ABI,
      functionName: "registerCandidate",
      args: [onchainElectionId, candidate.name, positionIndex],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    const onchainCandidateId = extractIndexedUintFromLog(receipt.logs as readonly { data: Hex; topics: readonly Hex[] }[], "CandidateRegistered");
    if (onchainCandidateId === null) {
      return c.json({ error: "CandidateRegistered event not found in receipt" }, 500, corsHeaders);
    }

    const { error: upsertError } = await serviceClient.from("onchain_entity_map").upsert({
      entity_type: "candidate",
      offchain_id: candidate.id,
      onchain_id: onchainCandidateId.toString(),
      chain: chainName,
      updated_at: new Date().toISOString(),
    });

    if (upsertError) return c.json({ error: upsertError.message }, 500, corsHeaders);

    return c.json(
      {
        success: true,
        chain: chainName,
        candidateId: candidate.id,
        onchainElectionId: onchainElectionId.toString(),
        onchainCandidateId: onchainCandidateId.toString(),
        txHash,
        alreadyMapped: false,
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
