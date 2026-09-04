'use client';

import { useState, useCallback } from 'react';
import { useSupabaseAuth } from './useSupabaseAuth';
import { useToast } from './use-toast';
import { CONTRACT_ADDRESS as ENV_CONTRACT_ADDRESS } from '@/lib/constants';
import { getEmbeddedSmartAccountClient, hasEmbeddedPasskey } from '@/lib/embeddedSmartAccountProvider';
import { createChainPublicClient, getSupportedNetwork } from '@/lib/chain';
import { BlockchainVotingABI } from '@/lib/abis/BlockchainVoting';
import { supabase } from '@/integrations/supabase/client';
import { castOnChainVote } from '@/lib/onChainVoteFlow';

const CONTRACT_ABI = BlockchainVotingABI;

function mapPositionToOnchainIndex(position: string): number | null {
  const normalized = position
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

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

  return map[normalized] ?? null;
}

function getAllPositionIndexes(): number[] {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
}

interface CastVoteParams {
  candidateId: string;
  electionId: string;
}

interface UseOnChainVotingReturn {
      castVote: (params: CastVoteParams) => Promise<{ success: boolean; verificationCode?: string; error?: string }>;
  isSubmitting: boolean;
  lastVerificationCode: string | null;
}

function getChainAliases(chain: string): string[] {
  const normalized = chain.trim();
  const lower = normalized.toLowerCase();

  if (lower === 'basesepolia' || lower === 'base-sepolia' || lower === 'base_sepolia') {
    return ['baseSepolia', 'base-sepolia', 'base_sepolia', 'basesepolia', 'base sepolia'];
  }
  if (lower === 'sepolia' || lower === 'eth-sepolia' || lower === 'ethereum-sepolia') {
    return ['sepolia', 'eth-sepolia', 'ethereum-sepolia', 'eth_sepolia', 'ethereum_sepolia'];
  }
  if (lower === 'base' || lower === 'base-mainnet' || lower === 'base_mainnet') {
    return ['base', 'base-mainnet', 'base_mainnet', 'basemainnet', 'base mainnet'];
  }

  return [normalized];
}

function normalizeChainLabel(value: string | null | undefined): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, '');
}

function normalizeTitle(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function toUnixSeconds(value: string): bigint | null {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return BigInt(Math.floor(ms / 1000));
}

export function useOnChainVoting(): UseOnChainVotingReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastVerificationCode, setLastVerificationCode] = useState<string | null>(null);
  const { user } = useSupabaseAuth();
  const { toast } = useToast();

  const castVote = useCallback(async ({
    candidateId,
    electionId,
  }: CastVoteParams): Promise<{ success: boolean; verificationCode?: string; error?: string }> => {
    setIsSubmitting(true);

    try {
      if (!user?.id) {
        return { success: false, error: 'You must be signed in to vote' };
      }

      const apiKey = (
        ((import.meta.env.VITE_ALCHEMY_API_KEY as string | undefined)?.trim()) ||
        ((import.meta.env.VITE_ALCHEMY_APP_ID as string | undefined)?.trim()) ||
        ''
      );
      if (!apiKey) {
        return { success: false, error: 'Missing VITE_ALCHEMY_API_KEY (or VITE_ALCHEMY_APP_ID)' };
      }
      if (/\s/.test(apiKey) || apiKey.includes('/')) {
        return {
          success: false,
          error: 'Invalid Alchemy API key format in environment. Use raw key only (no spaces, no URL).',
        };
      }

      const contractAddress = (ENV_CONTRACT_ADDRESS || '').trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
        return { success: false, error: 'Missing or invalid VITE_CONTRACT_ADDRESS' };
      }

      const network = getSupportedNetwork();
      const result = await castOnChainVote(
        {
          candidateId,
          electionId,
          userId: user.id,
          apiKey,
          network,
          contractAddress,
          abi: CONTRACT_ABI,
        },
        {
          supabaseGateway: {
            bootstrapVoter: async ({ electionId: electionIdParam, candidateId: candidateIdParam }) => {
              const { error: bootstrapError, data: bootstrapData } = await supabase.functions.invoke(
                'onchain-bootstrap-voter',
                { body: { electionId: electionIdParam, candidateId: candidateIdParam } }
              );
              return {
                error:
                  bootstrapError?.message ||
                  bootstrapData?.error ||
                  null,
              };
            },
            resolveOnchainVoteIds: async ({ electionId: eId, candidateId: cId, chain }) => {
              const aliases = getChainAliases(chain);
              let lastRpcError: string | null = null;

              for (const chainAlias of aliases) {
                const { data: onchainIds, error: mappingError } = await supabase.rpc(
                  'resolve_onchain_vote_ids' as never,
                  {
                    p_election_id: eId,
                    p_candidate_id: cId,
                    p_chain: chainAlias,
                  } as never
                );

                if (mappingError) {
                  lastRpcError = mappingError.message || 'Failed to resolve on-chain ids';
                  continue;
                }

                const mappedRow = (Array.isArray(onchainIds) ? onchainIds[0] : null) as
                  | { election_onchain_id: string | number | null; candidate_onchain_id: string | number | null }
                  | null;

                const electionOnchainId =
                  mappedRow && mappedRow.election_onchain_id != null
                    ? BigInt(String(mappedRow.election_onchain_id))
                    : null;
                const candidateOnchainId =
                  mappedRow && mappedRow.candidate_onchain_id != null
                    ? BigInt(String(mappedRow.candidate_onchain_id))
                    : null;

                if (electionOnchainId !== null && candidateOnchainId !== null) {
                  return {
                    electionOnchainId,
                    candidateOnchainId,
                    error: null,
                  };
                }
              }

              const { data: electionRows, error: electionLookupError } = await supabase
                .from('onchain_entity_map' as never)
                .select('onchain_id, chain, updated_at')
                .eq('entity_type', 'election')
                .eq('offchain_id', eId)
                .order('updated_at', { ascending: false });

              if (electionLookupError) {
                return {
                  electionOnchainId: null,
                  candidateOnchainId: null,
                  error: electionLookupError.message,
                };
              }

              const { data: candidateRows, error: candidateLookupError } = await supabase
                .from('onchain_entity_map' as never)
                .select('onchain_id, chain, updated_at')
                .eq('entity_type', 'candidate')
                .eq('offchain_id', cId)
                .order('updated_at', { ascending: false });

              if (candidateLookupError) {
                return {
                  electionOnchainId: null,
                  candidateOnchainId: null,
                  error: candidateLookupError.message,
                };
              }

              const eRows = (electionRows as Array<{ onchain_id: string | number; chain: string | null }> | null) || [];
              const cRows = (candidateRows as Array<{ onchain_id: string | number; chain: string | null }> | null) || [];

              const aliasSet = new Set(aliases.map((v) => normalizeChainLabel(v)));

              const electionByChain = new Map<string, bigint>();
              for (const row of eRows) {
                const key = normalizeChainLabel(row.chain);
                if (!aliasSet.has(key)) continue;
                if (!electionByChain.has(key)) {
                  electionByChain.set(key, BigInt(String(row.onchain_id)));
                }
              }

              let resolvedElection: bigint | null = null;
              let resolvedCandidate: bigint | null = null;

              for (const row of cRows) {
                const key = normalizeChainLabel(row.chain);
                const electionIdMatch = electionByChain.get(key);
                if (electionIdMatch !== undefined) {
                  resolvedElection = electionIdMatch;
                  resolvedCandidate = BigInt(String(row.onchain_id));
                  break;
                }
              }

              // Graceful compatibility fallback for environments where chain labels
              // were stored with unexpected formatting in historical rows.
              if ((resolvedElection === null || resolvedCandidate === null) && eRows.length > 0 && cRows.length > 0) {
                resolvedElection = BigInt(String(eRows[0].onchain_id));
                resolvedCandidate = BigInt(String(cRows[0].onchain_id));
              }

              if (resolvedElection !== null && resolvedCandidate !== null) {
                return {
                  electionOnchainId: resolvedElection,
                  candidateOnchainId: resolvedCandidate,
                  error: null,
                };
              }

              // If election mapping is missing, recover by matching the DB election
              // against on-chain election metadata.
              if (resolvedElection === null) {
                const { data: electionMeta, error: electionMetaError } = await supabase
                  .from('elections')
                  .select('title, start_date, end_date')
                  .eq('id', eId)
                  .maybeSingle();

                if (!electionMetaError && electionMeta) {
                  const offchainTitle = normalizeTitle(electionMeta.title);
                  const offchainStart = toUnixSeconds(String(electionMeta.start_date));
                  const offchainEnd = toUnixSeconds(String(electionMeta.end_date));

                  if (offchainTitle && offchainStart !== null && offchainEnd !== null) {
                    try {
                      const publicClient = createChainPublicClient({
                        apiKey,
                        network: chain as ReturnType<typeof getSupportedNetwork>,
                      });

                      const electionCount = await (publicClient as unknown as {
                        readContract: (args: {
                          address: `0x${string}`;
                          abi: typeof CONTRACT_ABI;
                          functionName: 'getElectionCount';
                          args: readonly [];
                        }) => Promise<bigint>;
                      }).readContract({
                        address: contractAddress as `0x${string}`,
                        abi: CONTRACT_ABI,
                        functionName: 'getElectionCount',
                        args: [] as const,
                      });

                      for (let id = electionCount; id >= 1n; id -= 1n) {
                        const onchainElection = await (publicClient as unknown as {
                          readContract: (args: {
                            address: `0x${string}`;
                            abi: typeof CONTRACT_ABI;
                            functionName: 'elections';
                            args: readonly [bigint];
                          }) => Promise<{
                            id: bigint;
                            title: string;
                            startDate: bigint;
                            endDate: bigint;
                            isActive: boolean;
                          }>;
                        }).readContract({
                          address: contractAddress as `0x${string}`,
                          abi: CONTRACT_ABI,
                          functionName: 'elections',
                          args: [id] as const,
                        });

                        const titleMatches = normalizeTitle(onchainElection.title) === offchainTitle;
                        const startMatches = onchainElection.startDate === offchainStart;
                        const endMatches = onchainElection.endDate === offchainEnd;

                        if (titleMatches && startMatches && endMatches) {
                          resolvedElection = id;
                          break;
                        }
                      }
                    } catch {
                      // keep graceful fallback below
                    }
                  }
                }
              }

              if (resolvedElection !== null && resolvedCandidate === null && cRows.length > 0) {
                const sameChainCandidate = cRows.find((row) => aliasSet.has(normalizeChainLabel(row.chain)));
                resolvedCandidate = BigInt(String((sameChainCandidate || cRows[0]).onchain_id));
              }

              // Final fallback: derive candidate on-chain id from contract state
              // (by election + position/name) so vote can proceed even when DB
              // mapping row is stale/missing.
              if (resolvedElection !== null) {
                const { data: candidateMeta, error: candidateMetaError } = await supabase
                  .from('candidates')
                  .select('name, position, election_id')
                  .eq('id', cId)
                  .maybeSingle();

                if (!candidateMetaError && candidateMeta && candidateMeta.election_id === eId) {
                  const preferredPositionIndex = mapPositionToOnchainIndex(candidateMeta.position || '');
                  const positionIndexes = preferredPositionIndex !== null
                    ? [preferredPositionIndex, ...getAllPositionIndexes().filter((v) => v !== preferredPositionIndex)]
                    : getAllPositionIndexes();

                  try {
                    const publicClient = createChainPublicClient({
                      apiKey,
                      network: chain as ReturnType<typeof getSupportedNetwork>,
                    });

                    for (const positionIndex of positionIndexes) {
                      const onchainCandidates = await (publicClient as unknown as {
                        readContract: (args: {
                          address: `0x${string}`;
                          abi: typeof CONTRACT_ABI;
                          functionName: 'getCandidatesByPosition';
                          args: readonly [bigint, number];
                        }) => Promise<Array<{ id: bigint; name: string }>>;
                      }).readContract({
                        address: contractAddress as `0x${string}`,
                        abi: CONTRACT_ABI,
                        functionName: 'getCandidatesByPosition',
                        args: [resolvedElection, positionIndex] as const,
                      });

                      const matched = (onchainCandidates || []).find(
                        (row) =>
                          String(row.name || '').trim().toLowerCase() ===
                          String(candidateMeta.name || '').trim().toLowerCase()
                      );

                      if (matched?.id != null) {
                        return {
                          electionOnchainId: resolvedElection,
                          candidateOnchainId: BigInt(String(matched.id)),
                          error: null,
                        };
                      }
                    }
                  } catch {
                    // keep graceful fallback return below
                  }
                }
              }

              return {
                electionOnchainId: null,
                candidateOnchainId: null,
                error: lastRpcError,
              };
            },
            getRegisteredWalletAddress: async (userIdParam) => {
              const { data: profileWalletData, error: profileWalletError } = await supabase
                .from('profiles')
                .select('wallet_address')
                .eq('user_id', userIdParam)
                .maybeSingle();

              return {
                walletAddress: profileWalletData?.wallet_address?.toLowerCase() ?? null,
                error: profileWalletError?.message || null,
              };
            },
            getWhitelistStatus: async ({ userId: userIdParam, electionId: electionIdParam, chain }) => {
              const { data: whitelistRows, error: whitelistError } = await supabase
                .from('onchain_voter_whitelist' as never)
                .select('is_whitelisted, chain, updated_at')
                .eq('user_id', userIdParam)
                .eq('election_id', electionIdParam)
                .order('updated_at', { ascending: false });

              const rows = (whitelistRows as Array<{
                is_whitelisted?: boolean;
                chain?: string | null;
                updated_at?: string | null;
              }> | null) || [];
              const sameChain = rows.find((row) => (row.chain || '').trim() === chain);
              const anyWhitelisted = rows.find((row) => Boolean(row.is_whitelisted));
              const resolved = sameChain ?? anyWhitelisted ?? null;

              return {
                isWhitelisted: Boolean(resolved?.is_whitelisted),
                error: whitelistError?.message || null,
              };
            },
          },
          hasEmbeddedPasskey,
          getEmbeddedSmartAccountClient,
          createChainPublicClient: ({ apiKey: key, network: net }) =>
            createChainPublicClient({ apiKey: key, network: net as ReturnType<typeof getSupportedNetwork> }),
        }
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      setLastVerificationCode(result.verificationCode ?? null);
      
      toast({
        title: 'Vote Cast Successfully',
        description: `Your vote has been recorded on the blockchain. ${result.transactionHash ? `Transaction: ${result.transactionHash}` : `UserOp: ${result.userOpHash}`}`,
      });

      return { success: true, verificationCode: result.verificationCode };
    } catch (error: unknown) {
      console.error('Vote casting error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.id, toast]);

  return {
    castVote,
    isSubmitting,
    lastVerificationCode,
  };
}
