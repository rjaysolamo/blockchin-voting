import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useEvent, useEventAttendance, useCheckIn, useCheckOut, useAttendanceStats, useToggleEventActive } from '@/features/attendance/hooks/useAttendance';
import { QRScanner, AttendanceList, AttendanceExport, AttendanceStatsCards } from '@/features/attendance/components';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MapPin, LogIn, LogOut, ArrowLeft, Power, Clock, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export default function AttendanceScannerPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [scanMode, setScanMode] = useState<'checkin' | 'checkout'>('checkin');
  const [lastScan, setLastScan] = useState<{
    name: string;
    action: string;
    status?: string;
    time: string;
  } | null>(null);

  const { data: event, isLoading: eventLoading } = useEvent(eventId);
  const { data: attendance = [], isLoading: attendanceLoading } = useEventAttendance(eventId);
  const stats = useAttendanceStats(eventId);
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const toggleActive = useToggleEventActive();

  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.08;
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
      oscillator.onended = () => { audioContext.close(); };
    } catch { return; }
  };

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`attendance-notify-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `event_id=eq.${eventId}` },
        (payload: RealtimePostgresChangesPayload<Database['public']['Tables']['attendance']['Row']>) => {
          if (payload.eventType === 'INSERT') { toast.success('Student checked in'); playNotificationSound(); }
          if (payload.eventType === 'UPDATE') {
            const wasCheckedOut = payload.old?.checked_out_at;
            const isCheckedOut = payload.new?.checked_out_at;
            if (!wasCheckedOut && isCheckedOut) { toast.success('Student checked out'); playNotificationSound(); }
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  const handleScan = async (qrCode: string) => {
    if (!eventId) return;
    try {
      if (scanMode === 'checkin') {
        const result = await checkIn.mutateAsync({ eventId, qrCode });
        const statusMsg = result.status === 'late' ? ' (Late)' : '';
        toast.success(`${result.student?.full_name || 'Student'} checked in${statusMsg}!`);
        setLastScan({ name: result.student?.full_name || 'Student', action: 'Checked In', status: result.status, time: new Date().toISOString() });
      } else {
        const result = await checkOut.mutateAsync({ eventId, qrCode });
        toast.success(`${result.student?.full_name || 'Student'} checked out successfully!`);
        setLastScan({ name: result.student?.full_name || 'Student', action: 'Checked Out', time: new Date().toISOString() });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to process attendance';
      toast.error(message);
    }
  };

  const handleToggleActive = async () => {
    if (!event) return;
    try {
      await toggleActive.mutateAsync({ eventId: event.id, isActive: !event.is_active });
      toast.success(event.is_active ? 'Event deactivated' : 'Event activated');
    } catch { toast.error('Failed to update event status'); }
  };

  const getScanTypeInfo = () => {
    if (!event) return null;
    switch (event.scan_type) {
      case 'time_in': return { icon: <LogIn className="h-4 w-4" />, label: 'Time In Only' };
      case 'time_out': return { icon: <LogOut className="h-4 w-4" />, label: 'Time Out Only' };
      default: return { icon: <ArrowLeftRight className="h-4 w-4" />, label: 'Both (Time In & Out)' };
    }
  };

  if (eventLoading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!event) return <div className="flex items-center justify-center min-h-screen">Event not found</div>;

  const scanTypeInfo = getScanTypeInfo();

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/attendance"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{event.title}</h1>
                {event.is_active && <Badge className="bg-success text-success-foreground animate-pulse">Live</Badge>}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{format(new Date(event.event_date), 'MMM d, yyyy h:mm a')}</span>
                {event.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{event.location}</span>}
                {scanTypeInfo && <span className="flex items-center gap-1">{scanTypeInfo.icon}{scanTypeInfo.label}</span>}
                {event.late_threshold_minutes && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />Late after {event.late_threshold_minutes} min</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Power className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Event Active</span>
              <Switch checked={event.is_active} onCheckedChange={handleToggleActive} disabled={toggleActive.isPending} />
            </div>
            <AttendanceExport attendance={attendance} event={event} />
          </div>
        </div>

        <AttendanceStatsCards stats={stats} />

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle>Last Scan</CardTitle></CardHeader>
              <CardContent>
                {lastScan ? (
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">{lastScan.name}</div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      {lastScan.action}{lastScan.status ? ` (${lastScan.status})` : ''}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />{new Date(lastScan.time).toLocaleTimeString()}
                    </div>
                  </div>
                ) : <p className="text-sm text-muted-foreground">No scans yet.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle>Scan QR Code</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {event.scan_type === 'both' && (
                  <Tabs value={scanMode} onValueChange={(v) => setScanMode(v as 'checkin' | 'checkout')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="checkin" className="gap-2"><LogIn className="h-4 w-4" />Check In</TabsTrigger>
                      <TabsTrigger value="checkout" className="gap-2"><LogOut className="h-4 w-4" />Check Out</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
                {event.scan_type === 'time_in' && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg"><LogIn className="h-5 w-5 text-primary" /><span className="font-medium">Time In Mode</span></div>
                )}
                {event.scan_type === 'time_out' && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg"><LogOut className="h-5 w-5 text-primary" /><span className="font-medium">Time Out Mode</span></div>
                )}
                {!event.is_active ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Power className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Event is not active</p>
                    <p className="text-sm">Activate the event to start scanning</p>
                  </div>
                ) : (
                  <QRScanner onScan={handleScan} isProcessing={checkIn.isPending || checkOut.isPending} />
                )}
              </CardContent>
            </Card>
          </div>

          <AttendanceList attendance={attendance} isLoading={attendanceLoading} eventId={eventId} showManualOverride={true} />
        </div>
      </div>
    </div>
  );
}
