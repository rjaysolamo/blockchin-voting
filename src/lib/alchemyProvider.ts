'use client';

// Alchemy Account Kit integration for smart wallet functionality
// Note: This requires manual installation of:
// npm install @alchemy/aa-core @alchemy/aa-alchemy @alchemy/aa-accounts viem --legacy-peer-deps

import { createWalletClient, custom, http } from 'viem';
import { sepolia } from 'viem/chains';
import {
  createModularAccountAlchemyClient,
  AlchemySmartAccountClient,
  SmartAccountSigner
} from '@alchemy/aa-alchemy';
import { walletClientToSmartAccountSigner } from '@alchemy/aa-core';

export interface AlchemyAccountConfig {
  apiKey: string;
  chain: typeof sepolia;
  entryPointAddress?: `0x${string}`;
}

export class AlchemyAccountProvider {
  private client: AlchemySmartAccountClient | null = null;
  private signer: SmartAccountSigner | null = null;

  constructor(private config: AlchemyAccountConfig) {}

  // Initialize the Alchemy smart account
  async initialize(): Promise<void> {
    try {
      // Check if ethereum provider is available (MetaMask, etc.)
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const walletClient = createWalletClient({
          chain: this.config.chain,
          transport: custom((window as any).ethereum)
        });

        this.signer = walletClientToSmartAccountSigner(walletClient);

        this.client = await createModularAccountAlchemyClient({
          apiKey: this.config.apiKey,
          chain: this.config.chain,
          signer: this.signer,
          entryPointAddress: this.config.entryPointAddress
        });
      } else {
        throw new Error('Ethereum provider not found. Please install MetaMask.');
      }
    } catch (error) {
      console.error('Failed to initialize Alchemy account:', error);
      throw error;
    }
  }

  // Get the smart account address
  async getAddress(): Promise<string> {
    if (!this.client) {
      await this.initialize();
    }
    return this.client!.getAddress();
  }

  // Sign a message with the smart account
  async signMessage(message: string): Promise<string> {
    if (!this.client) {
      await this.initialize();
    }
    return this.client!.signMessage({ message });
  }

  // Send a user operation (gas sponsored transaction)
  async sendUserOperation(
    target: string,
    data: string,
    value?: bigint
  ): Promise<string> {
    if (!this.client) {
      await this.initialize();
    }

    const result = await this.client!.sendUserOperation({
      uo: {
        target: target as `0x${string}`,
        data: data as `0x${string}`,
        value: value || BigInt(0)
      }
    });

    return result.hash;
  }

  // Check if account is initialized
  isInitialized(): boolean {
    return this.client !== null;
  }

  // Get the underlying client for advanced operations
  getClient(): AlchemySmartAccountClient | null {
    return this.client;
  }
}

// Factory function to create Alchemy account provider
export const createAlchemyAccountProvider = (apiKey: string) => {
  return new AlchemyAccountProvider({
    apiKey,
    chain: sepolia
  });
};