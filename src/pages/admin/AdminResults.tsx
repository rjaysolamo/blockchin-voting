import AdminSidebar from '@/components/admin/AdminSidebar';
import { mockCandidates, mockStats } from '@/api/mockData';

const AdminResults = () => {
  const positions = [...new Set(mockCandidates.map((c) => c.position))];

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
            const candidates = mockCandidates
              .filter((c) => c.position === position)
              .sort((a, b) => b.voteCount - a.voteCount);
            const totalVotes = candidates.reduce((sum, c) => sum + c.voteCount, 0);
            const leader = candidates[0];

            return (
              <div key={position} className="voting-card">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">{position}</h2>
                  <span className="text-sm text-muted-foreground">
                    {totalVotes} total votes
                  </span>
                </div>

                <div className="space-y-4">
                  {candidates.map((candidate, index) => {
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
              <p className="text-3xl font-bold">{mockStats.totalVoters}</p>
              <p className="text-sm text-muted-foreground">Eligible Voters</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{mockStats.votesCast}</p>
              <p className="text-sm text-muted-foreground">Votes Cast</p>
            </div>
            <div>
              <p className="text-3xl font-bold">
                {Math.round((mockStats.votesCast / mockStats.totalVoters) * 100)}%
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
