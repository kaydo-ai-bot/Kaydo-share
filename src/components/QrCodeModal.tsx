import React, { useState } from 'react';
import { X, QrCode, Camera, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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

  if (!isOpen) return null;

  const manager = TransferManager.getInstance();
  const localDevice = manager.getLocalDevice();
  const sessionCode = `kaydoshare://session?device=${encodeURIComponent(localDevice.name)}&id=${localDevice.id}&pin=${manager.getSecurityPin()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <QrCode className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white">Connexion par QR Code</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setMode('send')}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'send'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Afficher mon QR Code
          </button>
          <button
            onClick={() => setMode('receive')}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'receive'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Scanner un QR Code
          </button>
        </div>

        {/* Content */}
        {mode === 'send' ? (
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="bg-white p-4 rounded-3xl shadow-xl">
              <QRCodeSVG
                value={sessionCode}
                size={200}
                bgColor="#ffffff"
                fgColor="#07080f"
                level="H"
                includeMargin={false}
              />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-white">{settings.deviceName}</p>
              <p className="text-xs text-slate-400">Scannez ce code depuis un autre appareil pour établir le canal P2P direct.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="relative w-full h-56 bg-slate-950 border-2 border-dashed border-slate-700 rounded-3xl flex flex-col items-center justify-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 animate-pulse">
                <Camera className="w-8 h-8" />
              </div>
              <p className="text-xs text-slate-400 text-center">
                Pointez la caméra vers le QR code de l'appareil distant pour synchroniser la session hors-ligne.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2 text-[11px] text-slate-400 bg-slate-950 p-3 rounded-2xl border border-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Sécurité cryptographique sans serveur central ni Internet.</span>
        </div>

      </div>
    </div>
  );
};
