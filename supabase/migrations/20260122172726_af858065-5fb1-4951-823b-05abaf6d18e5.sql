-- Create events table
CREATE TABLE public.events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    event_end_date TIMESTAMP WITH TIME ZONE,
    event_type TEXT NOT NULL DEFAULT 'general',
    election_id UUID REFERENCES public.elections(id) ON DELETE SET NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attendance table with check-in/check-out
CREATE TABLE public.attendance (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    checked_out_at TIMESTAMP WITH TIME ZONE,
    checked_in_by UUID NOT NULL,
    checked_out_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(event_id, student_id)
);

-- Add qr_code column to profiles for unique QR identification
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE;

-- Create function to generate unique QR code for profiles
CREATE OR REPLACE FUNCTION public.generate_profile_qr_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.qr_code := encode(gen_random_bytes(16), 'hex');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate QR code on profile creation
DROP TRIGGER IF EXISTS generate_qr_code_trigger ON public.profiles;
CREATE TRIGGER generate_qr_code_trigger
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    WHEN (NEW.qr_code IS NULL)
    EXECUTE FUNCTION public.generate_profile_qr_code();

-- Update existing profiles with QR codes
UPDATE public.profiles 
SET qr_code = encode(gen_random_bytes(16), 'hex') 
WHERE qr_code IS NULL;

-- Enable RLS on events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- RLS policies for events
CREATE POLICY "Anyone can view events"
ON public.events FOR SELECT
USING (true);

CREATE POLICY "Admins and staff can manage events"
ON public.events FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Enable RLS on attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- RLS policies for attendance
CREATE POLICY "Admins and staff can view all attendance"
ON public.attendance FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Students can view their own attendance"
ON public.attendance FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Admins and staff can manage attendance"
ON public.attendance FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins and staff can update attendance"
ON public.attendance FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Create indexes for performance
CREATE INDEX idx_attendance_event_id ON public.attendance(event_id);
CREATE INDEX idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX idx_events_event_date ON public.events(event_date);
CREATE INDEX idx_profiles_qr_code ON public.profiles(qr_code);