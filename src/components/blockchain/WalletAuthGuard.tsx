'use client';

import { ReactNode, useEffect } from 'react';
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
  message = 'Your smart wallet is being connected automatically'
}: WalletAuthGuardProps) {
  const { state, connectSmartWallet } = useSmartWallet();

  // Auto-connect on component mount if not already connected
  useEffect(() => {
    if (!state.isConnected && !state.isLoading) {
      connectSmartWallet();
    }
  }, [state.isConnected, state.isLoading, connectSmartWallet]);

  if (state.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg">
        <Wallet className="w-12 h-12 text-muted-foreground mb-4 animate-pulse" />
        <h3 className="text-lg font-semibold mb-2">Connecting Smart Wallet</h3>
        <p className="text-muted-foreground text-center mb-4">
          {message}
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          Connecting...
        </div>
      </div>
    );
  }

  if (!state.isConnected) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg">
        <Wallet className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Smart Wallet Connection Failed</h3>
        <p className="text-muted-foreground text-center mb-4">
          Unable to automatically connect your smart wallet. Please try refreshing the page.
        </p>
        <Button onClick={connectSmartWallet} className="gap-2">
          <Wallet className="w-4 h-4" />
          Retry Connection
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}