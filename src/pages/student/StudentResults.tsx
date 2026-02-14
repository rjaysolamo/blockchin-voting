import { mockCandidates, mockStats } from '@/api/mockData';
import DashboardLayout from '@/templates/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Vote } from 'lucide-react';

const StudentResults = () => {
  const positions = [...new Set(mockCandidates.map((c) => c.position))];
  const totalVotesCast = mockStats.votesCast;
  const participationRate = Math.round((totalVotesCast / mockStats.totalVoters) * 100);

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
          const candidates = mockCandidates
            .filter((c) => c.position === position)
            .sort((a, b) => b.voteCount - a.voteCount);
          const totalPositionVotes = candidates.reduce((sum, c) => sum + c.voteCount, 0);
          const leader = candidates[0];

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
