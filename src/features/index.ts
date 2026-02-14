// Feature-based exports - use named imports to avoid conflicts
export { SupabaseAuthProvider, useSupabaseAuth, AuthProvider, useAuth } from './auth';
export { StudentLoginPage, RegisterPage } from './auth/pages';

export { useBlockchainVoting, VoteVerificationDialog, VoteReceiptDialog, AuditLogPanel } from './blockchain';
export { generateVoteHash, generateVerificationCode, formatHashForDisplay } from './blockchain/lib';

export { useActiveElection, useElectionCandidates, useElectionPositions } from './voting/hooks';
export { CandidateCard, ElectionCountdown } from './voting/components';
export { VotingDashboardPage } from './voting/pages';

export { 
  useElections, 
  useActiveElection as useAdminActiveElection,
  useElectionStats, 
  useAuditLog, 
  useUpdateElection,
  useCreateElection,
  useCreateCandidate,
  useUpdateCandidate,
  useDeleteCandidate 
} from './admin/hooks';
export { AdminSidebar, StatCard, ElectionTimeline } from './admin/components';
