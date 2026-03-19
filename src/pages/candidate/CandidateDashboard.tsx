import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getCandidates } from '@/api/candidates';
import { getElectionStats } from '@/api/votes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Users, Vote, Trophy } from 'lucide-react';
import DashboardLayout from '@/templates/DashboardLayout';
import { useToast } from '@/hooks/use-toast';

const CandidateDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [electionStats, setElectionStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get the candidate data for the logged-in user
  // In a real app, we would filter by user.id or a linked candidateId
  // For demo purposes, we'll try to find a candidate matching the user's name, or default to the first one
  const candidateData = candidates.find((c) => c.name === user?.name) || candidates.find((c) => c.name === 'Sarah Johnson') || candidates[0];
  
  // Get competitors in the same position
  const competitors = candidates.filter(
    (c) => c.position === candidateData?.position && c.id !== candidateData?.id
  );
  
  const totalVotesInPosition = candidates
    .filter((c) => c.position === candidateData?.position)
    .reduce((sum, c) => sum + c.voteCount, 0);
  
  const votePercentage = totalVotesInPosition > 0 && candidateData
    ? Math.round((candidateData.voteCount / totalVotesInPosition) * 100) 
    : 0;
    
  const maxVotes = Math.max(...candidates.filter(c => c.position === candidateData?.position).map((c) => c.voteCount), 0);
  const isLeading = candidateData && candidateData.voteCount >= maxVotes && candidateData.voteCount > 0;
  const isElectionOpen = electionStats?.electionStatus === 'open';

  // Fetch candidates and election stats
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
    <DashboardLayout title="Candidate Dashboard">
      <div className="space-y-6 animate-fade-in">
        {/* Candidate Profile Card */}
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <Avatar className="w-24 h-24 border-4 border-background shadow-sm">
                <AvatarImage src={candidateData.photo} alt={candidateData.name} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">{candidateData.name.charAt(0)}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-bold">{candidateData.name}</h2>
                  {isLeading && (
                    <Badge variant="default" className="gap-1 bg-yellow-500 hover:bg-yellow-600">
                      <Trophy className="w-3 h-3" /> Leading
                    </Badge>
                  )}
                  <Badge variant={isElectionOpen ? "outline" : "secondary"} className={isElectionOpen ? "text-green-600 border-green-600 bg-green-50" : ""}>
                    {isElectionOpen ? 'Election Open' : 'Election Closed'}
                  </Badge>
                </div>
                <p className="text-lg text-muted-foreground font-medium">{candidateData.position}</p>
                <p className="text-muted-foreground max-w-2xl">{candidateData.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
              <Vote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{candidateData.voteCount}</div>
              <p className="text-xs text-muted-foreground">
                Current vote count
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vote Share</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{votePercentage}%</div>
              <p className="text-xs text-muted-foreground">
                Of total votes for {candidateData.position}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Competitors</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{competitors.length}</div>
              <p className="text-xs text-muted-foreground">
                Running for same position
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Position Standings */}
        <Card>
          <CardHeader>
            <CardTitle>Position Standings</CardTitle>
            <CardDescription>Real-time updates for {candidateData.position}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {[candidateData, ...competitors]
              .sort((a, b) => b.voteCount - a.voteCount)
              .map((candidate, index) => {
                const percentage = totalVotesInPosition > 0 
                  ? Math.round((candidate.voteCount / totalVotesInPosition) * 100) 
                  : 0;
                const isCurrentUser = candidate.id === candidateData.id;
                
                return (
                  <div key={candidate.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                          index === 0 ? 'bg-yellow-500 text-white' : 'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </span>
                        <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={candidate.photo} />
                                <AvatarFallback>{candidate.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className={isCurrentUser ? 'font-semibold' : ''}>
                            {candidate.name}
                            {isCurrentUser && <span className="ml-1 text-muted-foreground">(You)</span>}
                            </span>
                        </div>
                      </div>
                      <span className="text-muted-foreground font-medium">
                        {candidate.voteCount} votes ({percentage}%)
                      </span>
                    </div>
                    <Progress 
                        value={percentage} 
                        className={`h-2 ${isCurrentUser ? "bg-primary/20" : ""}`} 
                        indicatorClassName={isCurrentUser ? "bg-primary" : "bg-muted-foreground/50"} 
                    />
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CandidateDashboard;