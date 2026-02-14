import { useEffect } from 'react';
import { StudentQRCode } from '@/features/attendance/components';
import { useMyAttendance } from '@/features/attendance/hooks/useAttendance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, CheckCircle2, LogOut, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { AttendanceStatus } from '@/@types/attendance';

export default function StudentAttendancePage() {
  const { data: attendance = [], isLoading } = useMyAttendance();
  const { user } = useSupabaseAuth();
  const queryClient = useQueryClient();
  const lastRecord = attendance[0];

  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 740;
      gainNode.gain.value = 0.08;
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.18);
      oscillator.onended = () => {
        audioContext.close();
      };
    } catch {
      return;
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`my-attendance-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `student_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Database['public']['Tables']['attendance']['Row']>) => {
          queryClient.invalidateQueries({ queryKey: ['my-attendance', user.id] });
          if (payload.eventType === 'INSERT') {
            toast.success('You checked in');
            playNotificationSound();
          }
          if (payload.eventType === 'UPDATE') {
            const wasCheckedOut = payload.old?.checked_out_at;
            const isCheckedOut = payload.new?.checked_out_at;
            if (!wasCheckedOut && isCheckedOut) {
              toast.success('You checked out');
              playNotificationSound();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-success text-success-foreground">Present</Badge>;
      case 'late':
        return <Badge className="bg-warning text-warning-foreground">Late</Badge>;
      case 'absent':
        return <Badge variant="destructive">Absent</Badge>;
      case 'excused':
        return <Badge variant="secondary">Excused</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/student/dashboard"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">My Attendance</h1>
          <p className="text-muted-foreground">Manage your event attendance and QR code</p>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-6">
        {/* QR Code Section */}
        <div className="md:col-span-4">
          <StudentQRCode />
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Last Scan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-16 rounded-lg bg-muted animate-pulse" />
              ) : lastRecord ? (
                <div className="space-y-2 text-sm">
                  <div className="font-medium">{lastRecord.event?.title || 'Unknown Event'}</div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {lastRecord.checked_in_at && format(new Date(lastRecord.checked_in_at), 'MMM d, yyyy h:mm a')}
                  </div>
                  {lastRecord.event?.location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {lastRecord.event.location}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {getStatusBadge(lastRecord.status)}
                    {lastRecord.checked_out_at && (
                      <Badge variant="secondary">Checked Out</Badge>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No scans yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Attendance History Section */}
        <div className="md:col-span-8">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Attendance History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : attendance.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto opacity-50 mb-2" />
                  <p>No attendance records found</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {attendance.map((record) => (
                      <div
                        key={record.id}
                        className="flex flex-col md:flex-row gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="font-semibold text-lg">{record.event?.title || 'Unknown Event'}</h3>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(record.status)}
                              {record.status !== 'absent' && (
                                <Badge variant={record.checked_out_at ? "secondary" : "default"}>
                                  {record.checked_out_at ? 'Completed' : 'Checked In'}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {record.event?.event_date && format(new Date(record.event.event_date), 'MMM d, yyyy')}
                            </div>
                            {record.event?.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {record.event.location}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex md:flex-col gap-4 md:gap-2 text-sm border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4 min-w-[140px]">
                          <div>
                            <span className="text-muted-foreground block text-xs">Check In</span>
                            <div className="flex items-center gap-1 font-medium">
                              <Clock className="h-3 w-3" />
                              {format(new Date(record.checked_in_at), 'h:mm a')}
                            </div>
                          </div>
                          
                          {record.checked_out_at && (
                            <div>
                              <span className="text-muted-foreground block text-xs">Check Out</span>
                              <div className="flex items-center gap-1 font-medium">
                                <LogOut className="h-3 w-3" />
                                {format(new Date(record.checked_out_at), 'h:mm a')}
                              </div>
                            </div>
                          )}
                          {record.status === 'absent' && (
                            <div>
                              <span className="text-muted-foreground block text-xs">Penalty</span>
                              <div className="text-destructive font-medium">
                                Absent
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
