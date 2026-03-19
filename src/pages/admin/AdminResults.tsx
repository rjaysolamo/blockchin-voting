import { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { getCandidates } from '@/api/candidates';
import { getElectionStats } from '@/api/votes';
import { useToast } from '@/hooks/use-toast';
import { Candidate, ElectionStats } from '@/@types';

const AdminResults = () => {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [electionStats, setElectionStats] = useState<ElectionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const positions = [...new Set(candidates.map((c) => c.position))];

  // Fetch candidates and election stats data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch candidates
        const candidatesResponse = await getCandidates();
        if (candidatesResponse.success) {
          setCandidates(candidatesResponse.data);
        } else {
          toast({
            title: 'Error',
            description: candidatesResponse.error || 'Failed to fetch candidates',
            variant: 'destructive',
          });
        }
        
        // Fetch election stats
        const statsResponse = await getElectionStats();
        if (statsResponse.success) {
          setElectionStats(statsResponse.data);
        } else {
          toast({
            title: 'Error',
            description: statsResponse.error || 'Failed to fetch election statistics',
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to fetch data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      
      <main className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Election Results</h1>
          <p className="text-muted-foreground">Real-time voting results by position</p>
        </header>
        
        

        <div className="grid gap-6">
          {positions.map((position) => {
            const positionCandidates = candidates
              .filter((c) => c.position === position)
              .sort((a, b) => b.voteCount - a.voteCount);
            const totalVotes = positionCandidates.reduce((sum, c) => sum + c.voteCount, 0);
            const leader = positionCandidates[0];

            return (
              <div key={position} className="voting-card">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">{position}</h2>
                  <span className="text-sm text-muted-foreground">
                    {totalVotes} total votes
                  </span>
                </div>

                <div className="space-y-4">
                  {positionCandidates.map((candidate, index) => {
                    const percentage = totalVotes > 0 
                      ? Math.round((candidate.voteCount / totalVotes) * 100) 
                      : 0;
                    const isLeader = candidate.id === leader.id;

                    return (
                      <div key={candidate.id} className="flex items-center gap-4">
                        <div className="flex items-center gap-3 w-48">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isLeader ? 'bg-foreground text-background' : 'bg-muted'
                          }`}>
                            <span className="text-sm font-medium">
                              {candidate.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className={`text-sm ${isLeader ? 'font-semibold' : 'font-medium'}`}>
                              {candidate.name}
                              {isLeader && index === 0 && (
                                <span className="ml-2 text-xs bg-foreground text-background px-1.5 py-0.5 rounded">
                                  Leading
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                              <div
                                className={`h-full rounded-lg transition-all duration-700 ${
                                  isLeader ? 'bg-foreground' : 'bg-muted-foreground/30'
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <div className="w-20 text-right">
                              <span className="font-semibold">{percentage}%</span>
                              <span className="text-muted-foreground text-sm ml-1">
                                ({candidate.voteCount})
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 voting-card">
          <h2 className="text-lg font-semibold mb-4">Election Summary</h2>
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold">{electionStats?.totalVoters || 0}</p>
              <p className="text-sm text-muted-foreground">Eligible Voters</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{electionStats?.votesCast || 0}</p>
              <p className="text-sm text-muted-foreground">Votes Cast</p>
            </div>
            <div>
              <p className="text-3xl font-bold">
                {electionStats ? Math.round((electionStats.votesCast / electionStats.totalVoters) * 100) : 0}%
              </p>
              <p className="text-sm text-muted-foreground">Voter Turnout</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminResults;
