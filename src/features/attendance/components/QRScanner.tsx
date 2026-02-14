import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, ScanLine, Smartphone } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface QRScannerProps {
  onScan: (qrCode: string) => void;
  isProcessing?: boolean;
}

export function QRScanner({ onScan, isProcessing }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCameraAccess, setHasCameraAccess] = useState<boolean | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const scannerRef = useRef<BrowserMultiFormatReader | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastScannedRef = useRef<string | null>(null);

  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    BrowserMultiFormatReader.listVideoInputDevices()
      .then((devices) => {
        if (devices && devices.length) {
          const mappedDevices = devices.map((device) => ({
            id: device.deviceId,
            label: device.label || `Camera ${device.deviceId.slice(0, 5)}...`,
          }));
          setCameras(mappedDevices);
          setSelectedCamera(mappedDevices[mappedDevices.length - 1].id);
        }
      })
      .catch(() => {
        setCameras([]);
      });
  }, []);

  const handleScanSuccess = (decodedText: string) => {
    // Show big green check
    setIsSuccess(true);
    
    // Play success sound
    try {
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        const audioContext = new AudioContextClass();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 1000; // High pitch beep
        gainNode.gain.value = 0.1;
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
      }
    } catch (e) {
      console.error('Audio play failed', e);
    }

    onScan(decodedText);
    
    // Hide success check after 1.5s
    setTimeout(() => {
      setIsSuccess(false);
      lastScannedRef.current = null;
    }, 1500);
  };

  const startScanner = async () => {
    try {
      setError(null);
      setIsSuccess(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera is not supported on this device/browser.');
        setHasCameraAccess(false);
        return;
      }

      if (!window.isSecureContext) {
        setError('Camera requires HTTPS or localhost.');
        setHasCameraAccess(false);
        return;
      }

      await stopScanner();

      try {
        const probeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        probeStream.getTracks().forEach((t) => t.stop());
        setHasCameraAccess(true);
      } catch (err) {
        const error = err as DOMException;
        if (error?.name === 'NotAllowedError') {
          setError('Camera permission denied. Allow camera access and retry.');
        } else if (error?.name === 'NotFoundError') {
          setError('No camera found. Connect a camera and try again.');
        } else if (error?.name === 'NotReadableError') {
          setError('Camera is in use by another app. Close it and retry.');
        } else {
          setError('Failed to access camera.');
        }
        setHasCameraAccess(false);
        return;
      }

      if (!videoRef.current) {
        setError('Camera preview is not ready.');
        setHasCameraAccess(false);
        return;
      }

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const availableCameras = (devices || []).map((device) => ({
        id: device.deviceId,
        label: device.label || `Camera ${device.deviceId.slice(0, 5)}...`,
      }));
      setCameras(availableCameras);

      if (!availableCameras.length) {
        setError('No camera found. Connect a camera and try again.');
        setHasCameraAccess(false);
        return;
      }

      const environmentCamera =
        availableCameras.find((camera) =>
          camera.label?.toLowerCase().includes('back') ||
          camera.label?.toLowerCase().includes('rear') ||
          camera.label?.toLowerCase().includes('environment')
        ) || availableCameras[availableCameras.length - 1];
      const cameraId = selectedCamera || environmentCamera?.id || '';
      if (!selectedCamera && cameraId) {
        setSelectedCamera(cameraId);
      }

      const reader = new BrowserMultiFormatReader();
      scannerRef.current = reader;

      await reader.decodeFromVideoDevice(
        cameraId || undefined,
        videoRef.current,
        (result) => {
          if (result) {
            const decodedText = result.getText();
            if (lastScannedRef.current !== decodedText && !isProcessing) {
              lastScannedRef.current = decodedText;
              handleScanSuccess(decodedText);
            }
          }
        }
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Error starting scanner:', err);
      setError('Failed to start camera.');
      setHasCameraAccess(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const scanner = scannerRef.current as (BrowserMultiFormatReader & { reset?: () => void }) | null;
        scanner?.reset?.();
        scannerRef.current = null;
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    const videoEl = videoRef.current;
    const stream = (videoEl?.srcObject as MediaStream | null) || null;
    if (stream?.getTracks) {
      stream.getTracks().forEach((t) => t.stop());
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    const videoEl = videoRef.current;
    return () => {
      if (scannerRef.current) {
        try {
          const scanner = scannerRef.current as (BrowserMultiFormatReader & { reset?: () => void }) | null;
          scanner?.reset?.();
        } catch (err) {
          console.error('Error stopping scanner:', err);
        }
      }
      const stream = (videoEl?.srcObject as MediaStream | null) || null;
      if (stream?.getTracks) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, []);

  const handleCameraChange = async (cameraId: string) => {
    setSelectedCamera(cameraId);
    if (isScanning) {
      await stopScanner();
      setTimeout(startScanner, 100);
    }
  };

  const handleManualInput = () => {
    const code = prompt('Enter QR code content manually (Testing Bypass):');
    if (code) {
      handleScanSuccess(code);
    }
  };

  return (
    <Card className="overflow-hidden border-2 shadow-lg">
      <CardHeader className="bg-muted/50 pb-4">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            Professional Scanner
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleManualInput}>
              Manual Input
            </Button>
            {isScanning ? (
              <Button variant="destructive" size="sm" onClick={stopScanner}>
                <CameraOff className="h-4 w-4 mr-2" />
                Stop
              </Button>
            ) : (
              <Button variant="default" size="sm" onClick={startScanner}>
                <Camera className="h-4 w-4 mr-2" />
                Start Scan
              </Button>
            )}
          </div>
        </CardTitle>
        
        {cameras.length > 1 && (
          <div className="mt-2">
            <Select value={selectedCamera} onValueChange={handleCameraChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Camera" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map(camera => (
                  <SelectItem key={camera.id} value={camera.id}>
                    {camera.label || `Camera ${camera.id.slice(0, 5)}...`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-0 relative">
        <div
          id="qr-reader"
          className={`relative overflow-hidden bg-black w-full ${
            isScanning ? 'aspect-square' : 'min-h-[300px]'
          }`}
        >
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            autoPlay
            playsInline
          />
          {!isScanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted-foreground bg-muted/20 backdrop-blur-sm z-10">
              <div className="w-20 h-20 rounded-full bg-background/80 flex items-center justify-center shadow-lg animate-pulse">
                <Camera className="h-10 w-10 opacity-70" />
              </div>
              <p className="font-medium bg-background/80 px-4 py-2 rounded-full shadow-sm">
                {hasCameraAccess === false
                  ? 'Camera permission required'
                  : 'Ready to scan'}
              </p>
            </div>
          )}
        </div>

        {/* Professional Overlay */}
        {isScanning && !isSuccess && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Scanning Frame */}
            <div 
              id="scan-overlay"
              className="w-[250px] h-[250px] border-2 border-primary/50 rounded-xl relative transition-colors duration-300"
            >
              {/* Corner Accents */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />
              
              {/* Scanning Laser Animation */}
              <div className="absolute left-0 right-0 h-0.5 bg-primary/80 shadow-[0_0_15px_rgba(var(--primary),0.8)] animate-scan-line top-0" />
            </div>
            
            {/* Instruction Text */}
            <div className="absolute bottom-8 left-0 right-0 text-center">
              <span className="bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md border border-white/10">
                Align QR code within frame
              </span>
            </div>
          </div>
        )}

        {/* Success Overlay */}
        {isSuccess && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500/80 z-20 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white rounded-full p-4 shadow-xl animate-in zoom-in duration-300">
               <svg 
                 className="w-16 h-16 text-green-600" 
                 fill="none" 
                 stroke="currentColor" 
                 viewBox="0 0 24 24" 
                 xmlns="http://www.w3.org/2000/svg"
               >
                 <path 
                   strokeLinecap="round" 
                   strokeLinejoin="round" 
                   strokeWidth="3" 
                   d="M5 13l4 4L19 7" 
                 />
               </svg>
             </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-20">
            <div className="text-center p-6 max-w-xs">
              <Smartphone className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive font-medium mb-2">Scanner Error</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
