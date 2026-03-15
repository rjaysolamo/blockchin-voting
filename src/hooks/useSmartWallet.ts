'use client';

import { useState, useCallback } from 'react';
import { useSupabaseAuth } from './useSupabaseAuth';
import { useToast } from './use-toast';

interface SmartWalletState {
  address: string | null;
  error: string | null;
  isConnected: boolean;
  isSmartAccount: boolean;
}

interface UseSmartWalletReturn {
  state: SmartWalletState;
  getSigner: () => Promise<any | null>;
  signMessage: (message: string) => Promise<string | null>;
  sendUserOperation: (target: string, data: string, value?: bigint) => Promise<string | null>;
  connectSmartAccount: () => Promise<void>;
  disconnect: () => void;
}

// Alchemy Account Kit integration
const useAlchemyAccountKit = () => {
  // This will be properly implemented once dependencies are installed
  return {
    initialize: async (email: string): Promise<void> => {
      throw new Error('Alchemy Account Kit dependencies not installed. Run: npm install @alchemy/aa-core @alchemy/aa-alchemy @alchemy/aa-accounts viem --legacy-peer-deps');
    },
    getAddress: async (): Promise<string> => {
      throw new Error('Alchemy Account Kit not initialized');
    },
    signMessage: async (message: string): Promise<string> => {
      throw new Error('Alchemy Account Kit not initialized');
    },
    sendUserOperation: async (target: string, data: string, value?: bigint): Promise<string> => {
      throw new Error('Alchemy Account Kit not initialized');
    },
    getSigner: async (): Promise<any> => {
      throw new Error('Alchemy Account Kit not initialized');
    },
    disconnect: (): void => {
      // No-op for placeholder
    }
  };
};

// Pure Alchemy Smart Account implementation
export function useSmartWallet(): UseSmartWalletReturn {
  const [state, setState] = useState<SmartWalletState>({
    address: null,
    error: null,
    isConnected: false,
    isSmartAccount: false,
  });

  const { user } = useSupabaseAuth();
  const { toast } = useToast();

  // Alchemy Account Kit instance
  const alchemy = useAlchemyAccountKit();

  // Connect to Alchemy Smart Account
  const connectSmartAccount = useCallback(async (): Promise<void> => {
    if (!user?.email) {
      setState({
        address: null,
        error: 'User email required to connect smart account',
        isConnected: false,
        isSmartAccount: false,
      });
      return;
    }

    try {
      // Initialize Alchemy Smart Account with user email
      await alchemy.initialize(user.email);
      
      // Get the smart account address
      const address = await alchemy.getAddress();
      
      setState({
        address,
        error: null,
        isConnected: true,
        isSmartAccount: true,
      });

      toast({
        title: 'Smart Account Connected',
        description: `Alchemy Smart Account: ${address.slice(0, 8)}...${address.slice(-6)}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect smart account';
      setState({
        address: null,
        error: errorMessage,
        isConnected: false,
        isSmartAccount: false,
      });

      toast({
        title: 'Smart Account Connection Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [user?.email, toast, alchemy]);

  // Disconnect smart account
  const disconnect = useCallback((): void => {
    alchemy.disconnect();
    setState({
      address: null,
      error: null,
      isConnected: false,
      isSmartAccount: false,
    });

    toast({
      title: 'Smart Account Disconnected',
      description: 'Your Alchemy Smart Account has been disconnected',
    });
  }, [alchemy, toast]);

  // Get signer for the smart account
  const getSigner = useCallback(async (): Promise<any | null> => {
    if (!state.isConnected) {
      return null;
    }

    try {
      return await alchemy.getSigner();
    } catch (error) {
      console.error('Failed to get signer:', error);
      return null;
    }
  }, [state.isConnected, alchemy]);

  // Sign message with smart account
  const signMessage = useCallback(async (message: string): Promise<string | null> => {
    if (!state.isConnected) {
      return null;
    }

    try {
      return await alchemy.signMessage(message);
    } catch (error) {
      console.error('Failed to sign message:', error);
      return null;
    }
  }, [state.isConnected, alchemy]);

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
      return await alchemy.sendUserOperation(target, data, value);
    } catch (error) {
      console.error('Failed to send user operation:', error);
      return null;
    }
  }, [state.isConnected, alchemy]);

  return {
    state,
    getSigner,
    signMessage,
    sendUserOperation,
    connectSmartAccount,
    disconnect,
  };
}