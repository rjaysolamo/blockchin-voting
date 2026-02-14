import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Election, DbCandidate, AuditLogEntry } from '@/@types/blockchain';

export function useElections() {
  return useQuery({
    queryKey: ['elections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('elections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Election[];
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}

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
    queryKey: ['admin-candidates', electionId],
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

export function useElectionStats(electionId: string | undefined) {
  return useQuery({
    queryKey: ['election-stats', electionId],
    queryFn: async () => {
      if (!electionId) return null;
      
      const { count: voterCount, error: voterError } = await supabase
        .from('voter_registry')
        .select('*', { count: 'exact', head: true })
        .eq('election_id', electionId);

      if (voterError) throw voterError;

      const { count: voteCount, error: voteError } = await supabase
        .from('voter_registry')
        .select('*', { count: 'exact', head: true })
        .eq('election_id', electionId)
        .eq('has_voted', true);

      if (voteError) throw voteError;

      const { count: candidateCount, error: candidateError } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .eq('election_id', electionId);

      if (candidateError) throw candidateError;

      return {
        totalVoters: voterCount || 0,
        votesCast: voteCount || 0,
        totalCandidates: candidateCount || 0,
      };
    },
    enabled: !!electionId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}

export function useAuditLog(electionId: string | undefined) {
  return useQuery({
    queryKey: ['admin-audit-log', electionId],
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
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateElection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Election> }) => {
      const { data, error } = await supabase
        .from('elections')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-election'] });
      queryClient.invalidateQueries({ queryKey: ['elections'] });
    },
  });
}

export function useCreateElection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (election: {
      title: string;
      description?: string;
      start_date: string;
      end_date: string;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('elections')
        .insert(election)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-election'] });
      queryClient.invalidateQueries({ queryKey: ['elections'] });
    },
  });
}

export function useCreateCandidate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (candidate: {
      election_id: string;
      name: string;
      position: string;
      department?: string;
      year_level?: string;
      manifesto?: string;
      photo_url?: string;
    }) => {
      const { data, error } = await supabase
        .from('candidates')
        .insert(candidate)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-candidates', variables.election_id] });
      queryClient.invalidateQueries({ queryKey: ['election-stats'] });
    },
  });
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DbCandidate> }) => {
      const { data, error } = await supabase
        .from('candidates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-candidates', data.election_id] });
    },
  });
}

export function useDeleteCandidate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, electionId }: { id: string; electionId: string }) => {
      const { error } = await supabase
        .from('candidates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, electionId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-candidates', data.electionId] });
      queryClient.invalidateQueries({ queryKey: ['election-stats'] });
    },
  });
}
