import { Candidate } from '@/@types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  User, 
  Download, 
  Trash2, 
  ArrowRight, 
  AlertCircle,
  Edit2,
  X
} from 'lucide-react';

interface BallotSummaryProps {
  votedCandidates: Record<string, string>;
  positions: string[];
  candidates: Candidate[];
  onSaveDraft: () => void;
  onClearDraft: () => void;
  onReview: () => void;
  onEdit: (position: string) => void;
  onClose: () => void;
  draftSavedAt: string | null;
  showCloseButton?: boolean;
}

const BallotSummary = ({
  votedCandidates,
  positions,
  candidates,
  onSaveDraft,
  onClearDraft,
  onReview,
  onEdit,
  onClose,
  draftSavedAt,
  showCloseButton = true
}: BallotSummaryProps) => {
  const totalPositions = positions.length;
  const votedCount = Object.keys(votedCandidates).length;
  const progress = Math.round((votedCount / totalPositions) * 100);

  return (
    <Card className="max-w-4xl mx-auto mb-8 border-t-4 border-t-primary shadow-lg animate-fade-in">
      <CardHeader className="border-b bg-muted/30 pb-6 relative">
        {showCloseButton && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        )}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <span className="bg-primary/10 p-2 rounded-full">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </span>
              My Ballot
            </CardTitle>
            <CardDescription className="mt-2 text-base">
              You have selected {votedCount} of {totalPositions} positions.
            </CardDescription>
          </div>
          <div className="w-full md:w-1/3 space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {positions.map((position) => {
            const candidateId = votedCandidates[position];
            const candidate = candidates.find((c) => c.id === candidateId);
            const isSelected = !!candidate;

            return (
              <div 
                key={position} 
                className={`
                  relative overflow-hidden rounded-xl border transition-all duration-200
                  ${isSelected 
                    ? 'border-primary/50 bg-card hover:shadow-md hover:border-primary' 
                    : 'border-dashed border-muted-foreground/30 bg-muted/10 hover:bg-muted/20'
                  }
                `}
              >
                {isSelected && (
                  <div className="absolute top-0 right-0 p-2">
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                      Selected
                    </Badge>
                  </div>
                )}
                
                <div className="p-4 flex items-start gap-4">
                  {isSelected ? (
                    <Avatar className="w-16 h-16 border-2 border-background shadow-sm">
                      <AvatarImage src={candidate?.photo} alt={candidate?.name} className="object-cover" />
                      <AvatarFallback className="bg-primary/10">
                        <User className="w-8 h-8 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/20">
                      <User className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      {position}
                    </p>
                    {isSelected ? (
                      <>
                        <h4 className="font-bold text-lg truncate">{candidate?.name}</h4>
                        <p className="text-sm text-muted-foreground truncate">
                          {candidate?.major || 'Candidate'}
                        </p>
                      </>
                    ) : (
                      <>
                        <h4 className="font-medium text-muted-foreground">No selection yet</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Please select a candidate
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-muted/30 p-2 flex justify-end border-t">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-xs gap-1 hover:text-primary"
                    onClick={() => onEdit(position)}
                  >
                    {isSelected ? (
                      <>
                        <Edit2 className="w-3 h-3" /> Change Selection
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-3 h-3" /> Make Selection
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
      
      <CardFooter className="bg-muted/10 py-6 border-t flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground order-2 sm:order-1">
          {draftSavedAt ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              Draft saved {new Date(draftSavedAt).toLocaleTimeString()}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-3 justify-center order-1 sm:order-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={onClearDraft} className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={onSaveDraft}>
            <Download className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          <Button size="sm" onClick={onReview} className="px-6 shadow-md hover:shadow-lg transition-all">
            Review & Submit
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default BallotSummary;
