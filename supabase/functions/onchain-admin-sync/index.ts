import { Hono } from "https://deno.land/x/hono@v3.12.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  keccak256,
  parseAbi,
  recoverMessageAddress,
  stringToBytes,
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
  "function getElectionCount() view returns (uint256)",
  "function elections(uint256) view returns (uint256 id, string title, uint256 startDate, uint256 endDate, bool isActive, bool isFinalized)",
  "function registerCandidate(uint256 _electionId, string _name, uint8 _position) returns (uint256)",
  "function getCandidatesByPosition(uint256 _electionId, uint8 _position) view returns ((uint256 id, uint256 electionId, string name, uint8 position, uint256 voteCount)[])",
  "function students(address) view returns (string studentId, string name, bool isRegistered, bool isActive)",
  "function studentIdToWallet(bytes32) view returns (address)",
  "function updateStudentWallet(address _oldWallet, address _newWallet)",
  "function registerStudent(string _studentId, string _name, address _wallet)",
  "function whitelistVoter(uint256 _electionId, address _wallet)",
  "function isWhitelistedVoter(uint256 electionId, address wallet) view returns (bool)",
]);

type ChainName = "baseSepolia" | "base" | "sepolia";

type SyncAction = "create-election" | "create-candidate" | "create-candidate-direct" | "whitelist-wallet";

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
  walletAddress?: string;
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

function normalizeWallet(raw: string | null | undefined): string {
  return (raw || "").trim().toLowerCase();
}

function getErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;

  const maybeObject = error as {
    shortMessage?: unknown;
    details?: unknown;
    message?: unknown;
    cause?: unknown;
  };

  if (typeof maybeObject.shortMessage === "string" && maybeObject.shortMessage.trim()) {
    return maybeObject.shortMessage;
  }
  if (typeof maybeObject.details === "string" && maybeObject.details.trim()) {
    return maybeObject.details;
  }
  if (typeof maybeObject.message === "string" && maybeObject.message.trim()) {
    return maybeObject.message;
  }
  if (maybeObject.cause) {
    return getErrorMessage(maybeObject.cause);
  }

  return String(error);
}

function normalizeTitle(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeCandidateName(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

async function resolveCandidateIdByName(
  publicClient: ReturnType<typeof createPublicClient>,
  contractAddress: Hex,
  onchainElectionId: bigint,
  positionIndex: number,
  candidateName: string
): Promise<bigint | null> {
  let rows: Array<{ id: bigint; name: string }> = [];
  try {
    rows = await publicClient.readContract({
      address: contractAddress,
      abi: CONTRACT_ABI,
      functionName: "getCandidatesByPosition",
      args: [onchainElectionId, positionIndex],
    }) as Array<{ id: bigint; name: string }>;
  } catch {
    return null;
  }

  const normalizedTarget = normalizeCandidateName(candidateName);
  const matched = (rows || []).find((row) => normalizeCandidateName(row.name) === normalizedTarget);
  return matched?.id ?? null;
}

async function resolveCandidateIdByNameAnyPosition(
  publicClient: ReturnType<typeof createPublicClient>,
  contractAddress: Hex,
  onchainElectionId: bigint,
  candidateName: string
): Promise<bigint | null> {
  for (const index of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const found = await resolveCandidateIdByName(
      publicClient,
      contractAddress,
      onchainElectionId,
      index,
      candidateName
    );
    if (found !== null) {
      return found;
    }
  }
  return null;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function tryMapPositionToOnchainIndex(position: string): number | null {
  const normalized = position
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const map: Record<string, number> = {
    president: 0,
    vice_president: 1,
    vicepresident: 1,
    vice_pres: 1,
    secretary: 2,
    treasurer: 3,
    auditor: 4,
    pro_communications: 5,
    pro_communication: 5,
    pro: 5,
    pro_officer: 5,
    pro_communications_officer: 5,
    business_manager_finance_officer: 6,
    business_manager: 6,
    finance_officer: 6,
    business_manager_and_finance_officer: 6,
    academic_affairs_officer: 7,
    academic_affairs: 7,
    student_welfare_officer: 8,
    student_welfare: 8,
    year_level_department_representative: 9,
    year_level_representative: 9,
    department_representative: 9,
    year_department_representative: 9,
  };

  const index = map[normalized];
  return index === undefined ? null : index;
}

function toUnixSeconds(isoDate: string): bigint {
  const ms = Date.parse(isoDate);
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid datetime: ${isoDate}`);
  }
  return BigInt(Math.floor(ms / 1000));
}

async function resolveElectionIdByMetadata(
  publicClient: ReturnType<typeof createPublicClient>,
  contractAddress: Hex,
  title: string,
  startDateIso: string,
  endDateIso: string
): Promise<bigint | null> {
  const normalizedTitle = normalizeTitle(title);
  const startDate = toUnixSeconds(startDateIso);
  const endDate = toUnixSeconds(endDateIso);
  let electionCount = 0n;

  try {
    electionCount = await publicClient.readContract({
      address: contractAddress,
      abi: CONTRACT_ABI,
      functionName: "getElectionCount",
      args: [],
    }) as bigint;
  } catch {
    return null;
  }

  for (let id = electionCount; id >= 1n; id -= 1n) {
    try {
      const onchainElection = await publicClient.readContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: "elections",
        args: [id],
      }) as { title: string; startDate: bigint; endDate: bigint };

      if (
        normalizeTitle(onchainElection.title) === normalizedTitle &&
        onchainElection.startDate === startDate &&
        onchainElection.endDate === endDate
      ) {
        return id;
      }
    } catch {
      // continue scanning
    }
  }

  return null;
}

async function ensureElectionMapping(
  serviceClient: ReturnType<typeof createClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  contractAddress: Hex,
  chainName: ChainName,
  electionId: string
): Promise<bigint> {
  const { data: election, error: electionError } = await serviceClient
    .from("elections")
    .select("id, title, start_date, end_date")
    .eq("id", electionId)
    .maybeSingle();

  if (electionError) throw new Error(electionError.message);
  if (!election) throw new Error("Election not found");

  const { data: electionMap, error: electionMapError } = await serviceClient
    .from("onchain_entity_map")
    .select("onchain_id")
    .eq("entity_type", "election")
    .eq("offchain_id", election.id)
    .eq("chain", chainName)
    .maybeSingle();

  if (electionMapError) throw new Error(electionMapError.message);

  const persistElectionMap = async (onchainElectionId: bigint): Promise<void> => {
    const { error: upsertError } = await serviceClient.from("onchain_entity_map").upsert(
      {
        entity_type: "election",
        offchain_id: election.id,
        onchain_id: onchainElectionId.toString(),
        chain: chainName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "entity_type,offchain_id,chain" }
    );
    if (upsertError) throw new Error(upsertError.message);
  };

  let mappedElectionId: bigint | null = null;
  if (electionMap?.onchain_id !== undefined && electionMap?.onchain_id !== null) {
    try {
      mappedElectionId = BigInt(String(electionMap.onchain_id));
    } catch {
      mappedElectionId = null;
    }
  }

  const matchedByMetadata = await resolveElectionIdByMetadata(
    publicClient,
    contractAddress,
    election.title,
    election.start_date,
    election.end_date
  );

  if (matchedByMetadata !== null) {
    if (mappedElectionId === null || matchedByMetadata !== mappedElectionId) {
      await persistElectionMap(matchedByMetadata);
    }
    return matchedByMetadata;
  }

  if (mappedElectionId !== null) {
    return mappedElectionId;
  }

  const txHash = await walletClient.writeContract({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: "createElection",
    args: [election.title, toUnixSeconds(election.start_date), toUnixSeconds(election.end_date)],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  let createdElectionId = extractIndexedUintFromLog(
    receipt.logs as readonly { data: Hex; topics: readonly Hex[] }[],
    "ElectionCreated"
  );

  if (createdElectionId === null) {
    createdElectionId = await resolveElectionIdByMetadata(
      publicClient,
      contractAddress,
      election.title,
      election.start_date,
      election.end_date
    );
  }

  if (createdElectionId === null) {
    throw new Error("Failed to resolve on-chain election id during auto-sync");
  }

  await persistElectionMap(createdElectionId);
  return createdElectionId;
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
    if (!body.action || (body.action !== "create-election" && body.action !== "create-candidate" && body.action !== "create-candidate-direct" && body.action !== "whitelist-wallet")) {
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

      const { error: upsertError } = await serviceClient.from("onchain_entity_map").upsert(
        {
          entity_type: "election",
          offchain_id: election.id,
          onchain_id: onchainElectionId.toString(),
          chain: chainName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "entity_type,offchain_id,chain" }
      );

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

      let onchainElectionId: bigint;
      try {
        onchainElectionId = await ensureElectionMapping(
          serviceClient,
          publicClient,
          walletClient,
          contractAddress,
          chainName,
          insertedCandidate.election_id
        );
      } catch (electionSyncError) {
        await serviceClient.from("candidates").delete().eq("id", insertedCandidate.id);
        return c.json(
          { error: `Failed to resolve election mapping: ${getErrorMessage(electionSyncError)}` },
          500,
          corsHeaders
        );
      }
      const positionIndex = tryMapPositionToOnchainIndex(insertedCandidate.position);
      let txHash: Hex | null = null;
      let onchainCandidateId: bigint | null = null;

      if (positionIndex === null) {
        onchainCandidateId = await resolveCandidateIdByNameAnyPosition(
          publicClient,
          contractAddress,
          onchainElectionId,
          insertedCandidate.name
        );
        if (onchainCandidateId === null) {
          await serviceClient.from("candidates").delete().eq("id", insertedCandidate.id);
          return c.json(
            {
              error: `Unsupported position "${insertedCandidate.position}". Candidate was not found on-chain by name in any position.`,
            },
            400,
            corsHeaders
          );
        }
      } else {
        try {
          txHash = await walletClient.writeContract({
            address: contractAddress,
            abi: CONTRACT_ABI,
            functionName: "registerCandidate",
            args: [onchainElectionId, insertedCandidate.name, positionIndex],
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          onchainCandidateId = extractIndexedUintFromLog(
            receipt.logs as readonly { data: Hex; topics: readonly Hex[] }[],
            "CandidateRegistered"
          );
          if (onchainCandidateId === null) {
            onchainCandidateId = await resolveCandidateIdByName(
              publicClient,
              contractAddress,
              onchainElectionId,
              positionIndex,
              insertedCandidate.name
            );
          }
          if (onchainCandidateId === null) {
            onchainCandidateId = await resolveCandidateIdByNameAnyPosition(
              publicClient,
              contractAddress,
              onchainElectionId,
              insertedCandidate.name
            );
          }
        } catch (registerError) {
          onchainCandidateId = await resolveCandidateIdByName(
            publicClient,
            contractAddress,
            onchainElectionId,
            positionIndex,
            insertedCandidate.name
          );
          if (onchainCandidateId === null) {
            onchainCandidateId = await resolveCandidateIdByNameAnyPosition(
              publicClient,
              contractAddress,
              onchainElectionId,
              insertedCandidate.name
            );
          }
          if (onchainCandidateId === null) {
            await serviceClient.from("candidates").delete().eq("id", insertedCandidate.id);
            return c.json(
              { error: `Failed to register candidate on-chain: ${getErrorMessage(registerError)}` },
              500,
              corsHeaders
            );
          }
        }
      }

      if (onchainCandidateId === null) {
        await serviceClient.from("candidates").delete().eq("id", insertedCandidate.id);
        return c.json({ error: "CandidateRegistered event not found in receipt" }, 500, corsHeaders);
      }

      const { error: upsertError } = await serviceClient.from("onchain_entity_map").upsert(
        {
          entity_type: "candidate",
          offchain_id: insertedCandidate.id,
          onchain_id: onchainCandidateId.toString(),
          chain: chainName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "entity_type,offchain_id,chain" }
      );

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
          alreadyMapped: txHash === null,
        },
        200,
        corsHeaders
      );
    }

    if (body.action === "whitelist-wallet") {
      if (!body.electionId || !body.walletAddress) {
        return c.json({ error: "Missing electionId or walletAddress" }, 400, corsHeaders);
      }
      const normalizedWallet = validateAddress(body.walletAddress, "walletAddress");

      const { data: profileRows, error: profileError } = await serviceClient
        .from("profiles")
        .select("user_id, wallet_address")
        .not("wallet_address", "is", null)
        .limit(5000);

      if (profileError) return c.json({ error: profileError.message }, 500, corsHeaders);
      const profile =
        (profileRows || []).find((row) => normalizeWallet(row.wallet_address) === normalizeWallet(normalizedWallet)) ||
        null;
      let resolvedUserId = profile?.user_id || null;
      if (!resolvedUserId) {
        const { data: registryRowsWithChain, error: registryError } = await serviceClient
          .from("onchain_student_registry")
          .select("user_id, wallet_address")
          .not("wallet_address", "is", null)
          .eq("chain", chainName)
          .limit(5000);
        if (registryError) return c.json({ error: registryError.message }, 500, corsHeaders);
        const registryWithChain =
          (registryRowsWithChain || []).find(
            (row) => normalizeWallet(row.wallet_address) === normalizeWallet(normalizedWallet)
          ) || null;
        resolvedUserId = registryWithChain?.user_id || null;
      }

      if (!resolvedUserId) {
        const { data: registryRowsAnyChain, error: registryAnyChainError } = await serviceClient
          .from("onchain_student_registry")
          .select("user_id, wallet_address")
          .not("wallet_address", "is", null)
          .limit(5000);
        if (registryAnyChainError) return c.json({ error: registryAnyChainError.message }, 500, corsHeaders);
        const registryAnyChain =
          (registryRowsAnyChain || []).find(
            (row) => normalizeWallet(row.wallet_address) === normalizeWallet(normalizedWallet)
          ) || null;
        resolvedUserId = registryAnyChain?.user_id || null;
      }

      if (!resolvedUserId) {
        return c.json(
          { error: "Wallet address is not linked to any student profile. Ask student to register/sign in first." },
          400,
          corsHeaders
        );
      }

      const { data: userProfile, error: userProfileError } = await serviceClient
        .from("profiles")
        .select("full_name, student_id, wallet_address")
        .eq("user_id", resolvedUserId)
        .maybeSingle();
      if (userProfileError) return c.json({ error: userProfileError.message }, 500, corsHeaders);

      const profileName = (userProfile?.full_name || "").trim();
      const profileStudentId = (userProfile?.student_id || "").trim();

      const { data: electionMap, error: electionMapError } = await serviceClient
        .from("onchain_entity_map")
        .select("onchain_id")
        .eq("entity_type", "election")
        .eq("offchain_id", body.electionId)
        .eq("chain", chainName)
        .maybeSingle();

      if (electionMapError) return c.json({ error: electionMapError.message }, 500, corsHeaders);
      if (!electionMap?.onchain_id) {
        return c.json({ error: "Election mapping missing. Sync election on-chain first." }, 400, corsHeaders);
      }

      const ensureStudentRegisteredOnChain = async (): Promise<void> => {
        let isRegisteredOnchain = false;
        try {
          const studentInfo = await publicClient.readContract({
            address: contractAddress,
            abi: CONTRACT_ABI,
            functionName: "students",
            args: [normalizedWallet],
          });
          const maybeStudent = studentInfo as { isRegistered?: boolean } | readonly unknown[];
          isRegisteredOnchain = Array.isArray(maybeStudent)
            ? Boolean(maybeStudent[2])
            : Boolean(maybeStudent?.isRegistered);
        } catch {
          isRegisteredOnchain = false;
        }

        if (isRegisteredOnchain) return;

        if (!profileName || !profileStudentId) {
          throw new Error(
            "Student is not registered on-chain and profile is missing full_name or student_id. Update student profile first."
          );
        }

        try {
          const registerTxHash = await walletClient.writeContract({
            address: contractAddress,
            abi: CONTRACT_ABI,
            functionName: "registerStudent",
            args: [profileStudentId, profileName, normalizedWallet],
          });
          await publicClient.waitForTransactionReceipt({ hash: registerTxHash });

          await serviceClient.from("onchain_student_registry").upsert({
            user_id: resolvedUserId,
            wallet_address: normalizedWallet,
            student_id: profileStudentId,
            chain: chainName,
            is_registered: true,
            registration_tx_hash: registerTxHash,
            last_error: null,
            updated_at: new Date().toISOString(),
          });
        } catch (error) {
          const message = getErrorMessage(error).toLowerCase();
          if (message.includes("already") && message.includes("registered")) {
            await serviceClient.from("onchain_student_registry").upsert({
              user_id: resolvedUserId,
              wallet_address: normalizedWallet,
              student_id: profileStudentId || null,
              chain: chainName,
              is_registered: true,
              last_error: null,
              updated_at: new Date().toISOString(),
            });
            return;
          }
          if (message.includes("student id already used")) {
            const studentIdHash = keccak256(stringToBytes(profileStudentId));
            const oldWallet = await publicClient.readContract({
              address: contractAddress,
              abi: CONTRACT_ABI,
              functionName: "studentIdToWallet",
              args: [studentIdHash],
            });
            const oldWalletNormalized = String(oldWallet).toLowerCase();
            if (
              oldWalletNormalized &&
              oldWalletNormalized !== ZERO_ADDRESS &&
              oldWalletNormalized !== normalizedWallet
            ) {
              const migrateTxHash = await walletClient.writeContract({
                address: contractAddress,
                abi: CONTRACT_ABI,
                functionName: "updateStudentWallet",
                args: [oldWalletNormalized as Hex, normalizedWallet],
              });
              await publicClient.waitForTransactionReceipt({ hash: migrateTxHash });
            }

            await serviceClient.from("onchain_student_registry").upsert({
              user_id: resolvedUserId,
              wallet_address: normalizedWallet,
              student_id: profileStudentId || null,
              chain: chainName,
              is_registered: true,
              last_error: null,
              updated_at: new Date().toISOString(),
            });
            return;
          }
          throw error;
        }
      };

      await ensureStudentRegisteredOnChain();

      const onchainElectionId = BigInt(electionMap.onchain_id);

      let currentlyWhitelisted = false;
      try {
        currentlyWhitelisted = await publicClient.readContract({
          address: contractAddress,
          abi: CONTRACT_ABI,
          functionName: "isWhitelistedVoter",
          args: [onchainElectionId, normalizedWallet],
        });
      } catch {
        currentlyWhitelisted = false;
      }

      let txHash: Hex | null = null;
      if (!currentlyWhitelisted) {
        try {
          txHash = await walletClient.writeContract({
            address: contractAddress,
            abi: CONTRACT_ABI,
            functionName: "whitelistVoter",
            args: [onchainElectionId, normalizedWallet],
          });
          await publicClient.waitForTransactionReceipt({ hash: txHash });
        } catch (error) {
          const msg = getErrorMessage(error).toLowerCase();
          if (msg.includes("already") && msg.includes("whitelist")) {
            currentlyWhitelisted = true;
          } else if (msg.includes("not registered")) {
            await ensureStudentRegisteredOnChain();
            txHash = await walletClient.writeContract({
              address: contractAddress,
              abi: CONTRACT_ABI,
              functionName: "whitelistVoter",
              args: [onchainElectionId, normalizedWallet],
            });
            await publicClient.waitForTransactionReceipt({ hash: txHash });
          } else {
            throw error;
          }
        }
      }

      const { error: upsertWhitelistError } = await serviceClient
        .from("onchain_voter_whitelist")
        .upsert({
          user_id: resolvedUserId,
          election_id: body.electionId,
          wallet_address: normalizedWallet,
          chain: chainName,
          is_whitelisted: true,
          whitelist_tx_hash: txHash,
          last_error: null,
          updated_at: new Date().toISOString(),
        });

      if (upsertWhitelistError) return c.json({ error: upsertWhitelistError.message }, 500, corsHeaders);

      return c.json(
        {
          success: true,
          chain: chainName,
          electionId: body.electionId,
          walletAddress: normalizedWallet,
          txHash,
          alreadyWhitelisted: currentlyWhitelisted && txHash === null,
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

    let onchainElectionId: bigint;
    try {
      onchainElectionId = await ensureElectionMapping(
        serviceClient,
        publicClient,
        walletClient,
        contractAddress,
        chainName,
        candidate.election_id
      );
    } catch (electionSyncError) {
      return c.json(
        { error: `Failed to resolve election mapping: ${getErrorMessage(electionSyncError)}` },
        500,
        corsHeaders
      );
    }
    const positionIndex = tryMapPositionToOnchainIndex(candidate.position);
    let txHash: Hex | null = null;
    let onchainCandidateId: bigint | null = null;

    if (positionIndex === null) {
      onchainCandidateId = await resolveCandidateIdByNameAnyPosition(
        publicClient,
        contractAddress,
        onchainElectionId,
        candidate.name
      );
      if (onchainCandidateId === null) {
        return c.json(
          {
            error: `Unsupported position "${candidate.position}". Candidate was not found on-chain by name in any position.`,
          },
          400,
          corsHeaders
        );
      }
    } else {
      try {
        txHash = await walletClient.writeContract({
          address: contractAddress,
          abi: CONTRACT_ABI,
          functionName: "registerCandidate",
          args: [onchainElectionId, candidate.name, positionIndex],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        onchainCandidateId = extractIndexedUintFromLog(
          receipt.logs as readonly { data: Hex; topics: readonly Hex[] }[],
          "CandidateRegistered"
        );
        if (onchainCandidateId === null) {
          onchainCandidateId = await resolveCandidateIdByName(
            publicClient,
            contractAddress,
            onchainElectionId,
            positionIndex,
            candidate.name
          );
        }
        if (onchainCandidateId === null) {
          onchainCandidateId = await resolveCandidateIdByNameAnyPosition(
            publicClient,
            contractAddress,
            onchainElectionId,
            candidate.name
          );
        }
      } catch (registerError) {
        onchainCandidateId = await resolveCandidateIdByName(
          publicClient,
          contractAddress,
          onchainElectionId,
          positionIndex,
          candidate.name
        );
        if (onchainCandidateId === null) {
          onchainCandidateId = await resolveCandidateIdByNameAnyPosition(
            publicClient,
            contractAddress,
            onchainElectionId,
            candidate.name
          );
        }
        if (onchainCandidateId === null) {
          return c.json(
            { error: `Failed to register candidate on-chain: ${getErrorMessage(registerError)}` },
            500,
            corsHeaders
          );
        }
      }
    }

    if (onchainCandidateId === null) {
      return c.json({ error: "CandidateRegistered event not found in receipt and candidate could not be discovered on-chain" }, 500, corsHeaders);
    }

    const { error: upsertError } = await serviceClient.from("onchain_entity_map").upsert(
      {
        entity_type: "candidate",
        offchain_id: candidate.id,
        onchain_id: onchainCandidateId.toString(),
        chain: chainName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "entity_type,offchain_id,chain" }
    );

    if (upsertError) return c.json({ error: upsertError.message }, 500, corsHeaders);

    return c.json(
      {
        success: true,
        chain: chainName,
        candidateId: candidate.id,
        onchainElectionId: onchainElectionId.toString(),
        onchainCandidateId: onchainCandidateId.toString(),
        txHash,
        alreadyMapped: txHash === null,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const action = body?.action ? String(body.action) : "unknown";
    const candidateId = body?.candidateId ? String(body.candidateId) : null;
    const electionId = body?.electionId ? String(body.electionId) : null;
    const contextParts = [
      `action=${action}`,
      candidateId ? `candidateId=${candidateId}` : null,
      electionId ? `electionId=${electionId}` : null,
    ].filter(Boolean);
    const contextPrefix = contextParts.length > 0 ? `[${contextParts.join(" ")}] ` : "";
    const normalized = message.toLowerCase();
    const status = normalized.includes("unauthorized")
      ? 401
      : normalized.includes("invalid action") || normalized.includes("missing ")
        ? 400
        : 500;
    return c.json({ error: `${contextPrefix}${message}` }, status, corsHeaders);
  }
});

Deno.serve(app.fetch);
