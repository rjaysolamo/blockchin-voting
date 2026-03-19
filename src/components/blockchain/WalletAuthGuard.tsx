'use client';

import { ReactNode } from 'react';
import { useSmartWallet } from '@/hooks/useSmartWallet';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Wallet } from 'lucide-react';

interface WalletAuthGuardProps {
  children: ReactNode;
  message?: string;
  onEnrollPasskey?: () => Promise<void> | void;
  isEnrollmentInProgress?: boolean;
  requireConnected?: boolean;
  isAuthorized?: boolean;
  unauthorizedMessage?: string;
}

export function WalletAuthGuard({ 
  children, 
  message = 'Your smart wallet is ready for voting',
  onEnrollPasskey,
  isEnrollmentInProgress = false,
  requireConnected = true,
  isAuthorized = true,
  unauthorizedMessage = 'Your on-chain voter access is still being prepared. Please wait a moment and try again.',
}: WalletAuthGuardProps) {
  const { state } = useSmartWallet();

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

  if (!state.isEnrolled) {
    return (
      <Alert className="mb-4">
        <AlertTitle>Passkey required</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>Enroll a passkey on this device before casting an on-chain vote.</p>
          {onEnrollPasskey && (
            <button
              type="button"
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
              onClick={() => void onEnrollPasskey()}
              disabled={isEnrollmentInProgress}
            >
              {isEnrollmentInProgress ? 'Enrolling passkey...' : 'Enroll passkey'}
            </button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (requireConnected && !state.isConnected) {
    return (
      <Alert className="mb-4">
        <AlertTitle>Smart wallet connection in progress</AlertTitle>
        <AlertDescription>
          Your passkey is enrolled. We are reconnecting your smart account.
        </AlertDescription>
      </Alert>
    );
  }

  if (!isAuthorized) {
    return (
      <Alert className="mb-4">
        <AlertTitle>On-chain authorization pending</AlertTitle>
        <AlertDescription>{unauthorizedMessage}</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {state.isConnected && (
        <Alert className="mb-4">
          <AlertTitle>Smart wallet ready</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {children}
    </>
  );
}
