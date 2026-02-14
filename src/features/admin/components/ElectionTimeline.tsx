import { Calendar, Clock } from 'lucide-react';

interface ElectionTimelineProps {
  startDate: Date;
  endDate: Date;
  status: 'open' | 'closed' | 'upcoming';
}

export function ElectionTimeline({ startDate, endDate, status }: ElectionTimelineProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusColors = {
    open: 'bg-success text-success',
    closed: 'bg-destructive text-destructive',
    upcoming: 'bg-warning text-warning',
  };

  return (
    <div className="voting-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Election Timeline</h3>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[status]}/10 ${statusColors[status]}`}>
          <span className={`w-2 h-2 rounded-full ${statusColors[status].replace('text-', 'bg-')} animate-pulse`} />
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Start</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(startDate)} at {formatTime(startDate)}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium">End</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(endDate)} at {formatTime(endDate)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
