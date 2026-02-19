'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSupabaseAuth } from './useSupabaseAuth';
import { useToast } from './use-toast';

interface SmartWalletState {
  isConnected: boolean;
  address: string | null;
  isLoading: boolean;
  error: string | null;
}

interface UseSmartWalletReturn {
  state: SmartWalletState;
  connectSmartWallet: () => Promise<void>;
  getSigner: () => Promise<any | null>;
  signMessage: (message: string) => Promise<string | null>;
}

// Declare global ethers for type safety
declare global {
  interface Window {
    ethers?: any;
  }
}

// Simple deterministic wallet generation from email + secret salt
export function useSmartWallet(): UseSmartWalletReturn {
  const [state, setState] = useState<SmartWalletState>({
    isConnected: false,
    address: null,
    isLoading: false,
    error: null,
  });

  const { user } = useSupabaseAuth();
  const { toast } = useToast();

  // Generate deterministic wallet from user email
  const generateWalletFromEmail = useCallback((email: string): any => {
    if (typeof window === 'undefined' || !window.ethers) {
      throw new Error('Ethers not available');
    }

    // Use a combination of email and application-specific salt for deterministic generation
    const salt = process.env.NEXT_PUBLIC_WALLET_SALT || 'blockchain-voting-salt-2024';
    const seed = window.ethers.keccak256(window.ethers.toUtf8Bytes(email + salt));
    
    return new window.ethers.Wallet(seed);
  }, []);

  const connectSmartWallet = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (!user?.email) {
        throw new Error('User email not available');
      }

      if (typeof window === 'undefined' || !window.ethers) {
        throw new Error('Ethers library not available');
      }

      // Generate wallet from user email
      const wallet = generateWalletFromEmail(user.email);
      
      setState({
        isConnected: true,
        address: wallet.address,
        isLoading: false,
        error: null,
      });

      toast({
        title: 'Smart Wallet Connected',
        description: `Your voting wallet: ${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect smart wallet';
      setState({
        isConnected: false,
        address: null,
        isLoading: false,
        error: errorMessage,
      });

      toast({
        title: 'Connection Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [user?.email, generateWalletFromEmail, toast]);

  const getSigner = useCallback(async (): Promise<any | null> => {
    if (!user?.email || !state.isConnected) {
      return null;
    }

    try {
      const wallet = generateWalletFromEmail(user.email);
      return wallet;
    } catch {
      return null;
    }
  }, [user?.email, state.isConnected, generateWalletFromEmail]);

  const signMessage = useCallback(async (message: string): Promise<string | null> => {
    if (!user?.email || !state.isConnected) {
      return null;
    }

    try {
      const wallet = generateWalletFromEmail(user.email);
      const signature = await wallet.signMessage(message);
      return signature;
    } catch {
      return null;
    }
  }, [user?.email, state.isConnected, generateWalletFromEmail]);

  // Auto-connect when user is available
  useEffect(() => {
    if (user?.email && !state.isConnected && !state.isLoading) {
      connectSmartWallet();
    }
  }, [user?.email, state.isConnected, state.isLoading, connectSmartWallet]);

  return {
    state,
    connectSmartWallet,
    getSigner,
    signMessage,
  };
}