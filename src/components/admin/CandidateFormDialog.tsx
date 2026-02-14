import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Camera, Upload, X, Image as ImageIcon } from 'lucide-react';
import { Candidate } from '@/@types';
import ImageCropDialog from './ImageCropDialog';

interface CandidateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate?: Candidate | null;
  onSave: (candidate: Omit<Candidate, 'id' | 'voteCount'> & { id?: string }) => void;
  positions: string[];
}

const CandidateFormDialog = ({
  open,
  onOpenChange,
  candidate,
  onSave,
  positions,
}: CandidateFormDialogProps) => {
  const isEditing = !!candidate;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    name: candidate?.name || '',
    position: candidate?.position || '',
    description: candidate?.description || '',
    photo: candidate?.photo || '',
  });

  const [customPosition, setCustomPosition] = useState('');
  const [isCustomPosition, setIsCustomPosition] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Crop dialog state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState('');

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageToCrop(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleCropComplete = (croppedImageUrl: string) => {
    setFormData((prev) => ({ ...prev, photo: croppedImageUrl }));
    setImageToCrop('');
  };

  const handleRemovePhoto = () => {
    setFormData((prev) => ({ ...prev, photo: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalPosition = isCustomPosition ? customPosition : formData.position;

    onSave({
      ...(candidate?.id ? { id: candidate.id } : {}),
      name: formData.name,
      position: finalPosition,
      description: formData.description,
      photo: formData.photo || '/placeholder.svg',
    });

    // Reset form
    setFormData({ name: '', position: '', description: '', photo: '' });
    setCustomPosition('');
    setIsCustomPosition(false);
    onOpenChange(false);
  };

  const handlePositionChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomPosition(true);
      setFormData((prev) => ({ ...prev, position: '' }));
    } else {
      setIsCustomPosition(false);
      setFormData((prev) => ({ ...prev, position: value }));
    }
  };

  // Reset form when dialog opens with new candidate data
  const handleOpenChange = (open: boolean) => {
    if (open && candidate) {
      setFormData({
        name: candidate.name,
        position: candidate.position,
        description: candidate.description || '',
        photo: candidate.photo,
      });
      setIsCustomPosition(!positions.includes(candidate.position));
      if (!positions.includes(candidate.position)) {
        setCustomPosition(candidate.position);
      }
    } else if (open && !candidate) {
      setFormData({ name: '', position: '', description: '', photo: '' });
      setCustomPosition('');
      setIsCustomPosition(false);
    }
    onOpenChange(open);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Candidate' : 'Add New Candidate'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the candidate information below.'
                : 'Fill in the details to add a new candidate.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Photo Upload with Drag & Drop */}
            <div className="space-y-2">
              <Label>Profile Photo</Label>
              <div
                ref={dropZoneRef}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                {formData.photo ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <img
                        src={formData.photo}
                        alt="Candidate photo"
                        className="w-28 h-28 rounded-full object-cover border-2 border-border"
                      />
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="absolute -top-2 -right-2 w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 shadow-md"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Change Photo
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {isDragging ? 'Drop image here' : 'Drag & drop an image'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        or click to browse
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Select Photo
                    </Button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                  id="photo-upload"
                />
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Enter candidate name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            {/* Position */}
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Select
                value={isCustomPosition ? 'custom' : formData.position}
                onValueChange={handlePositionChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a position" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((pos) => (
                    <SelectItem key={pos} value={pos}>
                      {pos}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">+ Add Custom Position</SelectItem>
                </SelectContent>
              </Select>

              {isCustomPosition && (
                <Input
                  placeholder="Enter custom position"
                  value={customPosition}
                  onChange={(e) => setCustomPosition(e.target.value)}
                  required
                />
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description / Platform</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the candidate's platform..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Add Candidate'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Image Crop Dialog */}
      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        imageSrc={imageToCrop}
        onCropComplete={handleCropComplete}
      />
    </>
  );
};

export default CandidateFormDialog;
