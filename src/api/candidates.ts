import { Candidate, ApiResponse } from '@/@types';
import { mockCandidates } from './mockData';

/**
 * Get all candidates
 */
export async function getCandidates(): Promise<ApiResponse<Candidate[]>> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    success: true,
    data: mockCandidates,
  };
}

/**
 * Get candidates by position
 */
export async function getCandidatesByPosition(
  position: string
): Promise<ApiResponse<Candidate[]>> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  const filtered = mockCandidates.filter((c) => c.position === position);

  return {
    success: true,
    data: filtered,
  };
}

/**
 * Get a single candidate by ID
 */
export async function getCandidateById(
  id: string
): Promise<ApiResponse<Candidate | null>> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  const candidate = mockCandidates.find((c) => c.id === id) || null;

  return {
    success: true,
    data: candidate,
  };
}

/**
 * Create a new candidate (admin only)
 */
export async function createCandidate(
  candidate: Omit<Candidate, 'id' | 'voteCount'>
): Promise<ApiResponse<Candidate>> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  const newCandidate: Candidate = {
    ...candidate,
    id: `candidate_${Date.now()}`,
    voteCount: 0,
  };

  return {
    success: true,
    data: newCandidate,
  };
}

/**
 * Update a candidate (admin only)
 */
export async function updateCandidate(
  id: string,
  updates: Partial<Candidate>
): Promise<ApiResponse<Candidate>> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  const candidate = mockCandidates.find((c) => c.id === id);

  if (!candidate) {
    return {
      success: false,
      error: 'Candidate not found',
    };
  }

  return {
    success: true,
    data: { ...candidate, ...updates },
  };
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
