import { Card, CardContent } from '@/components/ui/card';
import { Users, Check, AlertTriangle, X, FileQuestion, DollarSign } from 'lucide-react';
import { AttendanceStats as Stats } from '@/@types/attendance';

interface AttendanceStatsProps {
  stats: Stats;
}

export function AttendanceStatsCards({ stats }: AttendanceStatsProps) {
  const penaltyTotal = stats.absent * 30;
  const items = [
    { label: 'Total', value: stats.total, icon: Users, color: 'text-foreground' },
    { label: 'Present', value: stats.present, icon: Check, color: 'text-success' },
    { label: 'Late', value: stats.late, icon: AlertTriangle, color: 'text-warning' },
    { label: 'Absent', value: stats.absent, icon: X, color: 'text-destructive' },
    { label: 'Excused', value: stats.excused, icon: FileQuestion, color: 'text-muted-foreground' },
    { label: 'Penalties', value: penaltyTotal, icon: DollarSign, color: 'text-destructive' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <item.icon className={`h-5 w-5 ${item.color}`} />
              <div>
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
