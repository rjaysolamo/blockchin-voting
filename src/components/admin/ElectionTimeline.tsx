import { useState, useEffect } from 'react';
import { Clock, CalendarClock, CalendarCheck } from 'lucide-react';
import { format } from 'date-fns';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface ElectionTimelineProps {
  startDate: Date;
  endDate: Date;
  status: 'open' | 'closed';
}

const ElectionTimeline = ({ startDate, endDate, status }: ElectionTimelineProps) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [phase, setPhase] = useState<'before' | 'during' | 'after'>('during');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const start = startDate.getTime();
      const end = endDate.getTime();
    

      if (now < start) {
        setPhase('before');
        const difference = start - now;
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
        
       
      } else if (now > end) {
        setPhase('after');
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setPhase('during');
        const difference = end - now;
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [startDate, endDate]);

  const TimeUnit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="bg-primary/10 border border-primary/20 rounded-lg w-14 h-14 flex items-center justify-center">
        <span className="text-xl font-bold text-primary">{value.toString().padStart(2, '0')}</span>
      </div>
      <span className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">{label}</span>
    </div>
  );

  return (
    <div className="voting-card">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5" />
        Election Timeline
      </h2>

      {/* Date Display */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <CalendarClock className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Start Date</p>
            <p className="font-medium text-sm">{format(startDate, 'MMM d, yyyy')}</p>
            <p className="text-xs text-muted-foreground">{format(startDate, 'h:mm a')}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <CalendarCheck className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">End Date</p>
            <p className="font-medium text-sm">{format(endDate, 'MMM d, yyyy')}</p>
            <p className="text-xs text-muted-foreground">{format(endDate, 'h:mm a')}</p>
          </div>
        </div>
      </div>
      
      {/* Countdown */}
      <div className="border-t border-border pt-4">
        {phase === 'after' ? (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-full text-sm">
              Election has ended
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground text-center mb-3">
              {phase === 'before' ? 'Election starts in:' : 'Time remaining:'}
            </p>
            <div className="flex items-center justify-center gap-2">
              <TimeUnit value={timeLeft.days} label="Days" />
              <span className="text-xl font-bold text-muted-foreground mt-[-1rem]">:</span>
              <TimeUnit value={timeLeft.hours} label="Hrs" />
              <span className="text-xl font-bold text-muted-foreground mt-[-1rem]">:</span>
              <TimeUnit value={timeLeft.minutes} label="Min" />
              <span className="text-xl font-bold text-muted-foreground mt-[-1rem]">:</span>
              <TimeUnit value={timeLeft.seconds} label="Sec" />
            </div>
            {phase === 'during' && (
              <div className="flex justify-center mt-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success rounded-full text-sm">
                  <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                  Voting in progress
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ElectionTimeline;
