// Blockchain voting types

export interface VoteBlock {
  id: string;
  block_number: number;
  previous_hash: string;
  current_hash: string;
  voter_id: string;
  candidate_id: string;
  election_id: string;
  position: string;
  timestamp: string;
  nonce: number;
  verification_code: string;
}

export interface AuditLogEntry {
  id: string;
  election_id: string;
  action: string;
  block_hash: string | null;
  block_number: number | null;
  position: string | null;
  timestamp: string;
  details: Record<string, unknown> | null;
}

export interface Election {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbCandidate {
  id: string;
  election_id: string;
  user_id: string | null;
  name: string;
  position: string;
  department: string | null;
  year_level: string | null;
  photo_url: string | null;
  manifesto: string | null;
  vote_count: number;
  created_at: string;
  updated_at: string;
}

export interface VoterRegistry {
  id: string;
  voter_id: string;
  election_id: string;
  has_voted: boolean;
  voted_at: string | null;
}

export interface VoteVerificationResult {
  verified: boolean;
  block?: VoteBlock;
  chainValid?: boolean;
  message: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  student_id: string | null;
  department: string | null;
  year_level: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
