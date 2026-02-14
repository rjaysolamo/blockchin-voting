export type UserRole = 'admin' | 'student' | 'candidate' | 'staff';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  studentId?: string;
  hasVoted?: boolean;
  avatar?: string;
}

export interface CandidateQualification {
  title: string;
  description: string;
}

export interface CandidateGoal {
    title: string;
    description: string;
}

export interface Candidate {
  id: string;
  name: string;
  position: string;
  photo: string;
  voteCount: number;
  description?: string;
  // Extended fields for bio/manifesto
  manifesto?: string;
  qualifications?: CandidateQualification[];
  goals?: CandidateGoal[];
  major?: string;
  year?: string;
  email?: string;
}

export interface ElectionStats {
  totalVoters: number;
  totalCandidates: number;
  votesCast: number;
  electionStatus: 'open' | 'closed';
  startDate: string;
  endDate: string;
}

export interface Voter {
  id: string;
  name: string;
  studentId: string;
  email: string;
  hasVoted: boolean;
  votedAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

