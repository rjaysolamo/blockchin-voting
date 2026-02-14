// Attendance system types

export type ScanType = 'time_in' | 'time_out' | 'both';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

export interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string;
  event_end_date: string | null;
  event_type: 'general' | 'election';
  election_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  scan_type: ScanType;
  is_active: boolean;
  late_threshold_minutes: number | null;
}

export interface Attendance {
  id: string;
  event_id: string;
  student_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  checked_in_by: string;
  checked_out_by: string | null;
  created_at: string;
  status: AttendanceStatus;
}

export interface AttendanceWithStudent extends Attendance {
  student?: {
    full_name: string | null;
    student_id: string | null;
    department: string | null;
    year_level: string | null;
    avatar_url: string | null;
  };
}

export interface EventWithStats extends Event {
  attendance_count?: number;
  present_count?: number;
  late_count?: number;
  absent_count?: number;
}

export interface AttendanceStats {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
}
