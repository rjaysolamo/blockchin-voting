import { Users, UserCheck, Vote, Activity, FileText, Shield } from 'lucide-react';
import StatCard from '@/components/admin/StatCard';
import ElectionTimeline from '@/components/admin/ElectionTimeline';
import { AuditLogPanel } from '@/components/blockchain/AuditLogPanel';
import { useActiveElection, useElectionCandidates, useElectionStats } from '@/hooks/useAdminElection';
import { Skeleton } from '@/components/ui/skeleton';
import DashboardLayout from '@/templates/DashboardLayout';

const AdminDashboard = () => {
  const { data: election, isLoading: electionLoading } = useActiveElection();
  const { data: candidates = [], isLoading: candidatesLoading } = useElectionCandidates(election?.id);
  const { data: stats, isLoading: statsLoading } = useElectionStats(election?.id);

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
