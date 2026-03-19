import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCandidateById } from '@/api';
import { Candidate } from '@/@types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  User, 
  GraduationCap, 
  Calendar,
  Target,
  Award,
  Vote
} from 'lucide-react';
import DashboardLayout from '@/templates/DashboardLayout';

const CandidateDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [candidate, setCandidate] = useState<Candidate | null>(null);

  useEffect(() => {
    if (!id) return;
    getCandidateById(id)
      .then((res) => setCandidate(res.data))
      .catch(() => setCandidate(null));
  }, [id]);

  if (!candidate) {
    return (
      <DashboardLayout title="Candidate Not Found">
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
          <h1 className="text-2xl font-bold">Candidate Not Found</h1>
          <Button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Candidate Profile">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <Button 
            variant="ghost" 
            className="mb-4 pl-0 hover:bg-transparent hover:text-primary" 
            onClick={() => navigate(-1)}
        >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Voting
        </Button>

        <Card>
            <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="flex-shrink-0 mx-auto md:mx-0">
                         <Avatar className="w-40 h-40 rounded-2xl border-2 border-border">
                            <AvatarImage src={candidate.photo} alt={candidate.name} className="object-cover" />
                            <AvatarFallback className="rounded-2xl text-4xl bg-muted">
                                <User className="w-16 h-16 text-muted-foreground" />
                            </AvatarFallback>
                        </Avatar>
                    </div>
                    
                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div>
                            <Badge variant="secondary" className="mb-2 text-sm">{candidate.position}</Badge>
                            <h1 className="text-3xl font-bold text-foreground">{candidate.name}</h1>
                        </div>
                        
                        <p className="text-muted-foreground text-lg leading-relaxed">{candidate.description}</p>
                        
                         <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm text-muted-foreground">
                            {candidate.major && (
                            <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-full">
                                <GraduationCap className="w-4 h-4" />
                                {candidate.major}
                            </div>
                            )}
                            {candidate.year && (
                            <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-full">
                                <Calendar className="w-4 h-4" />
                                {candidate.year}
                            </div>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Manifesto / Qualifications */}
            <Card className="h-full">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-primary" />
                        <CardTitle>Qualifications</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {candidate.qualifications && candidate.qualifications.length > 0 ? (
                        <ul className="space-y-4">
                             {candidate.qualifications.map((qual, index) => (
                                <li key={index} className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                                    <div>
                                        <h3 className="font-medium text-foreground">{qual.title}</h3>
                                        <p className="text-sm text-muted-foreground">{qual.description}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground italic">No qualifications listed.</p>
                    )}
                </CardContent>
            </Card>

            {/* Goals */}
            <Card className="h-full">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        <CardTitle>Goals & Promises</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                     {candidate.goals && candidate.goals.length > 0 ? (
                         <div className="space-y-4">
                            {candidate.goals.map((goal, index) => (
                                <div key={index} className="bg-muted/30 p-4 rounded-lg border border-border/50">
                                    <h3 className="font-medium text-foreground mb-1">{goal.title}</h3>
                                    <p className="text-sm text-muted-foreground">{goal.description}</p>
                                </div>
                            ))}
                        </div>
                     ) : (
                         <p className="text-muted-foreground italic">No goals listed.</p>
                     )}
                </CardContent>
            </Card>
        </div>
        
         <div className="flex justify-center pt-4 pb-8">
            <Button size="lg" className="w-full sm:w-auto px-8" onClick={() => navigate('/student/dashboard')}>
                <Vote className="w-4 h-4 mr-2" />
                Return to Voting
            </Button>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default CandidateDetailPage;
