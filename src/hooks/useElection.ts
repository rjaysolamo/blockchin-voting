import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Election, DbCandidate, AuditLogEntry } from '@/@types/blockchain';

export function useActiveElection() {
  return useQuery({
    queryKey: ['active-election'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('elections')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as Election | null;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}

export function useElectionCandidates(electionId: string | undefined) {
  return useQuery({
    queryKey: ['candidates', electionId],
    queryFn: async () => {
      if (!electionId) return [];
      
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('election_id', electionId)
        .order('position', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as DbCandidate[];
    },
    enabled: !!electionId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}

export function useAuditLog(electionId: string | undefined) {
  return useQuery({
    queryKey: ['audit-log', electionId],
    queryFn: async () => {
      if (!electionId) return [];
      
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('election_id', electionId)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as AuditLogEntry[];
    },
    enabled: !!electionId,
    refetchInterval: 5000, // Refresh every 5 seconds
    refetchOnWindowFocus: false,
  });
}

export function useElectionPositions(candidates: DbCandidate[]) {
  const positions = [...new Set(candidates.map((c) => c.position))];
  return positions;
}
