import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { generateVoteHash, verifyChainIntegrity, formatHashForDisplay } from '@/lib/blockchain';
import { CheckCircle2, Hash, Clock, Shield, XCircle, Download, Calendar, Info } from 'lucide-react';
import { mockStats } from '@/api/mockData';

type VoteRecord = {
  block_number: number;
  previous_hash: string;
  current_hash: string;
  voter_id: string;
  candidate_id: string;
  election_id: string;
  position: string;
  timestamp: string;
  nonce: number;
};

type VerificationState = {
  vote: VoteRecord;
  hashValid: boolean;
  chainValid?: boolean;
};

const VerifyVote = () => {
  const { toast } = useToast();
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationState | null>(null);
  const [chainData, setChainData] = useState<VoteRecord[] | null>(null);
  const [lastVerifiedCode, setLastVerifiedCode] = useState('');

  const handleVerify = async () => {
    const trimmed = verificationCode.trim().toUpperCase();
    if (!trimmed) return;

    setIsVerifying(true);
    setResult(null);
    setChainData(null);
    setLastVerifiedCode(trimmed);

    const { data: voteData, error } = await (supabase.rpc as any)('get_vote_by_verification_code', {
      p_code: trimmed,
    });

    const vote = (Array.isArray(voteData) ? voteData[0] : voteData) as VoteRecord | null;

    if (error || !vote) {
      setIsVerifying(false);
      toast({
        title: 'Verification failed',
        description: 'No vote found with this verification code.',
        variant: 'destructive',
      });
      return;
    }

    const computedHash = await generateVoteHash({
      previousHash: vote.previous_hash,
      voterId: vote.voter_id,
      candidateId: vote.candidate_id,
      electionId: vote.election_id,
      position: vote.position,
      timestamp: vote.timestamp,
      nonce: vote.nonce,
    });

    const hashValid = computedHash === vote.current_hash;

    const { data: chainData } = await (supabase.rpc as any)('get_vote_chain_for_election', {
      p_election_id: vote.election_id,
    });

    let chainValid: boolean | undefined = undefined;
    if (Array.isArray(chainData) && chainData.length > 0) {
      const verification = await verifyChainIntegrity(chainData as VoteRecord[]);
      chainValid = verification.valid;
      setChainData(chainData as VoteRecord[]);
    }

    setResult({ vote, hashValid, chainValid });
    setIsVerifying(false);
  };

  const handleDownloadProof = () => {
    if (!result) return;
    const payload = {
      verificationCode: lastVerifiedCode,
      verifiedAt: new Date().toISOString(),
      hashValid: result.hashValid,
      chainValid: result.chainValid,
      block: result.vote,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vote-proof.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadChain = () => {
    if (!chainData || chainData.length === 0) return;
    const payload = {
      electionId: chainData[0].election_id,
      generatedAt: new Date().toISOString(),
      blocks: chainData,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'election-chain-proof.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 flex items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Verify Vote
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
                {isVerifying ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
          </div>

          {result && (
            <div className={`rounded-lg border p-4 space-y-4 ${
              result.hashValid && result.chainValid !== false
                ? 'bg-success/10 border-success/20'
                : 'bg-destructive/10 border-destructive/20'
            }`}>
              <div className="flex items-center gap-2">
                {result.hashValid && result.chainValid !== false ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <div className="font-medium">
                  {result.hashValid && result.chainValid !== false
                    ? 'Vote verified successfully'
                    : 'Vote integrity warning'}
                </div>
              </div>

              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">{formatHashForDisplay(result.vote.current_hash)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>Block #{result.vote.block_number}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{new Date(result.vote.timestamp).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Hash Status</span>
                  <span className={result.hashValid ? 'text-success' : 'text-destructive'}>
                    {result.hashValid ? 'Valid' : 'Mismatch'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Chain Status</span>
                  <span className={result.chainValid === false ? 'text-destructive' : 'text-success'}>
                    {result.chainValid === false ? 'Invalid' : 'Valid'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={handleDownloadProof} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download Proof
                </Button>
                <Button variant="outline" onClick={handleDownloadChain} disabled={!chainData?.length} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download Chain Proof
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4" />
                  Election Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Start</span>
                  <span>{new Date(mockStats.startDate).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>End</span>
                  <span>{new Date(mockStats.endDate).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="font-medium text-foreground">{mockStats.electionStatus}</span>
                </div>
                <div className="pt-2 text-xs text-muted-foreground">
                  Rules: One vote per position, verification codes are private, and results are published after close.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="h-4 w-4" />
                  Why Your Vote Is Secure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>Each vote is hashed and linked to the previous block.</div>
                <div>Any tampering breaks the chain and fails verification.</div>
                <div>Your verification code lets you confirm your vote without exposing identity.</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyVote;
