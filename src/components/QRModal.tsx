// SilentBeacon Air-Gapped QR Code Generator and Camera Scanner
import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Camera, X, Check, RefreshCw, AlertCircle } from 'lucide-react';

interface QRModalProps {
  mode: 'display' | 'scan';
  title: string;
  dataToDisplay?: string;
  onScanned?: (data: string) => void;
  onClose: () => void;
}

export const QRModal: React.FC<QRModalProps> = ({
  mode,
  title,
  dataToDisplay,
  onScanned,
  onClose
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [showManual, setShowManual] = useState<boolean>(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Generate QR image when in display mode
  useEffect(() => {
    if (mode === 'display' && dataToDisplay) {
      QRCode.toDataURL(dataToDisplay, {
        width: 360,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#f8fafc'
        },
        errorCorrectionLevel: 'L'
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR:', err));
    }
  }, [mode, dataToDisplay]);

  // Camera QR scanner loop when in scan mode
  useEffect(() => {
    if (mode !== 'scan') return;

    let isScanning = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          requestAnimationFrame(scanFrame);
        }
      } catch (err: any) {
        setScanError('Camera permission denied or camera not found. You can paste the code manually below.');
        setShowManual(true);
      }
    }

    function scanFrame() {
      if (!isScanning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data) {
            isScanning = false;
            if (onScanned) {
              onScanned(code.data);
            }
            onClose();
            return;
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    }

    startCamera();

    return () => {
      isScanning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [mode, onClose, onScanned]);

  const handleManualSubmit = () => {
    if (manualInput.trim() && onScanned) {
      onScanned(manualInput.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-5 text-slate-900 dark:text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            {mode === 'scan' ? (
              <Camera className="w-5 h-5 text-sky-500" />
            ) : (
              <RefreshCw className="w-5 h-5 text-emerald-500" />
            )}
            <h3 className="font-semibold text-lg">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Display Mode */}
        {mode === 'display' && (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-3 bg-white rounded-xl shadow-inner flex items-center justify-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Air-gap QR Code" className="w-64 h-64 object-contain" />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center text-slate-400">
                  Generating QR...
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 text-center max-w-xs">
              Point the peer device's camera at this screen to perform the air-gapped handshake.
            </p>
            <div className="w-full pt-2 flex justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(dataToDisplay || '');
                  alert('Copied handshake payload to clipboard!');
                }}
                className="text-xs text-sky-400 hover:underline"
              >
                Copy payload as text
              </button>
            </div>
          </div>
        )}

        {/* Scan Mode */}
        {mode === 'scan' && (
          <div className="flex flex-col items-center justify-center space-y-3">
            {!showManual ? (
              <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden border border-slate-700">
                <video ref={videoRef} className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />

                {/* Tactical crosshair targeting reticle */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-dashed border-sky-400 rounded-lg animate-pulse" />
                </div>
                <div className="absolute bottom-2 left-0 right-0 text-center">
                  <span className="text-xs bg-black/60 px-2 py-1 rounded text-slate-200">
                    Align peer's QR code within reticle
                  </span>
                </div>
              </div>
            ) : null}

            {scanError && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center space-x-2 w-full">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{scanError}</span>
              </div>
            )}

            {/* Manual fallback toggle */}
            <div className="w-full pt-2">
              <button
                onClick={() => setShowManual(!showManual)}
                className="text-xs text-sky-400 hover:underline mb-2 block"
              >
                {showManual ? 'Switch back to camera scanner' : 'Or paste handshake payload manually'}
              </button>

              {showManual && (
                <div className="space-y-2">
                  <textarea
                    rows={3}
                    placeholder="Paste SDP handshake JSON here..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className="w-full text-xs p-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <button
                    onClick={handleManualSubmit}
                    disabled={!manualInput.trim()}
                    className="w-full py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center space-x-1"
                  >
                    <Check className="w-4 h-4" />
                    <span>Submit Handshake Payload</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
