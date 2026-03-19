'use client';

import { useState, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
      selectedAddress: string | null;
      chainId: string | null;
    };
  }
}

interface WalletState {
  address: string | null;
  chainId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
}

interface UseWalletReturn {
  state: WalletState;
  connectWallet: (preferredAddress?: string) => Promise<string>;
  disconnectWallet: () => void;
  switchToBaseSepolia: () => Promise<void>;
}

export function useWallet(): UseWalletReturn {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    isConnected: false,
    isConnecting: false,
  });

  const BASE_SEPOLIA_CHAIN_ID = '0x14a34';

  const checkConnection = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_accounts',
      });

      if (accounts.length > 0) {
        const chainId = await window.ethereum.request({
          method: 'eth_chainId',
        });

        setState({
          address: accounts[0],
          chainId,
          isConnected: true,
          isConnecting: false,
        });
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  }, []);

  useEffect(() => {
    checkConnection();

    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setState({
            address: null,
            chainId: null,
            isConnected: false,
            isConnecting: false,
          });
        } else {
          setState(prev => ({
            ...prev,
            address: accounts[0],
            isConnected: true,
          }));
        }
      };

      const handleChainChanged = (chainId: string) => {
        setState(prev => ({
          ...prev,
          chainId,
        }));
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, [checkConnection]);

  const connectWallet = useCallback(async (preferredAddress?: string) => {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No EVM wallet detected. Please install MetaMask or a compatible wallet.');
    }

    setState(prev => ({ ...prev, isConnecting: true }));

    try {
      // Re-request account permission so wallet can show account selector.
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts?.length) {
        throw new Error('No wallet account returned. Please unlock your wallet and try again.');
      }

      const normalizedPreferred = preferredAddress?.toLowerCase();
      const matchedAccount =
        normalizedPreferred
          ? accounts.find((account: string) => account.toLowerCase() === normalizedPreferred)
          : undefined;
      const selectedAccount = matchedAccount || accounts[0];

      const chainId = await window.ethereum.request({
        method: 'eth_chainId',
      });

      setState({
        address: selectedAccount,
        chainId,
        isConnected: true,
        isConnecting: false,
      });
      return selectedAccount;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setState(prev => ({ ...prev, isConnecting: false }));
      throw error instanceof Error ? error : new Error('Failed to connect wallet.');
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setState({
      address: null,
      chainId: null,
      isConnected: false,
      isConnecting: false,
    });
  }, []);

  const switchToBaseSepolia = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('Please install MetaMask!');
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_SEPOLIA_CHAIN_ID }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: BASE_SEPOLIA_CHAIN_ID,
                chainName: 'Base Sepolia',
                rpcUrls: ['https://base-sepolia-rpc.publicnode.com'],
                nativeCurrency: {
                  name: 'Ethereum',
                  symbol: 'ETH',
                  decimals: 18,
                },
                blockExplorerUrls: ['https://sepolia.basescan.org'],
              },
            ],
          });
        } catch (addError) {
          console.error('Error adding Base Sepolia network:', addError);
        }
      }
      console.error('Error switching to Base Sepolia:', switchError);
    }
  }, []);

  return {
    state,
    connectWallet,
    disconnectWallet,
    switchToBaseSepolia,
  };
}
