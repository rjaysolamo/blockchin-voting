'use client';

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useActiveElection, useElectionCandidates, useElectionPositions } from '@/hooks/useElection';
import { useOnChainVoting } from '@/hooks/useOnChainVoting';
import { useSmartWallet } from '@/hooks/useSmartWallet';
import { BlockchainCandidateCard } from '@/components/blockchain/BlockchainCandidateCard';
import { VoteReceiptDialog } from '@/components/blockchain/VoteReceiptDialog';
import { VoteVerificationDialog } from '@/components/blockchain/VoteVerificationDialog';
import { AuditLogPanel } from '@/components/blockchain/AuditLogPanel';
import { WalletAuthGuard } from '@/components/blockchain/WalletAuthGuard';
import ElectionCountdown from '@/components/student/ElectionCountdown';
import { Button } from '@/components/ui/button';
import { LogOut, CheckCircle2, Vote, Shield, Blocks, GitCompare, Wallet, Copy, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const BlockchainVotingDashboardWithWallet = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, hasRole } = useSupabaseAuth();
  const { toast } = useToast();
  const { state: smartWalletState, enrollPasskey } = useSmartWallet();
  const { data: election, isLoading: electionLoading } = useActiveElection();
  const { data: candidates, isLoading: candidatesLoading } = useElectionCandidates(election?.id);
  const { castVote, isSubmitting } = useOnChainVoting();
  const [isEnrollBusy, setIsEnrollBusy] = useState(false);
  const [isOnChainReady, setIsOnChainReady] = useState(false);
  const [isCheckingOnChainReady, setIsCheckingOnChainReady] = useState(false);
  const [showFullWalletAddress, setShowFullWalletAddress] = useState(false);
  
  const positions = useElectionPositions(candidates || []);
  const [votedPositions, setVotedPositions] = useState<Record<string, string>>({});
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    open: boolean;
    code: string;
    candidateName: string;
    position: string;
  }>({ open: false, code: '', candidateName: '', position: '' });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    candidateId: string;
    candidateName: string;
    position: string;
  }>({ open: false, candidateId: '', candidateName: '', position: '' });

  // For on-chain voting, we don't pre-load votes since they're on the blockchain
  // Users will need to manually track which positions they've voted for

  const handleVoteClick = (candidateId: string) => {
    const candidate = candidates?.find((c) => c.id === candidateId);
    if (candidate) {
      setConfirmDialog({
        open: true,
        candidateId,
        candidateName: candidate.name,
        position: candidate.position,
      });
    }
  };

  const handlePasskeyEnrollment = useCallback(async () => {
    setIsEnrollBusy(true);
    try {
      await enrollPasskey();
      if (election?.id) {
        const { error, data } = await supabase.functions.invoke('onchain-bootstrap-voter', {
          body: { electionId: election.id },
        });
        if (error || data?.error) {
          throw new Error(error?.message || data?.error || 'Failed to bootstrap on-chain voter status');
        }
      }
      setIsOnChainReady(true);
    } finally {
      setIsEnrollBusy(false);
    }
  }, [enrollPasskey, election?.id]);

  useEffect(() => {
    if (!user?.id || !election?.id) return;
    let mounted = true;

    void (async () => {
      setIsCheckingOnChainReady(true);
      try {
        const chainName = (import.meta.env.VITE_BLOCKCHAIN_NETWORK || 'baseSepolia').trim();
        const { data: statusRows, error } = await supabase
          .from('onchain_voter_whitelist' as never)
          .select('is_whitelisted, chain, updated_at')
          .eq('user_id', user.id)
          .eq('election_id', election.id)
          .order('updated_at', { ascending: false });

        if (error) throw error;
        const rows = (statusRows as Array<{ is_whitelisted?: boolean; chain?: string | null }> | null) || [];
        const sameChain = rows.find((row) => (row.chain || '').trim() === chainName);
        const anyWhitelisted = rows.find((row) => Boolean(row.is_whitelisted));
        const resolved = sameChain ?? anyWhitelisted ?? null;
        if (mounted) setIsOnChainReady(Boolean(resolved?.is_whitelisted));
      } catch {
        if (mounted) setIsOnChainReady(false);
      } finally {
        if (mounted) setIsCheckingOnChainReady(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id, election?.id]);

  const confirmVote = async () => {
    if (!election) return;

    const result = await castVote({
      candidateId: confirmDialog.candidateId,
      electionId: election.id,
    });

    setConfirmDialog({ open: false, candidateId: '', candidateName: '', position: '' });

    if (result.success && result.verificationCode) {
      setVotedPositions((prev) => ({
        ...prev,
        [confirmDialog.position]: confirmDialog.candidateId,
      }));

      setReceiptData({
        open: true,
        code: result.verificationCode,
        candidateName: confirmDialog.candidateName,
        position: confirmDialog.position,
      });
    } else {
      toast({
        title: 'Vote Failed',
        description: result.error || 'Unable to record your vote',
        variant: 'destructive',
      });
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleCopyWalletAddress = async () => {
    if (!smartWalletState.address) return;
    try {
      await navigator.clipboard.writeText(smartWalletState.address);
      toast({
        title: 'Wallet copied',
        description: 'Full wallet address copied to clipboard.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Unable to copy wallet address. Please copy it manually.',
        variant: 'destructive',
      });
    }
  };

  const isElectionOpen = election?.is_active && new Date(election.end_date) > new Date();
  const hasVotedAllPositions = positions.length > 0 && positions.every((p) => votedPositions[p]);

  if (electionLoading || candidatesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading election data...</p>
        </div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="voting-card text-center max-w-md">
          <Blocks className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Active Election</h2>
          <p className="text-muted-foreground">
            There is no active election at the moment. Please check back later.
          </p>
          <Button variant="outline" onClick={handleLogout} className="mt-4">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Blocks className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Blockchain Voting</h1>
              <p className="text-sm text-muted-foreground">
                {election.title} • Secure On-Chain Voting
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {smartWalletState.address && (
              <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full">
                <Wallet className="w-4 h-4" />
                <span className="text-sm font-mono">
                  {showFullWalletAddress
                    ? smartWalletState.address
                    : `${smartWalletState.address.substring(0, 6)}...${smartWalletState.address.substring(smartWalletState.address.length - 4)}`}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={handleCopyWalletAddress}
                  title="Copy wallet address"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setShowFullWalletAddress((prev) => !prev)}
                  title={showFullWalletAddress ? 'Hide full address' : 'Show full address'}
                >
                  {showFullWalletAddress ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
              </div>
            )}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <WalletAuthGuard
          message="Your smart wallet is automatically available for blockchain voting"
          onEnrollPasskey={handlePasskeyEnrollment}
          isEnrollmentInProgress={isEnrollBusy}
          isAuthorized={isOnChainReady && !isCheckingOnChainReady}
          unauthorizedMessage="Your wallet exists but is not yet whitelisted for this election. Complete passkey enrollment and wait for on-chain sync."
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Cast Your Vote</h2>
                  <ElectionCountdown endDate={new Date(election.end_date)} />
                </div>
                
                {!isElectionOpen && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center">
                      <Shield className="w-5 h-5 text-yellow-600 mr-2" />
                      <span className="text-yellow-800">
                        Voting is currently closed. The election period has ended.
                      </span>
                    </div>
                  </div>
                )}

                {hasVotedAllPositions && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mr-2" />
                      <span className="text-green-800">
                        You have successfully voted in all positions!
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {positions.map((position) => (
                <div key={position} className="bg-card border border-border rounded-lg p-6 mb-6">
                  <h3 className="text-xl font-semibold mb-4">{position}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {candidates
                      ?.filter((c) => c.position === position)
                      .map((candidate) => (
                        <BlockchainCandidateCard
                          key={candidate.id}
                          candidate={candidate}
                          onVote={handleVoteClick}
                          voted={votedPositions[position] === candidate.id}
                          isDisabled={!isElectionOpen || hasVotedAllPositions || votedPositions[position] !== undefined}
                          voteProgress={candidate.vote_count / Math.max(1, Math.max(...candidates.map(c => c.vote_count), 1))}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-lg p-6 sticky top-24">
                <h3 className="text-lg font-semibold mb-4">Voting Status</h3>
                
                <div className="space-y-3 mb-6">
                  {positions.map((position) => (
                    <div key={position} className="flex items-center justify-between">
                      <span className="text-sm">{position}</span>
                      {votedPositions[position] ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <div className="w-4 h-4 border border-muted-foreground rounded-full" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-muted rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-2">Smart Wallet Connected</h4>
                  <p className="text-xs text-muted-foreground">
                    Your smart wallet is ready. Votes will be recorded on the Base Sepolia blockchain with gas-free transactions.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <AuditLogPanel electionId={election.id} />
              </div>
            </div>
          </div>
        </WalletAuthGuard>

        <VoteReceiptDialog
          open={receiptData.open}
          onOpenChange={(open) => setReceiptData({ ...receiptData, open })}
          verificationCode={receiptData.code}
          candidateName={receiptData.candidateName}
          position={receiptData.position}
        />

        <VoteVerificationDialog
          open={showVerifyDialog}
          onOpenChange={setShowVerifyDialog}
        />

        <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Your Vote</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to vote for {confirmDialog.candidateName} for {confirmDialog.position}.
                This action will be recorded on the blockchain and cannot be changed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmVote} disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : 'Confirm Vote'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default BlockchainVotingDashboardWithWallet;
