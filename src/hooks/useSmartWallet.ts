'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSupabaseAuth } from './useSupabaseAuth';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  enrollEmbeddedPasskey,
  getEmbeddedSmartAccountClient,
  hasEmbeddedPasskey,
} from '@/lib/embeddedSmartAccountProvider';

type Hex = `0x${string}`;
type SmartAccountClientLike = {
  getAddress: (...args: unknown[]) => Promise<string>;
  signMessage: (args: { message: string }) => Promise<string>;
  sendUserOperation: (args: { uo: { target: Hex; data: Hex; value: bigint } }) => Promise<{ hash: Hex }>;
};

interface SmartWalletState {
  address: string | null;
  error: string | null;
  isConnected: boolean;
  isSmartAccount: boolean;
  isEnrolled: boolean;
}

interface UseSmartWalletReturn {
  state: SmartWalletState;
  signMessage: (message: string) => Promise<string | null>;
  sendUserOperation: (target: string, data: string, value?: bigint) => Promise<string | null>;
  connectSmartAccount: (opts?: { createIfMissing?: boolean }) => Promise<void>;
  enrollPasskey: () => Promise<void>;
  disconnect: () => void;
}

export function useSmartWallet(): UseSmartWalletReturn {
  const [state, setState] = useState<SmartWalletState>({
    address: null,
    error: null,
    isConnected: false,
    isSmartAccount: false,
    isEnrolled: false,
  });

  const { user } = useSupabaseAuth();
  const { toast } = useToast();

  const apiKey = useMemo(
    () =>
      ((import.meta.env.VITE_ALCHEMY_API_KEY as string | undefined)?.trim() ||
        (import.meta.env.VITE_ALCHEMY_APP_ID as string | undefined)?.trim()),
    []
  );
  const clientRef = useRef<SmartAccountClientLike | null>(null);

  const refreshEnrollment = useCallback(async (): Promise<void> => {
    if (!user?.id) return;
    try {
      const enrolled = await hasEmbeddedPasskey({ userId: user.id });
      setState((prev) => ({ ...prev, isEnrolled: enrolled }));
    } catch {
      // ignore
    }
  }, [user?.id]);

  const persistWalletAddress = useCallback(async (walletAddress: string): Promise<void> => {
    if (!user?.id) return;

    const normalizedWallet = walletAddress.trim().toLowerCase();
    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          wallet_address: normalizedWallet,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      throw new Error(`Failed to save wallet address to profile: ${error.message}`);
    }
  }, [user?.id]);

  const enrollPasskey = useCallback(async (): Promise<void> => {
    if (!user?.id) {
      setState((prev) => ({ ...prev, error: 'User session required to enroll passkey' }));
      return;
    }

    try {
      await enrollEmbeddedPasskey({ userId: user.id });
      await refreshEnrollment();

      // Immediately derive and persist smart account address after enrollment
      // so admin whitelist can find this user wallet in profiles.
      if (!apiKey) {
        throw new Error('Missing VITE_ALCHEMY_API_KEY');
      }
      const client = await getEmbeddedSmartAccountClient({
        apiKey,
        userId: user.id,
        createIfMissing: false,
      });
      clientRef.current = client as unknown as SmartAccountClientLike;
      const address = await clientRef.current.getAddress();
      await persistWalletAddress(address);
      setState((prev) => ({
        ...prev,
        address,
        isConnected: true,
        isSmartAccount: true,
      }));

      toast({
        title: 'Passkey Enrolled',
        description: 'Passkey enrolled and wallet address saved to your profile.',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to enroll passkey';
      setState((prev) => ({ ...prev, error: errorMessage }));
      toast({
        title: 'Passkey Enrollment Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [user?.id, toast, refreshEnrollment, apiKey, persistWalletAddress]);

  // Connect to Alchemy Smart Account
  const connectSmartAccount = useCallback(async (opts?: { createIfMissing?: boolean }): Promise<void> => {
    if (!user?.id) {
      setState({
        address: null,
        error: 'User session required to connect smart account',
        isConnected: false,
        isSmartAccount: false,
        isEnrolled: false,
      });
      return;
    }

    try {
      if (!apiKey) {
        throw new Error('Missing VITE_ALCHEMY_API_KEY');
      }

      const client = await getEmbeddedSmartAccountClient({
        apiKey,
        userId: user.id,
        // Production-grade flow: enrollment is separate. Only create if caller explicitly asks.
        createIfMissing: opts?.createIfMissing ?? false,
      });
      clientRef.current = client as unknown as SmartAccountClientLike;
      const address = await clientRef.current.getAddress();
      await persistWalletAddress(address);
      
      setState({
        address,
        error: null,
        isConnected: true,
        isSmartAccount: true,
        isEnrolled: true,
      });

      toast({
        title: 'Smart Account Connected',
        description: `Alchemy Smart Account: ${address.slice(0, 8)}...${address.slice(-6)}`,
      });
    } catch (error) {
      const rawErrorMessage = error instanceof Error ? error.message : 'Failed to connect smart account';
      const normalized = rawErrorMessage.toLowerCase();
      const network = (import.meta.env.VITE_BLOCKCHAIN_NETWORK || 'baseSepolia').trim();
      const errorMessage =
        normalized.includes('not enabled for this app') ||
        normalized.includes('getcounterfactualaddress failed') ||
        normalized.includes('403')
          ? `Alchemy rejected the smart wallet request (403). Enable ${network.toUpperCase()} for this Alchemy app and verify VITE_ALCHEMY_API_KEY + VITE_ALCHEMY_ACCOUNT_POLICY_ID.`
          : rawErrorMessage;
      setState({
        address: null,
        error: errorMessage,
        isConnected: false,
        isSmartAccount: false,
        isEnrolled: state.isEnrolled,
      });

      toast({
        title: 'Smart Account Connection Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [user?.id, toast, apiKey, state.isEnrolled, persistWalletAddress]);

  // Disconnect smart account
  const disconnect = useCallback((): void => {
    clientRef.current = null;
    setState({
      address: null,
      error: null,
      isConnected: false,
      isSmartAccount: false,
      isEnrolled: state.isEnrolled,
    });

    toast({
      title: 'Smart Account Disconnected',
      description: 'Your Alchemy Smart Account has been disconnected',
    });
  }, [toast, state.isEnrolled]);

  // Sign message with smart account
  const signMessage = useCallback(async (message: string): Promise<string | null> => {
    if (!state.isConnected) {
      return null;
    }

    try {
      const client = clientRef.current;
      if (!client) return null;
      return await client.signMessage({ message });
    } catch (error) {
      console.error('Failed to sign message:', error);
      return null;
    }
  }, [state.isConnected]);

  // Send user operation (gas-sponsored transaction)
  const sendUserOperation = useCallback(async (
    target: string,
    data: string,
    value?: bigint
  ): Promise<string | null> => {
    if (!state.isConnected) {
      return null;
    }

    try {
      const client = clientRef.current;
      if (!client) return null;
      const result = await client.sendUserOperation({
        uo: {
          target: target as Hex,
          data: data as Hex,
          value: value ?? BigInt(0),
        },
      });
      return result.hash as string;
    } catch (error) {
      console.error('Failed to send user operation:', error);
      return null;
    }
  }, [state.isConnected]);

  // Auto-connect when user session becomes available
  useEffect(() => {
    if (!user?.id) return;
    // Silent auto-connect: only if a passkey already exists on this device.
    void (async () => {
      try {
        const hasKey = await hasEmbeddedPasskey({ userId: user.id });
        setState((prev) => ({ ...prev, isEnrolled: hasKey }));
        if (!hasKey) return;
        await connectSmartAccount({ createIfMissing: false });
      } catch {
        // ignore auto-connect failures
      }
    })();
  }, [user?.id, connectSmartAccount]);

  return {
    state,
    signMessage,
    sendUserOperation,
    connectSmartAccount,
    enrollPasskey,
    disconnect,
  };
}
