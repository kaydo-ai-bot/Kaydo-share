import React, { useState, useEffect, useRef } from 'react';
import { X, QrCode, Camera, ShieldCheck, CheckCircle2, AlertTriangle, Upload, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import jsQR from 'jsqr';
import { AppSettings, NearbyDevice } from '../types';
import { TransferManager } from '../services/TransferManager';
import { translations } from '../i18n';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  initialMode: 'send' | 'receive';
  onConnectSuccess: (device: NearbyDevice) => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  settings,
  initialMode,
  onConnectSuccess
}) => {
  const t = translations[settings.language];
  const [mode, setMode] = useState<'send' | 'receive'>(initialMode);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const manager = TransferManager.getInstance();
  const localDevice = manager.getLocalDevice();

  // Create genuine QR code data
  const qrData = JSON.stringify({
    app: 'KAYDO_SHARE',
    id: localDevice.id,
    name: settings.deviceName || localDevice.name,
    model: localDevice.model,
    os: localDevice.os,
    timestamp: Date.now()
  });

  // Start real camera scanner when in receive/scanner mode
  useEffect(() => {
    if (!isOpen || mode !== 'receive') {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, mode]);

  const startCamera = async () => {
    setCameraError(null);
    setScannedResult(null);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("L'API Caméra n'est pas supportée sur ce navigateur ou environnement.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        scanVideoFrame();
      }
    } catch (err: any) {
      console.warn("Camera access error:", err);
      setIsScanning(false);
      setCameraError(
        err.name === 'NotAllowedError'
          ? "Permission caméra refusée. Veuillez autoriser l'accès à la caméra pour scanner les QR codes réels."
          : "Impossible d'accéder à la caméra de votre appareil. Vous pouvez aussi téléverser une image de QR Code."
      );
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const handleValidCodeScanned = (codeData: string) => {
    stopCamera();
    setScannedResult(codeData);

    try {
      let peerDevice: NearbyDevice | null = null;
      let pin = '4829';

      if (codeData.startsWith('{')) {
        const parsed = JSON.parse(codeData);
        if (parsed.app === 'KAYDO_SHARE') {
          peerDevice = {
            id: parsed.id,
            name: parsed.name,
            model: parsed.model || 'Appareil distant',
            os: parsed.os || 'Android',
            rssi: -35,
            avatarColor: 'bg-blue-600'
          };
        }
      } else if (codeData.includes('kaydoshare://session')) {
        const url = new URL(codeData.replace('kaydoshare://', 'https://placeholder/'));
        const id = url.searchParams.get('id') || `peer_${Date.now()}`;
        const name = url.searchParams.get('device') || 'Appareil distant';
        pin = url.searchParams.get('pin') || '4829';

        peerDevice = {
          id,
          name,
          model: 'Appareil distant',
          os: 'Android',
          rssi: -35,
          avatarColor: 'bg-blue-600'
        };
      }

      if (peerDevice) {
        // Connect to the real peer
        manager.requestConnect(peerDevice);
        setTimeout(() => {
          onConnectSuccess(peerDevice!);
          onClose();
        }, 800);
      } else {
        setCameraError(`QR code non reconnu comme une session KAYDO SHARE: "${codeData.substring(0, 50)}"`);
      }
    } catch (e: any) {
      setCameraError("Format de code QR invalide.");
    }
  };

  const scanVideoFrame = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert"
      });

      if (code && code.data) {
        handleValidCodeScanned(code.data);
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
  };

  // Real Image Upload Scanner fallback
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          handleValidCodeScanned(code.data);
        } else {
          setCameraError("Aucun code QR détecté dans l'image sélectionnée. Veuillez essayer avec une image nette.");
        }
      }
    };
    img.src = URL.createObjectURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <QrCode className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white">Connexion par QR Code Réel</h3>
          </div>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => { stopCamera(); setMode('send'); }}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'send'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Mon QR Code (Émetteur)
          </button>
          <button
            onClick={() => setMode('receive')}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'receive'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Scanner avec la Caméra
          </button>
        </div>

        {/* Mode: Show QR Code */}
        {mode === 'send' && (
          <div className="flex flex-col items-center space-y-4 py-2">
            <div className="bg-white p-4 rounded-3xl shadow-2xl border-4 border-blue-500/30">
              <QRCodeSVG
                value={qrData}
                size={220}
                bgColor="#ffffff"
                fgColor="#07080f"
                level="M"
                includeMargin={false}
              />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-white">{settings.deviceName || localDevice.name}</p>
              <p className="text-xs text-slate-400">
                Pointez la caméra d'un autre appareil vers ce QR Code pour vous connecter instantanément.
              </p>
            </div>
          </div>
        )}

        {/* Mode: Real Camera Scanner */}
        {mode === 'receive' && (
          <div className="space-y-4">
            <div className="relative w-full h-64 bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden flex flex-col items-center justify-center">
              
              {/* Video Element for Camera Stream */}
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* QR Targeting Reticle Overlay */}
              {isScanning && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-violet-400 rounded-2xl relative animate-pulse">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-violet-400" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-violet-400" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-violet-400" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-violet-400" />
                  </div>
                </div>
              )}

              {/* Success Feedback */}
              {scannedResult && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 space-y-2 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                  <p className="text-sm font-bold text-white">QR Code détecté avec succès !</p>
                  <p className="text-xs text-slate-400">Connexion en cours...</p>
                </div>
              )}

              {/* Camera Error Message */}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 space-y-3 text-center">
                  <AlertTriangle className="w-10 h-10 text-amber-400" />
                  <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
                  <button
                    onClick={startCamera}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Réessayer la caméra</span>
                  </button>
                </div>
              )}
            </div>

            {/* Fallback to image file picker if camera is blocked or on desktop without webcam */}
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400">Ou importer une image de QR code :</span>
              <label className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Choisir image</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2 text-[11px] text-slate-400 bg-slate-950 p-3 rounded-2xl border border-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Vraie caméra & analyse optique en direct sans passer par aucun serveur cloud.</span>
        </div>

      </div>
    </div>
  );
};
