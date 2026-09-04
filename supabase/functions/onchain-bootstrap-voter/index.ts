import { Hono } from "https://deno.land/x/hono@v3.12.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  keccak256,
  parseAbi,
  stringToBytes,
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
  "function elections(uint256) view returns (uint256 id, string title, uint256 startDate, uint256 endDate, bool isActive)",
  "function getElectionCount() view returns (uint256)",
  "function students(address) view returns (string studentId, string name, bool isRegistered, bool isActive)",
  "function studentIdToWallet(bytes32) view returns (address)",
  "function updateStudentWallet(address _oldWallet, address _newWallet)",
  "function isWhitelistedVoter(uint256 electionId, address wallet) view returns (bool)",
  "function registerCandidate(uint256 _electionId, string _name, uint8 _position) returns (uint256)",
  "function getCandidatesByPosition(uint256 _electionId, uint8 _position) view returns ((uint256 id, uint256 electionId, string name, uint8 position, uint256 voteCount)[])",
  "function registerStudent(string _studentId, string _name, address _wallet)",
  "function whitelistVoter(uint256 _electionId, address _wallet)",
]);

type ChainName = "baseSepolia" | "base" | "sepolia";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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

function mapPositionToOnchainIndex(position: string): number | null {
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
  if (index === undefined) {
    return null;
  }

  return index;
}

function extractCandidateIdFromReceipt(logs: readonly { data: Hex; topics: readonly Hex[] }[]): bigint | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: CONTRACT_ABI,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (decoded.eventName !== "CandidateRegistered") continue;
      const value = (decoded.args as { candidateId?: bigint }).candidateId;
      if (typeof value === "bigint") return value;
    } catch {
      // ignore unrelated logs
    }
  }
  return null;
}

function extractElectionIdFromReceipt(logs: readonly { data: Hex; topics: readonly Hex[] }[]): bigint | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: CONTRACT_ABI,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (decoded.eventName !== "ElectionCreated") continue;
      const value = (decoded.args as { electionId?: bigint }).electionId;
      if (typeof value === "bigint") return value;
    } catch {
      // ignore unrelated logs
    }
  }
  return null;
}

function toUnixSeconds(isoDate: string): bigint {
  const ms = Date.parse(isoDate);
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid datetime: ${isoDate}`);
  }
  return BigInt(Math.floor(ms / 1000));
}

function normalizeTitle(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
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

app.options("*", () => new Response("ok", { status: 200, headers: corsHeaders }));

app.post("*", async (c) => {
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

    const { electionId, candidateId } = await c.req.json().catch(() => ({}));

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

    const ensureStudentRegisteredOnChain = async (): Promise<void> => {
      let isRegistered = false;
      try {
        const studentInfo = await publicClient.readContract({
          address: contractAddress,
          abi: CONTRACT_ABI,
          functionName: "students",
          args: [walletAddress as Hex],
        });
        const maybeStudent = studentInfo as { isRegistered?: boolean } | readonly unknown[];
        isRegistered = Array.isArray(maybeStudent)
          ? Boolean(maybeStudent[2])
          : Boolean(maybeStudent?.isRegistered);
      } catch {
        isRegistered = false;
      }

      if (isRegistered) return;

      try {
        registrationTxHash = await walletClient.writeContract({
          address: contractAddress,
          abi: CONTRACT_ABI,
          functionName: "registerStudent",
          args: [studentId, fullName, walletAddress as Hex],
        });
        await publicClient.waitForTransactionReceipt({ hash: registrationTxHash });
      } catch (error) {
        const message = getErrorMessage(error).toLowerCase();
        if (message.includes("already") && message.includes("registered")) {
          return;
        }
        if (message.includes("student id already used")) {
          const studentIdHash = keccak256(stringToBytes(studentId));
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
            oldWalletNormalized !== walletAddress
          ) {
            const migrateTxHash = await walletClient.writeContract({
              address: contractAddress,
              abi: CONTRACT_ABI,
              functionName: "updateStudentWallet",
              args: [oldWalletNormalized as Hex, walletAddress as Hex],
            });
            await publicClient.waitForTransactionReceipt({ hash: migrateTxHash });
          }
          return;
        }
        throw error;
      }
    };

    await ensureStudentRegisteredOnChain();

    await serviceClient.from("onchain_student_registry").upsert(
      {
        user_id: userId,
        wallet_address: walletAddress,
        student_id: studentId,
        chain: chainName,
        is_registered: true,
        registration_tx_hash: registrationTxHash,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,chain" }
    );

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
      const { data: electionsMeta, error: electionsMetaError } = await serviceClient
        .from("elections")
        .select("id, title, start_date, end_date")
        .in("id", missingMappings);

      if (electionsMetaError) {
        return c.json({ error: electionsMetaError.message }, 500, corsHeaders);
      }

      for (const election of electionsMeta || []) {
        const offchainElectionId = election.id as string;
        let resolvedOnchainElectionId: bigint | null = null;

        const title = String(election.title || "").trim();
        if (!title) {
          continue;
        }

        const startDate = toUnixSeconds(String(election.start_date));
        const endDate = toUnixSeconds(String(election.end_date));

        try {
          const txHash = await walletClient.writeContract({
            address: contractAddress,
            abi: CONTRACT_ABI,
            functionName: "createElection",
            args: [title, startDate, endDate],
          });
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          resolvedOnchainElectionId = extractElectionIdFromReceipt(
            receipt.logs as readonly { data: Hex; topics: readonly Hex[] }[]
          );
        } catch {
          // If create fails (e.g. already created), discover by matching metadata on-chain.
          try {
            const electionCount = await publicClient.readContract({
              address: contractAddress,
              abi: CONTRACT_ABI,
              functionName: "getElectionCount",
              args: [],
            });

            for (let id = electionCount; id >= 1n; id -= 1n) {
              const onchainElection = await publicClient.readContract({
                address: contractAddress,
                abi: CONTRACT_ABI,
                functionName: "elections",
                args: [id],
              }) as { title: string; startDate: bigint; endDate: bigint };

              if (
                normalizeTitle(onchainElection.title) === normalizeTitle(title) &&
                onchainElection.startDate === startDate &&
                onchainElection.endDate === endDate
              ) {
                resolvedOnchainElectionId = id;
                break;
              }
            }
          } catch {
            // continue; unresolved mapping will be reported below
          }
        }

        if (resolvedOnchainElectionId === null) {
          continue;
        }

        const { error: mapUpsertError } = await serviceClient.from("onchain_entity_map").upsert(
          {
            entity_type: "election",
            offchain_id: offchainElectionId,
            onchain_id: resolvedOnchainElectionId.toString(),
            chain: chainName,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "entity_type,offchain_id,chain" }
        );
        if (!mapUpsertError) {
          mappedByElectionId.set(offchainElectionId, resolvedOnchainElectionId);
        }
      }
    }

    const stillMissingMappings = activeElectionIds.filter((id) => !mappedByElectionId.has(id));
    if (stillMissingMappings.length > 0) {
      return c.json(
        {
          error: "Missing on-chain election mapping",
          details: {
            chain: chainName,
            electionIds: stillMissingMappings,
          },
        },
        400,
        corsHeaders
      );
    }

    // Ensure candidate mapping exists for active elections so student vote can resolve on-chain IDs.
    let candidatesQuery = serviceClient
      .from("candidates")
      .select("id, election_id, name, position")
      .in("election_id", activeElectionIds);

    if (candidateId) {
      candidatesQuery = candidatesQuery.eq("id", candidateId);
    }

    const { data: electionCandidates, error: candidatesError } = await candidatesQuery;
    if (candidatesError) {
      return c.json({ error: candidatesError.message }, 500, corsHeaders);
    }

    const candidateIds = (electionCandidates || []).map((row) => row.id);
    let mappedCandidateIds = new Set<string>();
    if (candidateIds.length > 0) {
      const { data: existingCandidateMaps, error: existingCandidateMapsError } = await serviceClient
        .from("onchain_entity_map")
        .select("offchain_id")
        .eq("entity_type", "candidate")
        .eq("chain", chainName)
        .in("offchain_id", candidateIds);

      if (existingCandidateMapsError) {
        return c.json({ error: existingCandidateMapsError.message }, 500, corsHeaders);
      }

      mappedCandidateIds = new Set((existingCandidateMaps || []).map((row) => row.offchain_id));
    }
    const missingCandidateRows = (electionCandidates || []).filter((row) => !mappedCandidateIds.has(row.id));
    const candidateSyncWarnings: string[] = [];

    for (const candidate of missingCandidateRows) {
      const onchainElectionId = mappedByElectionId.get(candidate.election_id);
      if (!onchainElectionId) {
        candidateSyncWarnings.push(`Missing election map for candidate ${candidate.id}`);
        continue;
      }

      const positionIndex = mapPositionToOnchainIndex(candidate.position);
      if (positionIndex === null) {
        candidateSyncWarnings.push(
          `Unsupported position "${candidate.position}" for candidate ${candidate.id}; skipped on-chain candidate sync`
        );
        continue;
      }
      let resolvedOnchainCandidateId: bigint | null = null;

      try {
        const txHash = await walletClient.writeContract({
          address: contractAddress,
          abi: CONTRACT_ABI,
          functionName: "registerCandidate",
          args: [onchainElectionId, candidate.name, positionIndex],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        resolvedOnchainCandidateId = extractCandidateIdFromReceipt(
          receipt.logs as readonly { data: Hex; topics: readonly Hex[] }[]
        );
      } catch (_error) {
        // Even if registration fails for any reason, attempt to discover
        // an already-existing on-chain candidate by position + name.
        const onchainCandidates = await publicClient.readContract({
          address: contractAddress,
          abi: CONTRACT_ABI,
          functionName: "getCandidatesByPosition",
          args: [onchainElectionId, positionIndex],
        }) as Array<{ id: bigint; name: string }>;

        const found = (onchainCandidates || []).find(
          (row) => row.name.trim().toLowerCase() === candidate.name.trim().toLowerCase()
        );
        resolvedOnchainCandidateId = found?.id ?? null;
      }

      if (resolvedOnchainCandidateId === null) {
        candidateSyncWarnings.push(`Could not resolve on-chain candidate id for candidate ${candidate.id}`);
        continue;
      }

      const { error: mapUpsertError } = await serviceClient
        .from("onchain_entity_map")
        .upsert(
          {
            entity_type: "candidate",
            offchain_id: candidate.id,
            onchain_id: resolvedOnchainCandidateId.toString(),
            chain: chainName,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "entity_type,offchain_id,chain" }
        );
      if (mapUpsertError) {
        candidateSyncWarnings.push(
          `Failed to upsert candidate mapping for candidate ${candidate.id}: ${mapUpsertError.message}`
        );
      }
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
        try {
          whitelistTxHash = await walletClient.writeContract({
            address: contractAddress,
            abi: CONTRACT_ABI,
            functionName: "whitelistVoter",
            args: [onchainElectionId, walletAddress as Hex],
          });
          await publicClient.waitForTransactionReceipt({ hash: whitelistTxHash });
        } catch (error) {
          const msg = getErrorMessage(error).toLowerCase();
          if (msg.includes("already") && msg.includes("whitelist")) {
            // No-op, treat as already whitelisted.
          } else if (msg.includes("not registered")) {
            await ensureStudentRegisteredOnChain();
            whitelistTxHash = await walletClient.writeContract({
              address: contractAddress,
              abi: CONTRACT_ABI,
              functionName: "whitelistVoter",
              args: [onchainElectionId, walletAddress as Hex],
            });
            await publicClient.waitForTransactionReceipt({ hash: whitelistTxHash });
          } else {
            throw error;
          }
        }
      }

      await serviceClient.from("onchain_voter_whitelist").upsert(
        {
          user_id: userId,
          election_id: dbElectionId,
          wallet_address: walletAddress,
          chain: chainName,
          is_whitelisted: true,
          whitelist_tx_hash: whitelistTxHash,
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,election_id,chain" }
      );

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
        candidateSyncWarnings,
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
