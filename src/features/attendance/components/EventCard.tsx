import { Event } from '@/@types/attendance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Calendar, MapPin, Clock, Users, ChevronRight, Power, Trash2, LogIn, LogOut, ArrowLeftRight } from 'lucide-react';
import { format, isPast, isFuture, isToday } from 'date-fns';
import { Link } from 'react-router-dom';
import { useToggleEventActive, useDeleteEvent } from '../hooks/useAttendance';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface EventCardProps {
  event: Event;
  attendanceCount?: number;
  showAdminActions?: boolean;
  actionLabel?: string;
}

export function EventCard({ event, attendanceCount, showAdminActions = true, actionLabel = 'Manage' }: EventCardProps) {
  const toggleActive = useToggleEventActive();
  const deleteEvent = useDeleteEvent();
  
  const eventDate = new Date(event.event_date);
  const isPastEvent = isPast(eventDate) && 
    (event.event_end_date ? isPast(new Date(event.event_end_date)) : !isToday(eventDate));

  const handleToggleActive = async () => {
    try {
      await toggleActive.mutateAsync({ eventId: event.id, isActive: !event.is_active });
      toast.success(event.is_active ? 'Event deactivated' : 'Event activated');
    } catch (error) {
      toast.error('Failed to update event status');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEvent.mutateAsync(event.id);
      toast.success('Event deleted');
    } catch (error) {
      toast.error('Failed to delete event');
    }
  };

  const getScanTypeIcon = () => {
    switch (event.scan_type) {
      case 'time_in': return <LogIn className="h-3 w-3" />;
      case 'time_out': return <LogOut className="h-3 w-3" />;
      default: return <ArrowLeftRight className="h-3 w-3" />;
    }
  };

  const getScanTypeLabel = () => {
    switch (event.scan_type) {
      case 'time_in': return 'Time In Only';
      case 'time_out': return 'Time Out Only';
      default: return 'Both';
    }
  };

  return (
    <Card className={isPastEvent ? 'opacity-70' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{event.title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={event.event_type === 'election' ? 'default' : 'secondary'}>
              {event.event_type}
            </Badge>
            {event.is_active && (
              <Badge variant="default" className="bg-success text-success-foreground">
                Active
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {event.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {event.description}
          </p>
        )}

        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {format(eventDate, 'MMM d, yyyy')}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {format(eventDate, 'h:mm a')}
            {event.event_end_date && (
              <> - {format(new Date(event.event_end_date), 'h:mm a')}</>
            )}
          </div>
          {event.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {event.location}
            </div>
          )}
          {attendanceCount !== undefined && (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {attendanceCount} attendees
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {getScanTypeIcon()}
          <span>{getScanTypeLabel()}</span>
          {event.late_threshold_minutes && (
            <span className="text-xs">• Late after {event.late_threshold_minutes} min</span>
          )}
        </div>

        <div className={`flex items-center pt-2 border-t ${showAdminActions ? 'justify-between' : 'justify-end'}`}>
          {showAdminActions && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Power className="h-4 w-4 text-muted-foreground" />
                <Switch
                  checked={event.is_active}
                  onCheckedChange={handleToggleActive}
                  disabled={toggleActive.isPending}
                />
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Event</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{event.title}"? This will also delete all attendance records for this event.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          <Button variant="ghost" size="sm" asChild>
            <Link to={`/attendance/event/${event.id}`}>
              {actionLabel}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
