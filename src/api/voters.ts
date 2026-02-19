import { ApiResponse, Voter } from '@/@types';

/**
 * Get all voters
 */
export async function getVoters(): Promise<ApiResponse<Voter[]>> {
  try {
    const response = await fetch('/api/voters');
    
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
      error: error instanceof Error ? error.message : 'Failed to fetch voters',
    };
  }
}

/**
 * Get voter by ID
 */
export async function getVoterById(id: string): Promise<ApiResponse<Voter>> {
  try {
    const response = await fetch(`/api/voters/${id}`);
    
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
      error: error instanceof Error ? error.message : 'Failed to fetch voter',
    };
  }
}

/**
 * Update voter status
 */
export async function updateVoterStatus(
  id: string, 
  status: { hasVoted?: boolean; votedPositions?: string[] }
): Promise<ApiResponse<Voter>> {
  try {
    const response = await fetch(`/api/voters/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(status),
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
      error: error instanceof Error ? error.message : 'Failed to update voter',
    };
  }
}