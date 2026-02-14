import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Candidate } from '@/@types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, User, ZoomIn, FileText } from 'lucide-react';
import PhotoPreviewDialog from './PhotoPreviewDialog';
import { cn } from '@/lib/utils';

interface CandidateCardProps {
  candidate: Candidate;
  onVote: (candidateId: string) => void;
  hasVoted: boolean;
  votedFor?: string;
  disabled?: boolean;
}

const CandidateCard = ({
  candidate,
  onVote,
  hasVoted,
  votedFor,
  disabled,
}: CandidateCardProps) => {
  const navigate = useNavigate();
  const isVotedFor = votedFor === candidate.id;
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasPhoto = candidate.photo && candidate.photo !== '/placeholder.svg';

  const handleViewProfile = () => {
    navigate(`/student/candidate/${candidate.id}`);
  };

  return (
    <>
      <Card 
        className={cn(
          "transition-all duration-200 hover:shadow-md h-full flex flex-col",
          isVotedFor ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"
        )}
      >
        <CardContent className="flex flex-col items-center text-center pt-6 flex-1">
          {/* Clickable Photo */}
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="relative group mb-4 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-full"
          >
            <Avatar className="w-24 h-24 border-2 border-border transition-transform group-hover:scale-105">
                <AvatarImage src={candidate.photo} alt={candidate.name} className="object-cover" />
                <AvatarFallback className="bg-muted">
                    <User className="w-10 h-10 text-muted-foreground" />
                </AvatarFallback>
            </Avatar>

            {/* Hover overlay */}
            <div className="absolute inset-0 rounded-full bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center">
              <ZoomIn className="w-6 h-6 text-background opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>

          <h3 className="font-semibold text-foreground text-lg">{candidate.name}</h3>
          <p className="text-sm text-primary font-medium mb-2">{candidate.position}</p>

          {candidate.description && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[2.5rem]">
              {candidate.description}
            </p>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewProfile}
            className="text-muted-foreground hover:text-foreground mb-2 mt-auto"
          >
            <FileText className="w-4 h-4 mr-1" />
            View Full Profile
          </Button>
        </CardContent>
        <CardFooter className="pt-0 pb-6">
             {isVotedFor ? (
            <Button disabled className="w-full bg-primary/20 text-primary hover:bg-primary/20" variant="secondary">
              <Check className="w-4 h-4 mr-2" />
              Voted
            </Button>
          ) : (
            <Button
              onClick={() => onVote(candidate.id)}
              disabled={hasVoted || disabled}
              className="w-full"
              variant={hasVoted ? 'secondary' : 'default'}
            >
              {hasVoted ? 'Already Voted' : 'Vote'}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Photo Preview Dialog */}
      <PhotoPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        imageSrc={candidate.photo}
        name={candidate.name}
        position={candidate.position}
      />
    </>
  );
};

export default CandidateCard;
