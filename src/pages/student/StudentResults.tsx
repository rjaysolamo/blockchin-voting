import { useState, useEffect } from 'react';
import DashboardLayout from '@/templates/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Vote } from 'lucide-react';
import { getCandidates, getElectionStats } from '@/api';
import { Candidate, ElectionStats } from '@/@types';

const StudentResults = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<ElectionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [candidatesResponse, statsResponse] = await Promise.all([
          getCandidates(),
          getElectionStats()
        ]);

        if (candidatesResponse.success) {
          setCandidates(candidatesResponse.data);
        }

        if (statsResponse.success) {
          setStats(statsResponse.data);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout title="Live Results" subtitle="Real-time election updates">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const positions = [...new Set(candidates.map((c) => c.position))];
  const totalVotesCast = stats?.votesCast || 0;
  const participationRate = Math.round((totalVotesCast / (stats?.totalVoters || 1)) * 100);

  return (
    <DashboardLayout title="Live Results" subtitle="Real-time election updates">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
            <Vote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVotesCast.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Votes cast so far</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Participation</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{participationRate}%</div>
            <p className="text-xs text-muted-foreground">Of eligible voters</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Badge variant="outline" className="text-success border-success bg-success/10">Live</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">In Progress</div>
            <p className="text-xs text-muted-foreground">Election ends in 2 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {positions.map((position) => {
          const candidatesForPosition = candidates
            .filter((c) => c.position === position)
            .sort((a, b) => b.voteCount - a.voteCount);
          const totalPositionVotes = candidatesForPosition.reduce((sum, c) => sum + c.voteCount, 0);
          const leader = candidatesForPosition[0];

          return (
            <Card key={position}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold">{position}</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {totalPositionVotes} votes
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {candidates.map((candidate, index) => {
                  const percentage = totalPositionVotes > 0 
                    ? Math.round((candidate.voteCount / totalPositionVotes) * 100) 
                    : 0;
                  const isLeader = candidate.id === leader.id;

                  return (
                    <div key={candidate.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isLeader && index === 0 && (
                            <Trophy className="h-4 w-4 text-yellow-500" />
                          )}
                          <span className={`font-medium ${isLeader ? 'text-primary' : ''}`}>
                            {candidate.name}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="font-bold">{percentage}%</span>
                          <span className="text-muted-foreground ml-1">({candidate.voteCount})</span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${isLeader ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
};

export default StudentResults;
