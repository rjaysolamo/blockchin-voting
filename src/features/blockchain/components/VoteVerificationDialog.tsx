import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBlockchainVoting } from '../hooks/useBlockchainVoting';
import { VoteVerificationResult } from '@/@types/blockchain';
import { formatHashForDisplay } from '../lib/crypto';
import { CheckCircle2, XCircle, Search, Shield } from 'lucide-react';

interface VoteVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VoteVerificationDialog({ open, onOpenChange }: VoteVerificationDialogProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VoteVerificationResult | null>(null);
  const { verifyVote } = useBlockchainVoting();

  const handleVerify = async () => {
    if (!verificationCode.trim()) return;
    
    setIsVerifying(true);
    const verificationResult = await verifyVote(verificationCode.trim());
    setResult(verificationResult);
    setIsVerifying(false);
  };

  const handleClose = () => {
    setVerificationCode('');
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Verify Your Vote
          </DialogTitle>
          <DialogDescription>
            Enter your verification code to confirm your vote is recorded on the blockchain.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="verificationCode">Verification Code</Label>
            <div className="flex gap-2">
              <Input
                id="verificationCode"
                placeholder="XXXX-XXXX-XXXX"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                className="font-mono"
              />
              <Button onClick={handleVerify} disabled={isVerifying || !verificationCode.trim()}>
                {isVerifying ? 'Verifying...' : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {result && (
            <div className={`p-4 rounded-lg border ${
              result.verified 
                ? 'bg-success/10 border-success/20' 
                : 'bg-destructive/10 border-destructive/20'
            }`}>
              <div className="flex items-start gap-3">
                {result.verified ? (
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`font-medium ${result.verified ? 'text-success' : 'text-destructive'}`}>
                    {result.verified ? 'Vote Verified!' : 'Verification Failed'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {result.message}
                  </p>
                </div>
              </div>

              {result.verified && result.block && (
                <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Block Hash:</span>
                    <span className="font-mono">{formatHashForDisplay(result.block.current_hash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Timestamp:</span>
                    <span>{new Date(result.block.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Position:</span>
                    <span>{result.block.position}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Block #:</span>
                    <span>{result.block.block_number}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
