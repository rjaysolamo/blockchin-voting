'use client';

import { useState, useCallback } from 'react';
import { useSmartWallet } from './useSmartWallet';
import { useToast } from './use-toast';

// Contract ABI and address
const CONTRACT_ADDRESS = '0x9b9083C091c54e4f84360EFA5501c6646Eec8adc';
const CONTRACT_ABI = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "_electionId", "type": "uint256" },
      { "internalType": "uint256", "name": "_candidateId", "type": "uint256" },
      { "internalType": "string", "name": "_position", "type": "string" }
    ],
    "name": "castVote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "blockNumber", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "voter", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "electionId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "candidateId", "type": "uint256" },
      { "indexed": false, "internalType": "bytes32", "name": "voteHash", "type": "bytes32" },
      { "indexed": false, "internalType": "string", "name": "verificationCode", "type": "string" }
    ],
    "name": "VoteCast",
    "type": "event"
  }
];

interface CastVoteParams {
  candidateId: string;
  electionId: string;
  position: string;
}

interface UseOnChainVotingReturn {
  castVote: (params: CastVoteParams) => Promise<{ success: boolean; verificationCode?: string; error?: string }>;
  isSubmitting: boolean;
  lastVerificationCode: string | null;
}

export function useOnChainVoting(): UseOnChainVotingReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastVerificationCode, setLastVerificationCode] = useState<string | null>(null);
  const { state: smartWalletState, getSigner } = useSmartWallet();
  const { toast } = useToast();

  const castVote = useCallback(async ({
    candidateId,
    electionId,
    position,
  }: CastVoteParams): Promise<{ success: boolean; verificationCode?: string; error?: string }> => {
    setIsSubmitting(true);

    try {
      // For automatic wallet system, we don't need connection check
      // The smart wallet will be automatically generated from user email

      // Convert string IDs to numbers for the contract
      const electionIdNum = parseInt(electionId, 10);
      const candidateIdNum = parseInt(candidateId, 10);

      if (isNaN(electionIdNum) || isNaN(candidateIdNum)) {
        return { success: false, error: 'Invalid election or candidate ID' };
      }

      // Create contract instance using smart wallet signer
      const signer = await getSigner();
      if (!signer) {
        return { success: false, error: 'Unable to get smart wallet signer' };
      }
      
      const contract = new (window as any).ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      // Execute the vote transaction
      const transaction = await contract.castVote(electionIdNum, candidateIdNum, position);
      
      // Wait for transaction confirmation
      const receipt = await transaction.wait();
      
      // Extract verification code from transaction events
      let verificationCode = '';
      if (receipt.logs && receipt.logs.length > 0) {
        const voteCastEvent = receipt.logs.find((log: any) => 
          log.topics && log.topics[0] === (window as any).ethers.id('VoteCast(uint256,address,uint256,uint256,bytes32,string)')
        );
        
        if (voteCastEvent) {
          const decodedLog = contract.interface.parseLog(voteCastEvent);
          verificationCode = decodedLog.args.verificationCode;
        }
      }

      // If no verification code from event, generate a fallback
      if (!verificationCode) {
        verificationCode = `VOTE-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      }

      setLastVerificationCode(verificationCode);
      
      toast({
        title: 'Vote Cast Successfully',
        description: `Your vote has been recorded on the blockchain. Transaction: ${receipt.hash}`,
      });

      return { success: true, verificationCode };
    } catch (error: any) {
      console.error('Vote casting error:', error);
      
      let errorMessage = 'An unexpected error occurred';
      
      if (error.code === 'ACTION_REJECTED') {
        errorMessage = 'Transaction was rejected by user';
      } else if (error.message?.includes('already voted')) {
        errorMessage = 'You have already voted in this election';
      } else if (error.message?.includes('Election is not active')) {
        errorMessage = 'The election is not currently active';
      } else if (error.message?.includes('Voter has already voted')) {
        errorMessage = 'You have already voted in this election';
      }

      return { success: false, error: errorMessage };
    } finally {
      setIsSubmitting(false);
    }
  }, [smartWalletState, getSigner, toast]);

  return {
    castVote,
    isSubmitting,
    lastVerificationCode,
  };
}