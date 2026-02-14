import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AuditLogEntry } from '@/@types/blockchain';
import { formatHashForDisplay } from '../lib/crypto';
import { Blocks, CheckCircle2, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface AuditLogPanelProps {
  electionId: string;
}

export function AuditLogPanel({ electionId }: AuditLogPanelProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-log', electionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('election_id', electionId)
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as AuditLogEntry[];
    },
    enabled: !!electionId,
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="voting-card">
        <div className="flex items-center gap-2 mb-4">
          <Blocks className="w-5 h-5" />
          <h3 className="font-semibold">Blockchain Audit Log</h3>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="voting-card">
      <div className="flex items-center gap-2 mb-4">
        <Blocks className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Blockchain Audit Log</h3>
      </div>
      
      {logs && logs.length > 0 ? (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
            >
              <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{log.action}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  {log.block_hash && (
                    <span className="font-mono">
                      {formatHashForDisplay(log.block_hash, 6)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          No blockchain activity yet
        </p>
      )}
    </div>
  );
}
