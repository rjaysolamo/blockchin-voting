import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Download, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';

export function StudentQRCode() {
  const { user } = useSupabaseAuth();
  const qrRef = useRef<HTMLDivElement>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile-qr', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('qr_code, full_name, student_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const handleDownload = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `qr-code-${profile?.student_id || 'student'}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            My QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Skeleton className="h-48 w-48" />
        </CardContent>
      </Card>
    );
  }

  const qrValue = profile?.qr_code;

  if (!qrValue) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            My QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          <p>QR code not available. Please contact support.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          My QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div ref={qrRef} className="rounded-lg bg-background p-4 border">
          <QRCodeSVG value={qrValue} size={200} level="H" includeMargin />
        </div>
        <div className="text-center">
          <p className="font-medium">{profile?.full_name || 'Student'}</p>
          <p className="text-sm text-muted-foreground">ID: {profile?.student_id || '—'}</p>
        </div>
        <Button variant="outline" onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download QR Code
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Show this QR code to event staff for attendance check-in/check-out
        </p>
      </CardContent>
    </Card>
  );
}
