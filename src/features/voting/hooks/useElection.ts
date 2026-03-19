import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Election, DbCandidate } from '@/@types/blockchain';

export function useActiveElection() {
  return useQuery({
    queryKey: ['active-election'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('elections')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as Election | null;
    },
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
  });
}

export function useElectionPositions(candidates: DbCandidate[]) {
  const positions = [...new Set(candidates.map((c) => c.position))];
  return positions;
}
