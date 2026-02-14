import { ApiResponse, ElectionStats } from '@/@types';
import { mockStats } from './mockData';

/**
 * Submit a vote for a candidate
 * In production, this would make an API call to the backend
 */
export async function submitVote(
  candidateId: string,
  position: string
): Promise<ApiResponse<{ voteId: string }>> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // In production, this would validate and record the vote
  return {
    success: true,
    data: {
      voteId: `vote_${Date.now()}`,
    },
  };
}

/**
 * Get election statistics
 */
export async function getElectionStats(): Promise<ApiResponse<ElectionStats>> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    success: true,
    data: mockStats,
  };
}

/**
 * Check if a user has already voted
 */
export async function checkVoteStatus(
  userId: string
): Promise<ApiResponse<{ hasVoted: boolean; votedPositions: string[] }>> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  return {
    success: true,
    data: {
      hasVoted: false,
      votedPositions: [],
    },
  };
}
