'use client';

import { ReactNode } from 'react';
import { useSmartWallet } from '@/hooks/useSmartWallet';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, Wallet } from 'lucide-react';

interface WalletAuthGuardProps {
  children: ReactNode;
  message?: string;
}

export function WalletAuthGuard({ 
  children, 
  message = 'Your smart wallet is ready for voting'
}: WalletAuthGuardProps) {
  const { state } = useSmartWallet();

  // For automatic wallet system, we don't need connection states
  // The wallet is always available through deterministic generation

  if (state.error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg">
        <Wallet className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Wallet System Error</h3>
        <p className="text-muted-foreground text-center mb-4">
          {state.error}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}