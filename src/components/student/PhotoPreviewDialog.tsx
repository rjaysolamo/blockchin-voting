import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface PhotoPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  name: string;
  position: string;
}

const PhotoPreviewDialog = ({
  open,
  onOpenChange,
  imageSrc,
  name,
  position,
}: PhotoPreviewDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-10 w-8 h-8 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-background transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="flex flex-col items-center">
          {/* Photo */}
          <div className="w-full aspect-square bg-muted">
            {imageSrc && imageSrc !== '/placeholder.svg' ? (
              <img
                src={imageSrc}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <span className="text-8xl font-bold text-muted-foreground/50">
                  {name.charAt(0)}
                </span>
              </div>
            )}
          </div>
          
          {/* Info */}
          <div className="w-full p-6 text-center">
            <h3 className="text-xl font-semibold text-foreground">{name}</h3>
            <p className="text-muted-foreground mt-1">{position}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoPreviewDialog;
