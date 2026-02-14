import { AttendanceStatus, AttendanceWithStudent } from '@/@types/attendance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Clock, LogIn, LogOut, Users, MoreVertical, Check, AlertTriangle, X, FileQuestion } from 'lucide-react';
import { format } from 'date-fns';
import { useUpdateAttendanceStatus } from '../hooks/useAttendance';
import { toast } from 'sonner';
import { formatNumber } from '@/utils/formatters';

interface AttendanceListProps {
  attendance: AttendanceWithStudent[];
  isLoading?: boolean;
  eventId?: string;
  showManualOverride?: boolean;
}

export function AttendanceList({ attendance, isLoading, eventId, showManualOverride = true }: AttendanceListProps) {
  const updateStatus = useUpdateAttendanceStatus();

  const handleStatusChange = async (attendanceId: string, status: AttendanceStatus) => {
    if (!eventId) return;
    try {
      await updateStatus.mutateAsync({ attendanceId, status, eventId });
      toast.success(`Status updated to ${status}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-success text-success-foreground"><Check className="h-3 w-3 mr-1" />Present</Badge>;
      case 'late':
        return <Badge variant="default" className="bg-warning text-warning-foreground"><AlertTriangle className="h-3 w-3 mr-1" />Late</Badge>;
      case 'absent':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Absent</Badge>;
      case 'excused':
        return <Badge variant="secondary"><FileQuestion className="h-3 w-3 mr-1" />Excused</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted animate-pulse">
                <div className="h-10 w-10 rounded-full bg-muted-foreground/20" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted-foreground/20 rounded" />
                  <div className="h-3 w-24 bg-muted-foreground/20 rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Attendance ({attendance.length})
          </span>
          <div className="flex gap-2 text-xs font-normal">
            <Badge variant="outline" className="bg-success/10">
              {attendance.filter(a => a.status === 'present').length} Present
            </Badge>
            <Badge variant="outline" className="bg-warning/10">
              {attendance.filter(a => a.status === 'late').length} Late
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {attendance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No students scanned yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attendance.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={record.student?.avatar_url || undefined} />
                    <AvatarFallback>
                      {record.student?.full_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {record.student?.full_name || 'Unknown Student'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{record.student?.student_id}</span>
                      {record.student?.department && (
                        <>
                          <span>•</span>
                          <span>{record.student.department}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {getStatusBadge(record.status)}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <LogIn className="h-3 w-3" />
                      {format(new Date(record.checked_in_at), 'h:mm a')}
                      {record.checked_out_at && (
                        <>
                          <LogOut className="h-3 w-3 ml-2" />
                          {format(new Date(record.checked_out_at), 'h:mm a')}
                        </>
                      )}
                    </div>
                    {record.status === 'absent' && (
                      <div className="text-xs text-destructive">
                        Absent
                      </div>
                    )}
                  </div>

                  {showManualOverride && eventId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleStatusChange(record.id, 'present')}>
                          <Check className="h-4 w-4 mr-2 text-success" />
                          Mark Present
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(record.id, 'late')}>
                          <AlertTriangle className="h-4 w-4 mr-2 text-warning" />
                          Mark Late
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(record.id, 'excused')}>
                          <FileQuestion className="h-4 w-4 mr-2" />
                          Mark Excused
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(record.id, 'absent')}>
                          <X className="h-4 w-4 mr-2 text-destructive" />
                          Mark Absent
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
