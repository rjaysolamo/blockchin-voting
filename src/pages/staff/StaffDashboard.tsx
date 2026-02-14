import { useState, useEffect } from 'react';
import DashboardLayout from '@/templates/DashboardLayout';
import { useCheckIn, useCheckOut, useEvents } from '@/features/attendance/hooks/useAttendance';
import { CreateEventDialog, EventCard, QRScanner } from '@/features/attendance/components';
import { Calendar, LogIn, LogOut, QrCode, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const StaffDashboard = () => {
  const [hasError, setHasError] = useState(false);
  const { data: events = [], isLoading, error: eventsError } = useEvents();
  const [selectedEventId, setSelectedEventId] = useState<string>(''); // Initialize with empty string instead of undefined
  const [scanMode, setScanMode] = useState<'checkin' | 'checkout'>('checkin');
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const selectedEvent = events?.find((event) => event.id === selectedEventId);

  useEffect(() => {
    if (eventsError) {
      console.error('Events fetching error:', eventsError);
      setHasError(true);
    }
  }, [eventsError]);

  if (hasError) {
    return (
      <DashboardLayout title="Staff Dashboard">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">Failed to load events. Please check your connection and try again.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Reload Page
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    const event = events.find((item) => item.id === eventId);
    if (event?.scan_type === 'time_out') {
      setScanMode('checkout');
    } else {
      setScanMode('checkin');
    }
  };

  const handleScan = async (qrCode: string) => {
    if (!selectedEventId) {
      toast.error('Select an event before scanning.');
      return;
    }

    try {
      if (scanMode === 'checkin') {
        const result = await checkIn.mutateAsync({ eventId: selectedEventId, qrCode });
        const statusMsg = result.status === 'late' ? ' (Late)' : '';
        toast.success(`${result.student?.full_name || 'Student'} checked in${statusMsg}!`);
      } else {
        const result = await checkOut.mutateAsync({ eventId: selectedEventId, qrCode });
        toast.success(`${result.student?.full_name || 'Student'} checked out successfully!`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to process attendance';
      toast.error(message);
    }
  };

  return (
    <DashboardLayout title="Staff Dashboard">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Attendance Events
            </h2>
            <p className="text-muted-foreground">Select an event to scan attendees.</p>
          </div>
          <CreateEventDialog />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scan QR Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Select value={selectedEventId} onValueChange={handleSelectEvent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an event to scan" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEvent?.scan_type === 'both' && (
              <Tabs value={scanMode} onValueChange={(value) => setScanMode(value as 'checkin' | 'checkout')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="checkin" className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Check In
                  </TabsTrigger>
                  <TabsTrigger value="checkout" className="gap-2">
                    <LogOut className="h-4 w-4" />
                    Check Out
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {selectedEvent?.scan_type === 'time_in' && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <LogIn className="h-5 w-5 text-primary" />
                <span className="font-medium">Time In Mode</span>
              </div>
            )}

            {selectedEvent?.scan_type === 'time_out' && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <LogOut className="h-5 w-5 text-primary" />
                <span className="font-medium">Time Out Mode</span>
              </div>
            )}

            {!selectedEvent ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Select an event to start scanning.</p>
              </div>
            ) : !selectedEvent.is_active ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Event is not active.</p>
                <p className="text-sm">Ask an admin to activate this event.</p>
              </div>
            ) : (
              <QRScanner
                onScan={handleScan}
                isProcessing={checkIn.isPending || checkOut.isPending}
              />
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto opacity-50 mb-2" />
              <p>No events available for scanning</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {events.map((event) => (
              <EventCard key={event.id} event={event} showAdminActions={false} actionLabel="Open Scanner" />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StaffDashboard;
