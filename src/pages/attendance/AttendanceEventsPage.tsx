import { useEvents } from '@/features/attendance/hooks/useAttendance';
import { EventCard, CreateEventDialog } from '@/features/attendance/components';
import { Calendar } from 'lucide-react';

export default function AttendanceEventsPage() {
  const { data: events = [], isLoading } = useEvents();

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="h-6 w-6" />Event Attendance</h1>
            <p className="text-muted-foreground">Manage events and track student attendance</p>
          </div>
          <CreateEventDialog />
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />)}</div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><Calendar className="h-12 w-12 mx-auto opacity-50 mb-2" /><p>No events yet. Create one to get started!</p></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">{events.map(event => <EventCard key={event.id} event={event} />)}</div>
        )}
      </div>
    </div>
  );
}
