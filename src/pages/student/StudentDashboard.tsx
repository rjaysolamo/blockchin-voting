import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { mockCandidates, mockStats } from '@/api/mockData';
import CandidateCard from '@/components/student/CandidateCard';
import ElectionCountdown from '@/components/student/ElectionCountdown';
import { Button } from '@/components/ui/button';
import { CheckCircle2, GitCompare, Calendar, MapPin, ClipboardCheck, Download, Eye, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/templates/DashboardLayout';
import { useEvents } from '@/features/attendance/hooks/useAttendance';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

import BallotSummary from '@/components/student/BallotSummary';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const [hasVoted, setHasVoted] = useState(false);
  const [reviewBallot, setReviewBallot] = useState(false);
  const [votedCandidates, setVotedCandidates] = useState<Record<string, string>>({});
  const [showBallotSummary, setShowBallotSummary] = useState(false);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [highContrast, setHighContrast] = useState(false);
  const [onboarding, setOnboarding] = useState({
    profile: false,
    compare: false,
    vote: false,
    review: false,
  });
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    candidateId: string;
    candidateName: string;
    position: string;
  }>({ open: false, candidateId: '', candidateName: '', position: '' });

  const positions = [...new Set(mockCandidates.map((c) => c.position))];
  const isElectionOpen = mockStats.electionStatus === 'open';
  
  // Election end date - in production this would come from the API
  const electionEndDate = new Date(mockStats.endDate);

  const handleEditSelection = (position: string) => {
    setShowBallotSummary(false);
    // Use setTimeout to allow state update and re-render to reveal the list
    setTimeout(() => {
      const element = document.getElementById(`position-${position}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add a highlight effect temporarily
        element.classList.add('ring-2', 'ring-primary', 'rounded-lg', 'p-2', 'transition-all');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-primary', 'rounded-lg', 'p-2');
        }, 2000);
      }
    }, 100);
  };

  useEffect(() => {
    const savedDraft = localStorage.getItem('student-ballot-draft');
    if (savedDraft) {
      setVotedCandidates(JSON.parse(savedDraft));
    }
    const savedPrefs = localStorage.getItem('student-accessibility');
    if (savedPrefs) {
      const parsed = JSON.parse(savedPrefs);
      setFontSize(parsed.fontSize || 'base');
      setHighContrast(!!parsed.highContrast);
    }
    const savedOnboarding = localStorage.getItem('student-onboarding');
    if (savedOnboarding) {
      setOnboarding(JSON.parse(savedOnboarding));
    }
    const savedDraftTime = localStorage.getItem('student-ballot-draft-saved-at');
    if (savedDraftTime) {
      setDraftSavedAt(savedDraftTime);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('student-accessibility', JSON.stringify({ fontSize, highContrast }));
  }, [fontSize, highContrast]);

  useEffect(() => {
    localStorage.setItem('student-onboarding', JSON.stringify(onboarding));
  }, [onboarding]);

  const upcomingEvents = events
    .filter((event) => new Date(event.event_date) >= new Date())
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
    .slice(0, 4);

  const handleVoteClick = (candidateId: string) => {
    const candidate = mockCandidates.find((c) => c.id === candidateId);
    if (candidate) {
      setConfirmDialog({
        open: true,
        candidateId,
        candidateName: candidate.name,
        position: candidate.position,
      });
    }
  };

  const confirmVote = () => {
    setVotedCandidates((prev) => ({
      ...prev,
      [confirmDialog.position]: confirmDialog.candidateId,
    }));

    toast({
      title: 'Vote recorded',
      description: `Your vote for ${confirmDialog.candidateName} has been submitted.`,
    });

    setConfirmDialog({ open: false, candidateId: '', candidateName: '', position: '' });

    // Check if voted for all positions
    const newVotedPositions = { ...votedCandidates, [confirmDialog.position]: confirmDialog.candidateId };
    if (Object.keys(newVotedPositions).length === positions.length) {
      setReviewBallot(true);
    }
  };

  const handleSaveDraft = () => {
    localStorage.setItem('student-ballot-draft', JSON.stringify(votedCandidates));
    const timestamp = new Date().toISOString();
    localStorage.setItem('student-ballot-draft-saved-at', timestamp);
    setDraftSavedAt(timestamp);
    toast({
      title: 'Draft saved',
      description: 'Your ballot draft is saved locally on this device.',
    });
  };

  const handleClearDraft = () => {
    localStorage.removeItem('student-ballot-draft');
    localStorage.removeItem('student-ballot-draft-saved-at');
    setDraftSavedAt(null);
    toast({
      title: 'Draft cleared',
      description: 'Saved draft has been removed.',
    });
  };

  const handleDownloadReceipt = () => {
    const selected = positions.map((position) => {
      const candidateId = votedCandidates[position];
      const candidate = mockCandidates.find((c) => c.id === candidateId);
      return {
        position,
        candidate: candidate?.name || 'No selection',
      };
    });
    const payload = {
      voter: user?.name || 'Student',
      submittedAt: new Date().toISOString(),
      selections: selected,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ballot-receipt.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout title="Student Dashboard">
        <div
          className={highContrast ? 'filter contrast-125' : undefined}
          style={{
            fontSize: fontSize === 'sm' ? '14px' : fontSize === 'lg' ? '18px' : '16px',
          }}
        >
        {!isElectionOpen ? (
          <Card className="max-w-2xl mx-auto mt-8">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <h2 className="text-xl font-semibold mb-2">Election Closed</h2>
              <p className="text-muted-foreground">
                The election is currently closed. Please check back later.
              </p>
            </CardContent>
          </Card>
        ) : hasVoted ? (
          <Card className="max-w-2xl mx-auto mt-8 animate-fade-in">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Thank You for Voting!</h2>
              <p className="text-muted-foreground">
                Your votes have been successfully recorded. Results will be announced after the election ends.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={handleDownloadReceipt} className="gap-2">
                  <Download className="w-4 h-4" />
                  Download Receipt
                </Button>
                <Button variant="outline" onClick={() => setShowBallotSummary((prev) => !prev)} className="gap-2">
                  <Eye className="w-4 h-4" />
                  My Ballot
                </Button>
              </div>
              {showBallotSummary && (
                <div className="w-full mt-6 space-y-3 text-left">
                  {positions.map((position) => {
                    const candidateId = votedCandidates[position];
                    const candidate = mockCandidates.find((c) => c.id === candidateId);
                    return (
                      <div key={position} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm text-muted-foreground">{position}</p>
                          <p className="font-medium">{candidate?.name || 'No selection'}</p>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-8 bg-card rounded-lg border shadow-sm p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Welcome, {user?.name}
                  </h2>
                  <p className="text-muted-foreground">
                    Cast your vote for each position. You can only vote once per position.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success rounded-full text-sm font-medium">
                      <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                      Election is Open
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate('/student/compare')}
                      className="gap-2"
                    >
                      <GitCompare className="w-4 h-4" />
                      Compare Candidates
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/student/attendance')}
                      className="gap-2"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      My Attendance
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBallotSummary((prev) => !prev)}
                      className="gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      My Ballot
                    </Button>
                  </div>
                </div>
                <div className="lg:min-w-[360px]">
                  <ElectionCountdown endDate={electionEndDate} />
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-5 w-5" />
                <h3 className="text-lg font-semibold text-foreground">Upcoming Events</h3>
              </div>
              {eventsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((item) => (
                    <div key={item} className="h-24 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : upcomingEvents.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto opacity-50 mb-2" />
                    <p>No upcoming events yet</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingEvents.map((event) => (
                    <Card key={event.id}>
                      <CardContent className="pt-4 pb-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-foreground">{event.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(event.event_date), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                          {event.is_active && (
                            <Badge className="bg-success text-success-foreground">Active</Badge>
                          )}
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Accessibility</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant={fontSize === 'sm' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setFontSize('sm')}
                    >
                      Small Text
                    </Button>
                    <Button
                      variant={fontSize === 'base' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setFontSize('base')}
                    >
                      Default Text
                    </Button>
                    <Button
                      variant={fontSize === 'lg' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setFontSize('lg')}
                    >
                      Large Text
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">High Contrast</p>
                      <p className="text-sm text-muted-foreground">Improve readability across the dashboard</p>
                    </div>
                    <Switch checked={highContrast} onCheckedChange={setHighContrast} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Getting Started</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { key: 'profile', label: 'Review your profile details' },
                      { key: 'compare', label: 'Compare candidates' },
                      { key: 'vote', label: 'Select candidates for each position' },
                      { key: 'review', label: 'Review and submit your ballot' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className={`w-4 h-4 ${onboarding[item.key as keyof typeof onboarding] ? 'text-success' : 'text-muted-foreground'}`} />
                          <span className={onboarding[item.key as keyof typeof onboarding] ? 'font-medium' : 'text-muted-foreground'}>
                            {item.label}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant={onboarding[item.key as keyof typeof onboarding] ? 'secondary' : 'outline'}
                          onClick={() => setOnboarding((prev) => ({
                            ...prev,
                            [item.key]: !prev[item.key as keyof typeof onboarding],
                          }))}
                        >
                          {onboarding[item.key as keyof typeof onboarding] ? 'Done' : 'Mark done'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Dialog open={showBallotSummary} onOpenChange={setShowBallotSummary}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-transparent border-none shadow-none">
                <DialogHeader className="sr-only">
                  <DialogTitle>My Ballot Summary</DialogTitle>
                </DialogHeader>
                <BallotSummary
                  votedCandidates={votedCandidates}
                  positions={positions}
                  candidates={mockCandidates}
                  onSaveDraft={handleSaveDraft}
                  onClearDraft={handleClearDraft}
                  onReview={() => {
                    setReviewBallot(true);
                    setShowBallotSummary(false);
                  }}
                  onEdit={handleEditSelection}
                  onClose={() => setShowBallotSummary(false)}
                  draftSavedAt={draftSavedAt}
                  showCloseButton={false}
                />
              </DialogContent>
            </Dialog>

            {reviewBallot ? (
              <Card className="max-w-3xl mx-auto">
                <CardContent className="py-8 space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold">Review Ballot</h2>
                    <p className="text-muted-foreground mt-2">
                      Once submitted, your vote cannot be changed.
                    </p>
                  </div>
                  <div className="space-y-4">
                    {positions.map((position) => {
                      const candidateId = votedCandidates[position];
                      const candidate = mockCandidates.find((c) => c.id === candidateId);
                      return (
                        <div key={position} className="flex items-center justify-between rounded-lg border p-4">
                          <div>
                            <p className="text-sm text-muted-foreground">{position}</p>
                            <p className="font-medium">{candidate?.name || 'No selection'}</p>
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button variant="outline" onClick={() => setReviewBallot(false)}>
                      Edit Choices
                    </Button>
                    <Button variant="outline" onClick={handleSaveDraft}>
                      Save Draft
                    </Button>
                    <Button onClick={() => setHasVoted(true)}>
                      Submit Ballot
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              positions.map((position) => {
                const candidates = mockCandidates.filter((c) => c.position === position);
                const hasVotedForPosition = !!votedCandidates[position];

                return (
                  <section key={position} id={`position-${position}`} className="mb-10 transition-colors duration-500">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-foreground">{position}</h3>
                      {hasVotedForPosition && (
                        <span className="text-sm text-success flex items-center gap-1 font-medium bg-success/10 px-2 py-1 rounded">
                          <CheckCircle2 className="w-4 h-4" />
                          Vote submitted
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {candidates.map((candidate) => (
                        <CandidateCard
                          key={candidate.id}
                          candidate={candidate}
                          onVote={handleVoteClick}
                          hasVoted={hasVotedForPosition}
                          votedFor={votedCandidates[position]}
                        />
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </>
        )}
        </div>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Your Vote</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to vote for <strong>{confirmDialog.candidateName}</strong> for the position of <strong>{confirmDialog.position}</strong>. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmVote}>Confirm Vote</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default StudentDashboard;
