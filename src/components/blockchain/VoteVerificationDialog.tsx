import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBlockchainVoting } from '@/hooks/useBlockchainVoting';
import { VoteVerificationResult } from '@/@types/blockchain';
import { formatHashForDisplay } from '@/lib/blockchain';
import { CheckCircle2, XCircle, Search, Shield, Hash, Clock } from 'lucide-react';

interface VoteVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VoteVerificationDialog({ open, onOpenChange }: VoteVerificationDialogProps) {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VoteVerificationResult | null>(null);
  const { verifyVote } = useBlockchainVoting();

  const handleVerify = async () => {
    if (!code.trim()) return;
    
    setIsVerifying(true);
    const verificationResult = await verifyVote(code.trim());
    setResult(verificationResult);
    setIsVerifying(false);
  };

  const handleClose = () => {
    setCode('');
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Verify Your Vote
          </DialogTitle>
          <DialogDescription>
            Enter your verification code to confirm your vote was recorded correctly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verification-code">Verification Code</Label>
            <div className="flex gap-2">
              <Input
                id="verification-code"
                placeholder="XXXX-XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono"
              />
              <Button onClick={handleVerify} disabled={isVerifying || !code.trim()}>
                {isVerifying ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {result && (
            <div
              className={`p-4 rounded-lg border ${
                result.verified
                  ? 'bg-success/10 border-success/30'
                  : 'bg-destructive/10 border-destructive/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.verified ? (
                  <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${result.verified ? 'text-success' : 'text-destructive'}`}>
                    {result.verified ? 'Vote Verified!' : 'Verification Failed'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{result.message}</p>

                  {result.block && (
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Hash className="w-4 h-4" />
                        <span className="font-mono">{formatHashForDisplay(result.block.current_hash, 12)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{new Date(result.block.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-muted-foreground">
                        <span className="font-medium">Position:</span> {result.block.position}
                      </div>
                      <div className="text-muted-foreground">
                        <span className="font-medium">Block #:</span> {result.block.block_number}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
