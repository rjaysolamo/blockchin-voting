import { Candidate, ApiResponse } from '@/@types';

/**
 * Get all candidates
 */
export async function getCandidates(): Promise<ApiResponse<Candidate[]>> {
  try {
    const response = await fetch('/api/candidates');
    
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
      error: error instanceof Error ? error.message : 'Failed to fetch candidates',
    };
  }
}

/**
 * Get candidates by position
 */
export async function getCandidatesByPosition(
  position: string
): Promise<ApiResponse<Candidate[]>> {
  try {
    const response = await fetch(`/api/candidates?position=${encodeURIComponent(position)}`);
    
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
      error: error instanceof Error ? error.message : 'Failed to fetch candidates by position',
    };
  }
}

/**
 * Get a single candidate by ID
 */
export async function getCandidateById(
  id: string
): Promise<ApiResponse<Candidate | null>> {
  try {
    const response = await fetch(`/api/candidates/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: true,
          data: null,
        };
      }
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
      error: error instanceof Error ? error.message : 'Failed to fetch candidate',
    };
  }
}

/**
 * Create a new candidate (admin only)
 */
export async function createCandidate(
  candidate: Omit<Candidate, 'id' | 'voteCount'>
): Promise<ApiResponse<Candidate>> {
  try {
    const response = await fetch('/api/candidates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(candidate),
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
      error: error instanceof Error ? error.message : 'Failed to create candidate',
    };
  }
}

/**
 * Update a candidate (admin only)
 */
export async function updateCandidate(
  id: string,
  updates: Partial<Candidate>
): Promise<ApiResponse<Candidate>> {
  try {
    const response = await fetch(`/api/candidates/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: 'Candidate not found',
        };
      }
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
      error: error instanceof Error ? error.message : 'Failed to update candidate',
    };
  }
}

/**
 * Delete a candidate (admin only)
 */
export async function deleteCandidate(id: string): Promise<ApiResponse<null>> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    success: true,
  };
}
