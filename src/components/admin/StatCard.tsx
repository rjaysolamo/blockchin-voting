import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  variant?: 'default' | 'success' | 'warning';
}

const StatCard = ({ title, value, icon: Icon, subtitle, variant = 'default' }: StatCardProps) => {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          variant === 'success' && 'bg-success/10 text-success',
          variant === 'warning' && 'bg-destructive/10 text-destructive',
          variant === 'default' && 'bg-muted'
        )}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      {subtitle && (
        <p className={cn(
          'text-sm',
          variant === 'success' && 'text-success',
          variant === 'warning' && 'text-destructive',
          variant === 'default' && 'text-muted-foreground'
        )}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default StatCard;
