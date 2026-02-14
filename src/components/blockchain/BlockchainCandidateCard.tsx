import { DbCandidate } from '@/@types/blockchain';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlockchainCandidateCardProps {
  candidate: DbCandidate;
  onVote: (candidateId: string) => void;
  hasVotedForPosition: boolean;
  isVotedFor: boolean;
  disabled?: boolean;
}

export function BlockchainCandidateCard({
  candidate,
  onVote,
  hasVotedForPosition,
  isVotedFor,
  disabled,
}: BlockchainCandidateCardProps) {
  return (
    <Card
      className={cn(
        "transition-all duration-200 h-full flex flex-col hover:shadow-md",
        isVotedFor ? 'ring-2 ring-success ring-offset-2 border-success' : 'hover:border-primary/50',
        hasVotedForPosition && !isVotedFor ? 'opacity-50' : ''
      )}
    >
      <CardContent className="p-6 flex items-start gap-4 flex-1">
         {isVotedFor && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-success rounded-full flex items-center justify-center z-10">
            <CheckCircle2 className="w-4 h-4 text-success-foreground" />
            </div>
        )}
        
        <Avatar className="h-16 w-16 rounded-lg border border-border">
            <AvatarImage src={candidate.photo_url} alt={candidate.name} className="object-cover" />
            <AvatarFallback className="rounded-lg bg-muted">
                <User className="w-8 h-8 text-muted-foreground" />
            </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 space-y-1">
          <h4 className="font-semibold text-foreground truncate text-lg">{candidate.name}</h4>
          <p className="text-sm text-muted-foreground">
            {candidate.department}
            {candidate.year_level && ` • ${candidate.year_level}`}
          </p>
          {candidate.manifesto && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {candidate.manifesto}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-0 pb-6">
        {hasVotedForPosition ? (
          isVotedFor ? (
            <div className="w-full flex items-center justify-center gap-2 py-2 text-success text-sm font-medium bg-success/10 rounded-md">
              <CheckCircle2 className="w-4 h-4" />
              You voted for this candidate
            </div>
          ) : (
            <Button variant="outline" className="w-full" disabled>
              Vote Submitted
            </Button>
          )
        ) : (
          <Button
            className="w-full"
            onClick={() => onVote(candidate.id)}
            disabled={disabled}
          >
            Vote for {candidate.name}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
