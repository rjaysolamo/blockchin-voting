import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Event, Attendance, AttendanceWithStudent, AttendanceStatus, AttendanceStats } from '@/@types/attendance';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import type { Database } from '@/integrations/supabase/types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type EventRow = Database['public']['Tables']['events']['Row'];



// Fetch all events
export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });

      if (error) {
        throw error;
      }
      
      return data as Event[];
    },
  });
}

// Fetch active events only
export function useActiveEvents() {
  return useQuery({
    queryKey: ['events', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .order('event_date', { ascending: false });

      if (error) {
        throw error;
      }
      
      return data as Event[];
    },
  });
}

// Fetch a single event
export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ['events', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();

      if (error) throw error;
      return data as Event | null;
    },
    enabled: !!eventId,
  });
}

// Fetch attendance for an event with realtime
export function useEventAttendance(eventId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`attendance-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['attendance', eventId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, queryClient]);

  return useQuery({
    queryKey: ['attendance', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('event_id', eventId)
        .order('checked_in_at', { ascending: false });

      if (error) throw error;

      const attendanceData = (data ?? []) as unknown as Attendance[];
      const studentIds = attendanceData.map((a) => a.student_id);
      
      if (studentIds.length === 0) return [];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, student_id, department, year_level, avatar_url')
        .in('user_id', studentIds);

      const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

      return attendanceData.map((a) => ({
        ...a,
        student: profileMap.get(a.student_id),
      })) as AttendanceWithStudent[];
    },
    enabled: !!eventId,
  });
}

// Calculate attendance stats
export function useAttendanceStats(eventId: string | undefined) {
  const { data: attendance } = useEventAttendance(eventId);
  
  const stats: AttendanceStats = {
    total: attendance?.length ?? 0,
    present: attendance?.filter(a => a.status === 'present').length ?? 0,
    late: attendance?.filter(a => a.status === 'late').length ?? 0,
    absent: attendance?.filter(a => a.status === 'absent').length ?? 0,
    excused: attendance?.filter(a => a.status === 'excused').length ?? 0,
  };
  
  return stats;
}

// Fetch student's own attendance history
export function useMyAttendance() {
  const { user } = useSupabaseAuth();
  
  return useQuery({
    queryKey: ['my-attendance', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', user.id)
        .order('checked_in_at', { ascending: false });

      if (error) throw error;
      
      const attendanceData = (data ?? []) as unknown as Attendance[];
      const eventIds = [...new Set(attendanceData.map((a) => a.event_id))];
      
      if (eventIds.length === 0) return [];
      
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .in('id', eventIds);
      
      const eventMap = new Map(((events ?? []) as Event[]).map((e) => [e.id, e]));
      
      return attendanceData.map((a) => ({
        ...a,
        event: eventMap.get(a.event_id),
      }));
    },
    enabled: !!user?.id,
  });
}

// Create a new event
export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();

  return useMutation({
    mutationFn: async (event: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      if (!user) {
        throw new Error('User must be authenticated to create events');
      }
      
      const { data, error } = await supabase
        .from('events')
        .insert({ ...event, created_by: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Update an event
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Event> & { id: string }) => {
      const { data, error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Toggle event active status
export function useToggleEventActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, isActive }: { eventId: string; isActive: boolean }) => {
      const { data, error } = await supabase
        .from('events')
        .update({ is_active: isActive })
        .eq('id', eventId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Delete an event
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Check in a student by QR code
export function useCheckIn() {
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();

  return useMutation({
    mutationFn: async ({ eventId, qrCode }: { eventId: string; qrCode: string }) => {
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      
      const event = eventData as EventRow | null;
      if (!event) throw new Error('Event not found');
      if (!event.is_active) throw new Error('Event is not active');
      if (event.scan_type === 'time_out') throw new Error('This event only allows time out scans');

      // Look up student by qr_code in profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('qr_code', qrCode)
        .maybeSingle();

      const profile = profileData as ProfileRow | null;
      if (!profile) throw new Error('Student not found. Invalid QR code.');
      const studentId = profile.user_id;

      // Check if already checked in
      const { data: existingRecords } = await supabase
        .from('attendance')
        .select('id, checked_in_at, checked_out_at')
        .eq('event_id', eventId)
        .eq('student_id', studentId);

      const existing = existingRecords?.[0] ?? null;
      if (existing) {
        throw new Error('Student already checked in for this event');
      }

      const now = new Date();
      const eventStartTime = new Date(event.event_date);
      const lateThreshold = event.late_threshold_minutes ?? 15;
      const lateTime = new Date(eventStartTime.getTime() + lateThreshold * 60 * 1000);
      const status: AttendanceStatus = now > lateTime ? 'late' : 'present';

      const { data, error } = await supabase
        .from('attendance')
        .insert({
          event_id: eventId,
          student_id: studentId,
          checked_in_by: user?.id ?? studentId,
          status,
        })
        .select()
        .single();

      if (error) throw error;
      return { ...data, student: profile, status };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', variables.eventId] });
    },
  });
}

// Check out a student
export function useCheckOut() {
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();

  return useMutation({
    mutationFn: async ({ eventId, qrCode }: { eventId: string; qrCode: string }) => {
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      
      const event = eventData as EventRow | null;
      if (!event) throw new Error('Event not found');
      if (!event.is_active) throw new Error('Event is not active');
      if (event.scan_type === 'time_in') throw new Error('This event only allows time in scans');

      // Look up student by qr_code
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('qr_code', qrCode)
        .maybeSingle();

      const profile = profileData as ProfileRow | null;
      if (!profile) throw new Error('Student not found. Invalid QR code.');
      const studentId = profile.user_id;

      // Find existing check-in
      const { data: attendanceRecords } = await supabase
        .from('attendance')
        .select('id, checked_out_at')
        .eq('event_id', eventId)
        .eq('student_id', studentId);

      const attendance = attendanceRecords?.[0];
      if (!attendance) throw new Error('Student has not checked in');
      if (attendance.checked_out_at) throw new Error('Student already checked out');

      const now = new Date();
      const { data, error } = await supabase
        .from('attendance')
        .update({
          checked_out_at: now.toISOString(),
          checked_out_by: user?.id ?? studentId,
        })
        .eq('id', attendance.id)
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, student: profile };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', variables.eventId] });
    },
  });
}

// Update attendance status (manual override)
export function useUpdateAttendanceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attendanceId, status, eventId }: { attendanceId: string; status: AttendanceStatus; eventId: string }) => {
      const { data, error } = await supabase
        .from('attendance')
        .update({ status })
        .eq('id', attendanceId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', variables.eventId] });
    },
  });
}

// Delete attendance record
export function useDeleteAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attendanceId, eventId }: { attendanceId: string; eventId: string }) => {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', attendanceId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', variables.eventId] });
    },
  });
}
