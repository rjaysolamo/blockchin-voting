import { DbCandidate } from '@/@types/blockchain';
import { Button } from '@/components/ui/button';
import { User, CheckCircle2, Vote } from 'lucide-react';

interface CandidateCardProps {
  candidate: DbCandidate;
  onVote: (candidateId: string) => void;
  hasVotedForPosition: boolean;
  isVotedFor: boolean;
  disabled?: boolean;
}

export function CandidateCard({
  candidate,
  onVote,
  hasVotedForPosition,
  isVotedFor,
  disabled,
}: CandidateCardProps) {
  return (
    <div
      className={`voting-card transition-all duration-300 ${
        isVotedFor 
          ? 'ring-2 ring-success bg-success/5' 
          : hasVotedForPosition 
            ? 'opacity-60' 
            : 'hover:shadow-lg'
      }`}
    >
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          {candidate.photo_url ? (
            <img
              src={candidate.photo_url}
              alt={candidate.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-border"
            />
          ) : (
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground">{candidate.name}</h4>
          {candidate.department && (
            <p className="text-sm text-muted-foreground">{candidate.department}</p>
          )}
          {candidate.year_level && (
            <p className="text-xs text-muted-foreground">{candidate.year_level}</p>
          )}
        </div>
      </div>

      {candidate.manifesto && (
        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
          {candidate.manifesto}
        </p>
      )}

      <div className="mt-4">
        {isVotedFor ? (
          <div className="flex items-center justify-center gap-2 text-success py-2">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Your Vote</span>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onVote(candidate.id)}
            disabled={hasVotedForPosition || disabled}
          >
            <Vote className="w-4 h-4 mr-2" />
            {hasVotedForPosition ? 'Already Voted' : 'Vote'}
          </Button>
        )}
      </div>
    </div>
  );
}
