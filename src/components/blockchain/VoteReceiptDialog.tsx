import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
VOTE RECEIPT
============
Date: ${new Date().toLocaleString()}
Position: ${position}
Candidate: ${candidateName}

VERIFICATION CODE: ${verificationCode}

Keep this code safe! You can use it to verify your vote was recorded correctly.
Visit the voting portal and use the "Verify Vote" feature.
    `.trim();

    const blob = new Blob([receipt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vote-receipt-${position.toLowerCase().replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Downloaded!',
      description: 'Vote receipt saved to your device',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mb-2">
            <CheckCircle2 className="w-6 h-6 text-success" />
          </div>
          <DialogTitle className="text-center">Vote Successfully Recorded!</DialogTitle>
          <DialogDescription className="text-center">
            Your vote for <strong>{candidateName}</strong> as <strong>{position}</strong> has been securely recorded on the blockchain.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">Your Verification Code</p>
          <p className="font-mono text-lg font-bold tracking-wider">{verificationCode}</p>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Save this code! You can use it to verify your vote was recorded correctly at any time.
        </p>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCopy} className="flex-1">
            <Copy className="w-4 h-4 mr-2" />
            Copy Code
          </Button>
          <Button onClick={handleDownload} className="flex-1">
            <Download className="w-4 h-4 mr-2" />
            Download Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
