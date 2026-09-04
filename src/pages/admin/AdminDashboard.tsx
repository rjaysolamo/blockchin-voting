import { useState } from 'react';
import { Users, UserCheck, Vote, Activity, FileText, Shield, Plus } from 'lucide-react';
import StatCard from '@/components/admin/StatCard';
import ElectionTimeline from '@/components/admin/ElectionTimeline';
import { AuditLogPanel } from '@/components/blockchain/AuditLogPanel';
import { useActiveElection, useElectionCandidates, useElectionStats } from '@/hooks/useAdminElection';
import { Skeleton } from '@/components/ui/skeleton';
import DashboardLayout from '@/templates/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/hooks/useWallet';
import { isValidEthereumAddress } from '@/lib/walletGenerator';
import { useQueryClient } from '@tanstack/react-query';

const AdminDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { state: walletState, connectWallet } = useWallet();
  const { data: election, isLoading: electionLoading } = useActiveElection();
  const { data: candidates = [], isLoading: candidatesLoading } = useElectionCandidates(election?.id);
  const { data: stats, isLoading: statsLoading } = useElectionStats(election?.id);
  const [isCreatingCandidate, setIsCreatingCandidate] = useState(false);
  const [candidateName, setCandidateName] = useState('');
  const [candidatePosition, setCandidatePosition] = useState('');
  const requiredAdminWallet = (import.meta.env.VITE_ADMIN_DEPLOYER_WALLET || '').trim().toLowerCase();
  const hasValidAdminWalletConfig = isValidEthereumAddress(requiredAdminWallet);

  const isLoading = electionLoading || candidatesLoading || statsLoading;

  const votingPercentage = stats?.totalVoters 
    ? Math.round((stats.votesCast / stats.totalVoters) * 100) 
    : 0;

  const now = new Date();
  const electionStartDate = election ? new Date(election.start_date) : now;
  const electionEndDate = election ? new Date(election.end_date) : now;
  
  const isElectionOpen = election?.is_active && now >= electionStartDate && now <= electionEndDate;

  // Sort candidates by vote count for rankings
  const sortedCandidates = [...candidates].sort((a, b) => b.vote_count - a.vote_count);
  const maxVotes = sortedCandidates.length > 0 ? Math.max(...sortedCandidates.map(c => c.vote_count), 1) : 1;
  const availablePositions = [
    'President',
    'Vice President',
    'Secretary',
    'Treasurer',
    'Auditor',
    'PRO Communications',
    'Business Manager / Finance Officer',
    'Academic Affairs Officer',
    'Student Welfare Officer',
    'Year Level / Department Representative',
  ];

  const handleCreateCandidateOnChain = async () => {
    if (!election?.id) return;
    const trimmedName = candidateName.trim();
    const trimmedPosition = candidatePosition.trim();

    if (!trimmedName || !trimmedPosition) {
      toast({
        title: 'Missing fields',
        description: 'Provide candidate name and position.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingCandidate(true);
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
        'Candidate Creation Approval',
        `Name: ${trimmedName}`,
        `Position: ${trimmedPosition}`,
        `ElectionId: ${election.id}`,
        `Timestamp: ${new Date().toISOString()}`,
      ].join('\n');

      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [signMessage, connectedAddress],
      });

      const { error: syncError, data: syncData } = await supabase.functions.invoke('onchain-admin-sync', {
        body: {
          action: 'create-candidate-direct',
          electionId: election.id,
          candidateName: trimmedName,
          candidatePosition: trimmedPosition,
          signedMessage: signMessage,
          walletSignature: signature,
          adminWallet: connectedAddress,
        },
      });

      if (syncError || syncData?.error || !syncData?.success) {
        throw new Error(syncError?.message || syncData?.error || 'Failed to sync candidate on-chain');
      }

      toast({
        title: 'Candidate added',
        description: syncData?.txHash
          ? `${trimmedName} added and registered on-chain (tx: ${String(syncData.txHash).slice(0, 10)}...).`
          : `${trimmedName} has been created and registered in the contract.`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-candidates', election.id] });
      queryClient.invalidateQueries({ queryKey: ['candidates', election.id] });
      queryClient.invalidateQueries({ queryKey: ['election-stats', election.id] });
      setCandidateName('');
      setCandidatePosition('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add candidate';
      toast({
        title: 'On-chain candidate creation failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingCandidate(false);
    }
  };

  if (!election && !electionLoading) {
    return (
      <DashboardLayout title="Admin Dashboard">
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
          <Shield className="w-16 h-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No Active Election</h2>
          <p className="text-muted-foreground">Create an election in Settings to get started.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard" subtitle={election?.title || 'Loading...'}>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Voters"
                value={stats?.totalVoters?.toLocaleString() || '0'}
                icon={Users}
                subtitle="Registered voters"
              />
              <StatCard
                title="Total Candidates"
                value={stats?.totalCandidates?.toString() || '0'}
                icon={UserCheck}
                subtitle="Active candidates"
              />
              <StatCard
                title="Votes Cast"
                value={stats?.votesCast?.toLocaleString() || '0'}
                icon={Vote}
                subtitle={`${votingPercentage}% turnout`}
                variant="success"
              />
              <StatCard
                title="Election Status"
                value={isElectionOpen ? 'Open' : 'Closed'}
                icon={Activity}
                subtitle={isElectionOpen ? 'Voting in progress' : 'Voting ended'}
                variant={isElectionOpen ? 'success' : 'warning'}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Add Candidate (On-chain)</CardTitle>
                <CardDescription>
                  Creates candidate in the database and registers it in the smart contract.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="candidate-name">Candidate Name</Label>
                    <Input
                      id="candidate-name"
                      placeholder="Rjay Solamo"
                      value={candidateName}
                      onChange={(event) => setCandidateName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="candidate-position">Position</Label>
                    <Select value={candidatePosition} onValueChange={setCandidatePosition}>
                      <SelectTrigger id="candidate-position">
                        <SelectValue placeholder="Select position" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePositions.map((position) => (
                          <SelectItem key={position} value={position}>
                            {position}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <Button
                      type="button"
                      className="w-full"
                      onClick={handleCreateCandidateOnChain}
                      disabled={!election || isCreatingCandidate}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {isCreatingCandidate ? 'Adding Candidate...' : 'Add Candidate'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <ElectionTimeline 
            startDate={electionStartDate} 
            endDate={electionEndDate} 
            status={isElectionOpen ? 'open' : 'closed'} 
          />
          
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">Live Results</h3>
              </div>
            </div>

            <div className="space-y-6">
              {candidates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No candidates registered yet.
                </div>
              ) : (
                sortedCandidates.slice(0, 5).map((candidate) => (
                  <div key={candidate.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{candidate.name}</span>
                      <span className="text-muted-foreground">{candidate.position}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${(candidate.vote_count / maxVotes) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">
                        {candidate.vote_count}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {election?.id && <AuditLogPanel electionId={election.id} />}
    </DashboardLayout>
  );
};

export default AdminDashboard;
