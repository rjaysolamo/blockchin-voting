import { useState } from 'react';
import { useAuditLog } from '@/hooks/useElection';
import { formatHashForDisplay } from '@/lib/blockchain';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Hash, Clock, Activity } from 'lucide-react';

interface AuditLogPanelProps {
  electionId: string;
}

export function AuditLogPanel({ electionId }: AuditLogPanelProps) {
  const { data: auditLog } = useAuditLog(electionId);
  const [actionFilter, setActionFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');

  const filteredEntries = (auditLog || []).filter((entry) => {
    const matchesAction = actionFilter
      ? entry.action.toLowerCase().includes(actionFilter.toLowerCase())
      : true;
    const entryDate = new Date(entry.timestamp).toISOString().slice(0, 10);
    const matchesDate = dateFilter ? entryDate === dateFilter : true;
    const matchesPosition = positionFilter
      ? entry.position?.toLowerCase().includes(positionFilter.toLowerCase())
      : true;
    return matchesAction && matchesDate && matchesPosition;
  });

  const handleExport = () => {
    if (filteredEntries.length === 0) return;
    const header = ['timestamp', 'action', 'position', 'block_number', 'block_hash'];
    const rows = filteredEntries.map((entry) => [
      new Date(entry.timestamp).toISOString(),
      entry.action,
      entry.position || '',
      entry.block_number?.toString() || '',
      entry.block_hash || '',
    ]);
    const csv = [
      header.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'audit-log.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="voting-card">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Audit Log</h3>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredEntries.length === 0}>
          Export CSV
        </Button>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Input
          placeholder="Filter by action"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        />
        <Input
          placeholder="Filter by position"
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value)}
        />
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {filteredEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No activity yet. Votes will appear here in real-time.
            </p>
          ) : (
            filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className={`p-3 rounded-lg border animate-fade-in ${
                  entry.action.toLowerCase().includes('mismatch')
                    ? 'bg-destructive/10 border-destructive/20'
                    : entry.action.toLowerCase().includes('verified') || entry.action.toLowerCase().includes('vote_cast')
                      ? 'bg-success/10 border-success/20'
                      : 'bg-muted/30 border-border/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 bg-primary/10 text-primary rounded">
                        {entry.action}
                      </span>
                      {entry.position && (
                        <span className="text-xs text-muted-foreground">
                          {entry.position}
                        </span>
                      )}
                    </div>
                    
                    {entry.block_hash && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Hash className="w-3 h-3" />
                        <span className="font-mono">{formatHashForDisplay(entry.block_hash)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                    <Clock className="w-3 h-3" />
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </div>
                </div>

                {entry.block_number && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Block #{entry.block_number}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
