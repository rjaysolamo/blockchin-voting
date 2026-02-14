import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/features/auth/hooks/useSupabaseAuth';
import { useActiveElection, useElectionCandidates, useElectionPositions } from '../hooks/useElection';
import { useBlockchainVoting } from '@/features/blockchain/hooks/useBlockchainVoting';
import { CandidateCard } from '../components/CandidateCard';
import { ElectionCountdown } from '../components/ElectionCountdown';
import { VoteReceiptDialog, VoteVerificationDialog, AuditLogPanel } from '@/features/blockchain/components';
import { Button } from '@/components/ui/button';
import { LogOut, CheckCircle2, Shield, Blocks, GitCompare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

const VotingDashboardPage = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useSupabaseAuth();
  const { toast } = useToast();
  const { data: election, isLoading: electionLoading } = useActiveElection();
  const { data: candidates, isLoading: candidatesLoading } = useElectionCandidates(election?.id);
  const { castVote, getMyVotes, isSubmitting } = useBlockchainVoting();
  
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

  useEffect(() => {
    if (election?.id) {
      getMyVotes(election.id).then((votes) => {
        const voted: Record<string, string> = {};
        votes.forEach((v) => {
          voted[v.position] = v.candidate_id;
        });
        setVotedPositions(voted);
      });
    }
  }, [election?.id, getMyVotes]);

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

  const confirmVote = async () => {
    if (!election) return;

    const result = await castVote({
      candidateId: confirmDialog.candidateId,
      electionId: election.id,
      position: confirmDialog.position,
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
              <h1 className="font-semibold text-foreground">Blockchain Voting System</h1>
              <p className="text-sm text-muted-foreground">{election.title}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVerifyDialog(true)}
              className="gap-2"
            >
              <Shield className="w-4 h-4" />
              Verify Vote
            </Button>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{profile?.full_name || user?.email}</p>
              <p className="text-xs text-muted-foreground">{profile?.student_id}</p>
            </div>
            <Button variant="outline" size="icon" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!isElectionOpen ? (
          <div className="voting-card text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Election Closed</h2>
            <p className="text-muted-foreground">
              The election has ended. Results will be announced soon.
            </p>
          </div>
        ) : hasVotedAllPositions ? (
          <div className="voting-card text-center py-12 animate-fade-in">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Thank You for Voting!</h2>
            <p className="text-muted-foreground mb-4">
              Your votes have been securely recorded on the blockchain.
            </p>
            <Button variant="outline" onClick={() => setShowVerifyDialog(true)}>
              <Shield className="w-4 h-4 mr-2" />
              Verify My Votes
            </Button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Welcome, {profile?.full_name || 'Voter'}
                    </h2>
                    <p className="text-muted-foreground">
                      Cast your vote for each position. Each vote is cryptographically secured.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success rounded-full text-sm">
                        <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                        Election is Open
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate('/compare')}
                        className="gap-2"
                      >
                        <GitCompare className="w-4 h-4" />
                        Compare
                      </Button>
                    </div>
                  </div>
                  <div className="sm:min-w-[280px]">
                    <ElectionCountdown endDate={new Date(election.end_date)} />
                  </div>
                </div>
              </div>

              {positions.map((position) => {
                const positionCandidates = candidates?.filter((c) => c.position === position) || [];
                const hasVotedForPosition = !!votedPositions[position];

                return (
                  <section key={position}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-foreground">{position}</h3>
                      {hasVotedForPosition && (
                        <span className="text-sm text-success flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Vote submitted
                        </span>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {positionCandidates.map((candidate) => (
                        <CandidateCard
                          key={candidate.id}
                          candidate={candidate}
                          onVote={handleVoteClick}
                          hasVotedForPosition={hasVotedForPosition}
                          isVotedFor={votedPositions[position] === candidate.id}
                          disabled={isSubmitting}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="space-y-6">
              <AuditLogPanel electionId={election.id} />
              
              <div className="voting-card">
                <div className="flex items-center gap-2 mb-3">
                  <Blocks className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Blockchain Security</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    Votes are cryptographically hashed
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    Each vote links to previous block
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    Tamper-evident audit trail
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    Verify your vote anytime
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Review Your Ballot</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to vote for <strong>{confirmDialog.candidateName}</strong> for <strong>{confirmDialog.position}</strong>.
              <br /><br />
              Your vote will be:
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>Cryptographically secured with SHA-256</li>
                <li>Linked to the previous vote in the chain</li>
                <li>Given a unique verification code</li>
              </ul>   
              <br />
              This vote is final and cannot be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmVote} disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Submit Vote'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VoteReceiptDialog
        open={receiptData.open}
        onOpenChange={(open) => setReceiptData((prev) => ({ ...prev, open }))}
        verificationCode={receiptData.code}
        candidateName={receiptData.candidateName}
        position={receiptData.position}
      />

      <VoteVerificationDialog
        open={showVerifyDialog}
        onOpenChange={setShowVerifyDialog}
      />
    </div>
  );
};

export default VotingDashboardPage;
