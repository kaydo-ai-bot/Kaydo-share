import React, { useState, useEffect } from 'react';
import { Smartphone, ShieldCheck, QrCode, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { AppSettings, NearbyDevice, TransferTask } from '../types';
import { translations } from '../i18n';

interface RadarScannerProps {
  settings: AppSettings;
  mode: 'send' | 'receive';
  onBack: () => void;
  onConnect: (device: NearbyDevice) => void;
  isConnected: boolean;
  connectedPeerName: string | null;
  startTransferWithDevice: (device: NearbyDevice) => void;
}

const MOCK_NEARBY_DEVICES: NearbyDevice[] = [
  { id: 'd1', name: 'KAYDO-Galaxy-S24', model: 'Samsung Galaxy S24 Ultra', os: 'Android', rssi: -42, avatarColor: 'bg-blue-600' },
  { id: 'd2', name: 'KAYDO-Pixel-9-Pro', model: 'Google Pixel 9 Pro', os: 'Android', rssi: -58, avatarColor: 'bg-indigo-600' },
  { id: 'd3', name: 'KAYDO-Redmi-Note13', model: 'Xiaomi Redmi Note 13', os: 'Android', rssi: -65, avatarColor: 'bg-violet-600' },
  { id: 'd4', name: 'KAYDO-iPhone-16', model: 'Apple iPhone 16 Pro (Futur)', os: 'iOS', rssi: -72, avatarColor: 'bg-slate-700' },
];

export const RadarScanner: React.FC<RadarScannerProps> = ({
  settings,
  mode,
  onBack,
  onConnect,
  isConnected,
  connectedPeerName,
  startTransferWithDevice
}) => {
  const t = translations[settings.language];
  const [devices, setDevices] = useState<NearbyDevice[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [incomingRequest, setIncomingRequest] = useState<NearbyDevice | null>(null);

  useEffect(() => {
    // Simulate radar discovery
    const timer = setTimeout(() => {
      setDevices(MOCK_NEARBY_DEVICES);
      setIsScanning(false);
    }, 2000);

    // If receive mode, simulate incoming connection request after 4 seconds if not connected
    let incomingTimer: NodeJS.Timeout;
    if (mode === 'receive' && !isConnected) {
      incomingTimer = setTimeout(() => {
        setIncomingRequest(MOCK_NEARBY_DEVICES[0]);
      }, 4500);
    }

    return () => {
      clearTimeout(timer);
      if (incomingTimer) clearTimeout(incomingTimer);
    };
  }, [mode, isConnected]);

  const handleAcceptIncoming = () => {
    if (incomingRequest) {
      onConnect(incomingRequest);
      setIncomingRequest(null);
    }
  };

  const handleRejectIncoming = () => {
    setIncomingRequest(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-slate-400 hover:text-white bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800 text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.back}</span>
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">
            {mode === 'send' ? t.send : t.receive} • Radar P2P
          </h2>
          <p className="text-xs text-slate-400">{t.radarSubtitle}</p>
        </div>
        <button
          onClick={() => { setIsScanning(true); setDevices([]); setTimeout(() => { setDevices(MOCK_NEARBY_DEVICES); setIsScanning(false); }, 1500); }}
          className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
          title="Actualiser"
        >
          <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Incoming Connection Request Modal Banner */}
      {incomingRequest && (
        <div className="bg-gradient-to-r from-blue-950/80 via-indigo-950/80 to-slate-900 border-2 border-blue-500 rounded-3xl p-6 shadow-2xl shadow-blue-500/20 animate-bounce-once space-y-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
              {incomingRequest.name.substring(6, 8)}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{incomingRequest.name}</h3>
              <p className="text-xs text-blue-300">{incomingRequest.model} ({incomingRequest.os}) {t.wantsToConnect}</p>
            </div>
          </div>
          <div className="flex space-x-3 pt-2">
            <button
              onClick={handleAcceptIncoming}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-lg transition-all"
            >
              {t.accept}
            </button>
            <button
              onClick={handleRejectIncoming}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors"
            >
              {t.reject}
            </button>
          </div>
        </div>
      )}

      {/* Radar Animation Area */}
      <div className="relative w-full h-80 bg-slate-950/80 border border-slate-800/80 rounded-3xl overflow-hidden flex items-center justify-center">
        
        {/* Pulsing rings */}
        <div className="absolute w-40 h-40 rounded-full border border-blue-500/20 animate-ping" />
        <div className="absolute w-64 h-64 rounded-full border border-indigo-500/20 animate-pulse" />
        <div className="absolute w-96 h-96 rounded-full border border-violet-500/10" />

        {/* Center my device */}
        <div className="absolute z-20 flex flex-col items-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-violet-600 p-0.5 shadow-xl shadow-blue-500/40">
            <div className="w-full h-full bg-[#07080f] rounded-[14px] flex items-center justify-center text-blue-400">
              <Smartphone className="w-8 h-8" />
            </div>
          </div>
          <span className="text-xs font-bold text-slate-200 bg-slate-900/90 px-3 py-1 rounded-full border border-slate-800">
            {settings.deviceName} (Moi)
          </span>
        </div>

        {/* Discovered Devices Floating Nodes */}
        {!isScanning && devices.map((dev, idx) => {
          // Positioning around center
          const angle = (idx / devices.length) * 2 * Math.PI;
          const radius = 110;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          const isConnectedHere = connectedPeerName === dev.name;

          return (
            <div
              key={dev.id}
              onClick={() => {
                onConnect(dev);
                if (mode === 'send') {
                  startTransferWithDevice(dev);
                }
              }}
              style={{ transform: `translate(${x}px, ${y}px)` }}
              className="absolute z-30 group cursor-pointer flex flex-col items-center space-y-1 transition-transform hover:scale-110"
            >
              <div className={`w-12 h-12 rounded-2xl ${dev.avatarColor} text-white flex items-center justify-center shadow-lg border-2 ${isConnectedHere ? 'border-emerald-400 animate-pulse' : 'border-slate-800'}`}>
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-xl text-[11px] text-center shadow-md">
                <p className="font-bold text-white truncate max-w-[100px]">{dev.name}</p>
                <p className="text-[9px] text-slate-400">{dev.rssi} dBm</p>
              </div>
              {isConnectedHere && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-950 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </span>
              )}
            </div>
          );
        })}

        {isScanning && (
          <div className="absolute bottom-4 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded-full animate-pulse">
            Recherche d'appareils à proximité...
          </div>
        )}

      </div>

      {/* Discovered Devices List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Appareils détectés ({devices.length})
        </h3>
        <div className="space-y-2">
          {devices.map((dev) => {
            const isConnectedHere = connectedPeerName === dev.name;
            return (
              <div
                key={dev.id}
                onClick={() => {
                  onConnect(dev);
                  if (mode === 'send') {
                    startTransferWithDevice(dev);
                  }
                }}
                className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                  isConnectedHere
                    ? 'bg-emerald-950/20 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl ${dev.avatarColor} text-white flex items-center justify-center font-bold`}>
                    {dev.name.substring(6, 8)}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center space-x-2">
                      <span>{dev.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-normal">{dev.os}</span>
                    </h4>
                    <p className="text-xs text-slate-400">{dev.model} • Signal {dev.rssi} dBm</p>
                  </div>
                </div>

                <div>
                  {isConnectedHere ? (
                    <span className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Connecté</span>
                    </span>
                  ) : (
                    <button className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-colors">
                      {mode === 'send' ? 'Sélectionner & Envoyer' : 'Connecter'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
