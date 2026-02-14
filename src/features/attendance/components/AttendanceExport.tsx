import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { AttendanceWithStudent, Event } from '@/@types/attendance';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface AttendanceExportProps {
  attendance: AttendanceWithStudent[];
  event: Event;
}

export function AttendanceExport({ attendance, event }: AttendanceExportProps) {
  const [exporting, setExporting] = useState(false);

  const generateCSV = () => {
    const headers = ['Student Name', 'Student ID', 'Department', 'Year Level', 'Time In', 'Time Out', 'Status', 'Penalty Amount'];
    const rows = attendance.map(record => [
      record.student?.full_name || 'Unknown',
      record.student?.student_id || '',
      record.student?.department || '',
      record.student?.year_level || '',
      format(new Date(record.checked_in_at), 'yyyy-MM-dd HH:mm:ss'),
      record.checked_out_at ? format(new Date(record.checked_out_at), 'yyyy-MM-dd HH:mm:ss') : '',
      record.status.toUpperCase(),
      record.status === 'absent' ? 30 : 0,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  };

  const exportToCSV = () => {
    setExporting(true);
    try {
      const csvContent = generateCSV();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `attendance_${event.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV exported successfully');
    } catch (error) {
      toast.error('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      // Create a printable HTML document
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Please allow popups to export PDF');
        return;
      }

      const stats = {
        total: attendance.length,
        present: attendance.filter(a => a.status === 'present').length,
        late: attendance.filter(a => a.status === 'late').length,
        absent: attendance.filter(a => a.status === 'absent').length,
        excused: attendance.filter(a => a.status === 'excused').length,
      };
      const penaltyTotal = stats.absent * 30;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Attendance Report - ${event.title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; margin-bottom: 5px; }
            .subtitle { color: #666; margin-bottom: 20px; }
            .stats { display: flex; gap: 20px; margin-bottom: 20px; }
            .stat { background: #f5f5f5; padding: 10px 15px; border-radius: 5px; }
            .stat-value { font-size: 24px; font-weight: bold; }
            .stat-label { font-size: 12px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .status-present { color: green; }
            .status-late { color: orange; }
            .status-absent { color: red; }
            .status-excused { color: gray; }
            @media print {
              body { padding: 0; }
              .stats { flex-wrap: wrap; }
            }
          </style>
        </head>
        <body>
          <h1>${event.title}</h1>
          <p class="subtitle">
            ${format(new Date(event.event_date), 'MMMM d, yyyy h:mm a')}
            ${event.location ? ` • ${event.location}` : ''}
          </p>
          
          <div class="stats">
            <div class="stat">
              <div class="stat-value">${stats.total}</div>
              <div class="stat-label">Total</div>
            </div>
            <div class="stat">
              <div class="stat-value" style="color: green;">${stats.present}</div>
              <div class="stat-label">Present</div>
            </div>
            <div class="stat">
              <div class="stat-value" style="color: orange;">${stats.late}</div>
              <div class="stat-label">Late</div>
            </div>
            <div class="stat">
              <div class="stat-value" style="color: red;">${stats.absent}</div>
              <div class="stat-label">Absent</div>
            </div>
            <div class="stat">
              <div class="stat-value" style="color: gray;">${stats.excused}</div>
              <div class="stat-label">Excused</div>
            </div>
            <div class="stat">
              <div class="stat-value" style="color: red;">${penaltyTotal}</div>
              <div class="stat-label">Penalties</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Student Name</th>
                <th>Student ID</th>
                <th>Department</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Status</th>
                <th>Penalty</th>
              </tr>
            </thead>
            <tbody>
              ${attendance.map((record, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${record.student?.full_name || 'Unknown'}</td>
                  <td>${record.student?.student_id || ''}</td>
                  <td>${record.student?.department || ''}</td>
                  <td>${format(new Date(record.checked_in_at), 'h:mm a')}</td>
                  <td>${record.checked_out_at ? format(new Date(record.checked_out_at), 'h:mm a') : '-'}</td>
                  <td class="status-${record.status}">${record.status.toUpperCase()}</td>
                  <td>${record.status === 'absent' ? '30' : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <p style="margin-top: 20px; font-size: 12px; color: #999;">
            Generated on ${format(new Date(), 'MMMM d, yyyy h:mm a')}
          </p>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
      toast.success('PDF ready for printing');
    } catch (error) {
      toast.error('Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={exporting || attendance.length === 0}>
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={exportToCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as CSV (Excel)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
