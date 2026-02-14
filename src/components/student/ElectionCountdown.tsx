import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface ElectionCountdownProps {
  endDate: Date;
}

const getTimeLeft = (targetMs: number): TimeLeft => {
  const now = Date.now();
  const diff = Math.max(0, targetMs - now);

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
};

const ElectionCountdown = ({ endDate }: ElectionCountdownProps) => {
  const endMs = endDate.getTime();
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => getTimeLeft(endMs));

  useEffect(() => {
    const tick = () => setTimeLeft(getTimeLeft(endMs));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endMs]);

  const isExpired =
    timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  if (isExpired) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-destructive">
          <Clock className="w-5 h-5" />
          <span className="font-medium">Voting has ended</span>
        </div>
      </div>
    );
  }

  const TimeUnit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="bg-primary/10 border border-primary/20 rounded-lg w-16 h-16 flex items-center justify-center">
        <span className="text-2xl font-bold text-primary">{value.toString().padStart(2, '0')}</span>
      </div>
      <span className="text-xs text-muted-foreground mt-1.5 uppercase tracking-wide">{label}</span>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <span className="font-medium text-foreground">Time Remaining</span>
      </div>
      <div className="flex items-center justify-center gap-3">
        <TimeUnit value={timeLeft.days} label="Days" />
        <span className="text-2xl font-bold text-muted-foreground mt-[-1rem]">:</span>
        <TimeUnit value={timeLeft.hours} label="Hours" />
        <span className="text-2xl font-bold text-muted-foreground mt-[-1rem]">:</span>
        <TimeUnit value={timeLeft.minutes} label="Minutes" />
        <span className="text-2xl font-bold text-muted-foreground mt-[-1rem]">:</span>
        <TimeUnit value={timeLeft.seconds} label="Seconds" />
      </div>
    </div>
  );
};

export default ElectionCountdown;