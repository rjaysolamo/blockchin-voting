'use client';

import { ReactNode } from 'react';
import { useSmartWallet } from '@/hooks/useSmartWallet';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, Wallet, AlertCircle } from 'lucide-react';

interface WalletAuthGuardProps {
  children: ReactNode;
  requiredChainId?: string;
  message?: string;
}

export function WalletAuthGuard({ 
  children, 
  requiredChainId = '0x14a34', // Base Sepolia (not needed for smart wallets)
  message = 'Please connect your smart wallet to continue'
}: WalletAuthGuardProps) {
  const { state, connectSmartWallet } = useSmartWallet();

  if (!state.isConnected) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg">
        <Wallet className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Smart Wallet Required</h3>
        <p className="text-muted-foreground text-center mb-4">
          {message}
        </p>
        <Button onClick={connectSmartWallet} className="gap-2">
          <Wallet className="w-4 h-4" />
          Connect Smart Wallet
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}