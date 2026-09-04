import { useEffect, useMemo, useState } from 'react';
import { Search, CheckCircle2, Clock, ShieldCheck, ShieldOff, Wallet } from 'lucide-react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useActiveElection } from '@/hooks/useAdminElection';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/hooks/useWallet';
import { isValidEthereumAddress } from '@/lib/walletGenerator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type VoterRow = {
  userId: string;
  name: string;
  studentId: string;
  department: string;
  yearLevel: string;
  walletAddress: string | null;
  hasVoted: boolean;
  votedAt: string | null;
  isWhitelisted: boolean;
  whitelistUpdatedAt: string | null;
};

const CHAIN_NAME = (import.meta.env.VITE_BLOCKCHAIN_NETWORK || 'baseSepolia').trim();
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

async function invokeOnchainAdminSyncWithFallback(payload: Record<string, unknown>) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return {
      data: null,
      error: new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY'),
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const endpoint = `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/onchain-admin-sync`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SUPABASE_PUBLISHABLE_KEY,
      authorization: session?.access_token
        ? `Bearer ${session.access_token}`
        : `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      data: json,
      error: new Error(
        (json as { error?: string })?.error ||
          `onchain-admin-sync fallback failed (${response.status})`
      ),
    };
  }

  return { data: json, error: null };
}

const AdminVoters = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { state: walletState, connectWallet } = useWallet();
  const { data: election, isLoading: electionLoading } = useActiveElection();

  const requiredAdminWallet = (import.meta.env.VITE_ADMIN_DEPLOYER_WALLET || '').trim().toLowerCase();
  const hasValidAdminWalletConfig = isValidEthereumAddress(requiredAdminWallet);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [voters, setVoters] = useState<VoterRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isWhitelisting, setIsWhitelisting] = useState(false);
  const [manualWalletAddress, setManualWalletAddress] = useState('');

  const fetchVoters = async () => {
    if (!election?.id) {
      setVoters([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data: roleRows, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');
      if (roleError) throw roleError;

      const studentIds = (roleRows || []).map((row) => row.user_id);
      const hasRoleRows = studentIds.length > 0;

      const profilesQuery = supabase
        .from('profiles')
        .select('user_id, full_name, student_id, department, year_level, wallet_address');

      const { data: profileRows, error: profileError } = hasRoleRows
        ? await profilesQuery.in('user_id', studentIds)
        : await profilesQuery.or('student_id.not.is.null,wallet_address.not.is.null');

      const [{ data: whitelistRows, error: whitelistError }, { data: voteRows, error: voteError }] = await Promise.all([
        supabase
          .from('onchain_voter_whitelist' as never)
          .select('user_id, is_whitelisted, wallet_address, updated_at, chain')
          .eq('election_id', election.id)
          .order('updated_at', { ascending: false }),
        supabase
          .from('voter_registry')
          .select('voter_id, has_voted, voted_at')
          .eq('election_id', election.id),
      ]);

      if (profileError) throw profileError;
      if (whitelistError) throw whitelistError;
      if (voteError) throw voteError;

      const whitelistByUser = new Map<string, { isWhitelisted: boolean; updatedAt: string | null; walletAddress: string | null }>();
      const whitelistByWallet = new Map<string, { isWhitelisted: boolean; updatedAt: string | null }>();
      const whitelistRowsTyped = (whitelistRows as Array<{
        user_id: string;
        is_whitelisted: boolean;
        updated_at: string | null;
        wallet_address: string | null;
        chain?: string | null;
      }> | null) || [];

      for (const row of whitelistRowsTyped) {
        const normalizedChain = (row.chain || '').trim();
        const normalizedWallet = (row.wallet_address || '').trim().toLowerCase();
        const existingByUser = whitelistByUser.get(row.user_id);
        const existingByWallet = normalizedWallet ? whitelistByWallet.get(normalizedWallet) : undefined;

        // Prefer the row from currently configured chain. Otherwise keep latest seen row.
        const shouldReplaceUser =
          !existingByUser || normalizedChain === CHAIN_NAME;
        if (shouldReplaceUser) {
          whitelistByUser.set(row.user_id, {
            isWhitelisted: !!row.is_whitelisted,
            updatedAt: row.updated_at,
            walletAddress: row.wallet_address,
          });
        }

        if (normalizedWallet) {
          const shouldReplaceWallet = !existingByWallet || normalizedChain === CHAIN_NAME;
          if (shouldReplaceWallet) {
            whitelistByWallet.set(normalizedWallet, {
              isWhitelisted: !!row.is_whitelisted,
              updatedAt: row.updated_at,
            });
          }
        }
      }

      const voteByUser = new Map<string, { hasVoted: boolean; votedAt: string | null }>();
      (voteRows || []).forEach((row) => {
        voteByUser.set(row.voter_id, {
          hasVoted: !!row.has_voted,
          votedAt: row.voted_at,
        });
      });

      const mappedRows: VoterRow[] = (profileRows || []).map((profile) => {
        const normalizedWallet = (profile.wallet_address || '').trim().toLowerCase();
        const whitelist = whitelistByUser.get(profile.user_id) || whitelistByWallet.get(normalizedWallet);
        const vote = voteByUser.get(profile.user_id);
        return {
          userId: profile.user_id,
          name: (profile.full_name || 'Unnamed Student').trim(),
          studentId: profile.student_id || '-',
          department: profile.department || '-',
          yearLevel: profile.year_level || '-',
          walletAddress: normalizedWallet || null,
          hasVoted: vote?.hasVoted ?? false,
          votedAt: vote?.votedAt ?? null,
          isWhitelisted: whitelist?.isWhitelisted ?? false,
          whitelistUpdatedAt: whitelist?.updatedAt ?? null,
        };
      });

      mappedRows.sort((a, b) => a.name.localeCompare(b.name));
      setVoters(mappedRows);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch voters';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchVoters();
  }, [election?.id]);

  const whitelistWallet = async (walletAddressInput: string) => {
    if (!election?.id) return;

    const normalizedWallet = walletAddressInput.trim().toLowerCase();
    if (!isValidEthereumAddress(normalizedWallet)) {
      toast({
        title: 'Invalid wallet address',
        description: 'Enter a valid EVM wallet address.',
        variant: 'destructive',
      });
      return;
    }

    setIsWhitelisting(true);
    try {
      if (!hasValidAdminWalletConfig) {
        throw new Error('Admin deployer wallet is not configured. Set VITE_ADMIN_DEPLOYER_WALLET and restart app.');
      }

      const connectedAddress = (
        walletState.address ||
        (await connectWallet(requiredAdminWallet))
      ).toLowerCase();

      if (connectedAddress !== requiredAdminWallet) {
        throw new Error('Connected wallet does not match configured deployer wallet.');
      }

      const ethereum = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!ethereum) {
        throw new Error('No EVM wallet detected for signing.');
      }

      const signMessage = [
        'Voter Whitelist Approval',
        `ElectionId: ${election.id}`,
        `Wallet: ${normalizedWallet}`,
        `Timestamp: ${new Date().toISOString()}`,
      ].join('\n');

      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [signMessage, connectedAddress],
      });

      const { error: syncError, data: syncData } = await invokeOnchainAdminSyncWithFallback({
        action: 'whitelist-wallet',
        electionId: election.id,
        walletAddress: normalizedWallet,
        signedMessage: signMessage,
        walletSignature: signature,
        adminWallet: connectedAddress,
      });

      if (syncError || syncData?.error || !syncData?.success) {
        throw new Error(syncError?.message || syncData?.error || 'Failed to whitelist voter wallet');
      }

      toast({
        title: 'Wallet whitelisted',
        description: syncData?.txHash
          ? `Voter wallet approved on-chain (tx: ${String(syncData.txHash).slice(0, 10)}...).`
          : 'Voter wallet approved successfully.',
      });

      setManualWalletAddress('');
      queryClient.invalidateQueries({ queryKey: ['election-stats', election.id] });
      queryClient.invalidateQueries({ queryKey: ['election-stats'] });
      await fetchVoters();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to whitelist wallet';
      toast({
        title: 'Whitelist failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsWhitelisting(false);
    }
  };

  const filteredVoters = useMemo(() => {
    return voters.filter((voter) => {
      const matchesSearch =
        voter.name.toLowerCase().includes(search.toLowerCase()) ||
        voter.studentId.toLowerCase().includes(search.toLowerCase()) ||
        (voter.walletAddress || '').toLowerCase().includes(search.toLowerCase());

      const matchesFilter =
        filter === 'all' ||
        (filter === 'whitelisted' && voter.isWhitelisted) ||
        (filter === 'not-whitelisted' && !voter.isWhitelisted) ||
        (filter === 'voted' && voter.hasVoted) ||
        (filter === 'pending' && !voter.hasVoted);

      return matchesSearch && matchesFilter;
    });
  }, [voters, search, filter]);

  if (electionLoading) {
    return (
      <div className="min-h-screen flex bg-background">
        <AdminSidebar />
        <main className="flex-1 p-8">
          <p className="text-muted-foreground">Loading election...</p>
        </main>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="min-h-screen flex bg-background">
        <AdminSidebar />
        <main className="flex-1 p-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Voters</h1>
          <p className="text-muted-foreground">No active election. Create an election first in Admin Settings.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />

      <main className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Voters</h1>
          <p className="text-muted-foreground">Whitelist wallets for {election.title}. Only whitelisted wallets can vote.</p>
        </header>

        <div className="voting-card mb-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wallet-whitelist">Whitelist wallet address</Label>
            <div className="flex flex-col md:flex-row gap-3">
              <Input
                id="wallet-whitelist"
                placeholder="0x..."
                value={manualWalletAddress}
                onChange={(event) => setManualWalletAddress(event.target.value)}
              />
              <Button
                type="button"
                onClick={() => void whitelistWallet(manualWalletAddress)}
                disabled={!manualWalletAddress.trim() || isWhitelisting}
              >
                <Wallet className="w-4 h-4 mr-2" />
                {isWhitelisting ? 'Whitelisting...' : 'Whitelist Wallet'}
              </Button>
            </div>
          </div>
        </div>

        <div className="voting-card">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, student ID, wallet..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Voters</SelectItem>
                <SelectItem value="whitelisted">Whitelisted</SelectItem>
                <SelectItem value="not-whitelisted">Not Whitelisted</SelectItem>
                <SelectItem value="voted">Voted</SelectItem>
                <SelectItem value="pending">Not Voted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">Loading voters...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Whitelist</TableHead>
                  <TableHead>Vote Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVoters.map((voter) => {
                  const canWhitelist = !!voter.walletAddress && !voter.isWhitelisted;
                  return (
                    <TableRow key={voter.userId}>
                      <TableCell className="font-medium">{voter.name}</TableCell>
                      <TableCell className="font-mono text-sm">{voter.studentId}</TableCell>
                      <TableCell>{voter.department}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {voter.walletAddress ? `${voter.walletAddress.slice(0, 8)}...${voter.walletAddress.slice(-6)}` : 'No wallet linked'}
                      </TableCell>
                      <TableCell>
                        {voter.isWhitelisted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                            <ShieldCheck className="w-3 h-3" />
                            Whitelisted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                            <ShieldOff className="w-3 h-3" />
                            Not Whitelisted
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {voter.hasVoted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                            <CheckCircle2 className="w-3 h-3" />
                            Voted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => voter.walletAddress && void whitelistWallet(voter.walletAddress)}
                          disabled={!canWhitelist || isWhitelisting}
                        >
                          {voter.isWhitelisted ? 'Approved' : 'Whitelist'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!isLoading && filteredVoters.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No voters found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminVoters;
