-- Add scan_type, is_active, and late_threshold to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS scan_type text NOT NULL DEFAULT 'both' CHECK (scan_type IN ('time_in', 'time_out', 'both')),
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS late_threshold_minutes integer DEFAULT 15;

-- Add status to attendance table for Present/Late/Absent/Excused tracking
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent', 'excused'));

-- Create index on events.is_active for faster filtering
CREATE INDEX IF NOT EXISTS idx_events_is_active ON public.events(is_active);

-- Create index on attendance.status for filtering
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance(status);