import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Copy, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VoteReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verificationCode: string;
  candidateName: string;
  position: string;
}

export function VoteReceiptDialog({
  open,
  onOpenChange,
  verificationCode,
  candidateName,
  position,
}: VoteReceiptDialogProps) {
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(verificationCode);
    toast({
      title: 'Copied!',
      description: 'Verification code copied to clipboard',
    });
  };

  const handleDownload = () => {
    const receipt = `
BLOCKCHAIN VOTE RECEIPT
=======================
Date: ${new Date().toLocaleString()}
Position: ${position}
Candidate: ${candidateName}
Verification Code: ${verificationCode}

Keep this code safe! You can use it to verify your vote at any time.
    `.trim();

    const blob = new Blob([receipt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vote-receipt-${position.toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-success">
            <CheckCircle2 className="w-5 h-5" />
            Vote Recorded Successfully!
          </DialogTitle>
          <DialogDescription>
            Your vote for <strong>{candidateName}</strong> as <strong>{position}</strong> has been securely recorded on the blockchain.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-2">Your Verification Code:</p>
          <div className="bg-muted p-4 rounded-lg text-center">
            <p className="font-mono text-lg font-bold tracking-wider">{verificationCode}</p>
          </div>
          
          <p className="text-xs text-muted-foreground mt-3">
            Save this code! You can use it to verify your vote was recorded correctly.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleCopy}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Code
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
