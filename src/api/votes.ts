import { ApiResponse, ElectionStats } from '@/@types';

/**
 * Submit a vote for a candidate
 */
export async function submitVote(
  candidateId: string,
  position: string
): Promise<ApiResponse<{ voteId: string }>> {
  try {
    const response = await fetch('/api/votes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ candidateId, position }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit vote',
    };
  }
}

/**
 * Get election statistics
 */
export async function getElectionStats(): Promise<ApiResponse<ElectionStats>> {
  try {
    const response = await fetch('/api/election/stats');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch election statistics',
    };
  }
}

/**
 * Check if a user has already voted
 */
export async function checkVoteStatus(
  userId: string
): Promise<ApiResponse<{ hasVoted: boolean; votedPositions: string[] }>> {
  try {
    const response = await fetch(`/api/votes/status?userId=${encodeURIComponent(userId)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check vote status',
    };
  }
}
