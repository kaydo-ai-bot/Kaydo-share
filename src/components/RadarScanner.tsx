import React, { useState, useEffect } from 'react';
import { Smartphone, ShieldCheck, QrCode, ArrowLeft, RefreshCw, CheckCircle2, WifiOff } from 'lucide-react';
import { AppSettings, NearbyDevice } from '../types';
import { TransferManager } from '../services/TransferManager';
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
  const [incomingRequest, setIncomingRequest] = useState<{ device: NearbyDevice; pin: string } | null>(null);

  useEffect(() => {
    const manager = TransferManager.getInstance();

    manager.setListener({
      onPeersUpdated: (peers: NearbyDevice[]) => {
        setDevices(peers);
      },
      onIncomingConnectionRequest: (device: NearbyDevice, pin: string) => {
        setIncomingRequest({ device, pin });
      },
      onConnectionEstablished: (device: NearbyDevice) => {
        onConnect(device);
        if (mode === 'send') {
          startTransferWithDevice(device);
        }
      }
    });

    if (mode === 'send') {
      manager.startDiscovery();
    } else {
      manager.startAdvertising();
    }

    return () => {
      manager.stopDiscovery();
    };
  }, [mode]);

  const handleAcceptIncoming = () => {
    if (incomingRequest) {
      const manager = TransferManager.getInstance();
      manager.acceptConnection(incomingRequest.device);
      onConnect(incomingRequest.device);
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
            {mode === 'send' ? t.send : t.receive} • Radar P2P Réel
          </h2>
          <p className="text-xs text-slate-400">Aucune simulation - Appareils réels détectés sur le réseau</p>
        </div>
        <button
          onClick={() => {
            const manager = TransferManager.getInstance();
            if (mode === 'send') manager.startDiscovery();
            else manager.startAdvertising();
          }}
          className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
          title="Actualiser"
        >
          <RefreshCw className="w-4 h-4 animate-spin" />
        </button>
      </div>

      {/* Incoming Connection Request Modal Banner */}
      {incomingRequest && (
        <div className="bg-gradient-to-r from-blue-950/90 via-indigo-950/90 to-slate-900 border-2 border-blue-500 rounded-3xl p-6 shadow-2xl space-y-4 animate-bounce-once">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
              {incomingRequest.device.name.substring(6, 8)}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{incomingRequest.device.name}</h3>
              <p className="text-xs text-blue-300">Souhaite se connecter (Code PIN: <strong className="text-white">{incomingRequest.pin}</strong>)</p>
            </div>
          </div>
          <div className="flex space-x-3 pt-2">
            <button
              onClick={handleAcceptIncoming}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-lg transition-all"
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
      <div className="relative w-full h-72 bg-slate-950/80 border border-slate-800/80 rounded-3xl overflow-hidden flex items-center justify-center">
        
        {/* Pulsing rings */}
        <div className="absolute w-40 h-40 rounded-full border border-blue-500/20 animate-ping" />
        <div className="absolute w-64 h-64 rounded-full border border-indigo-500/20 animate-pulse" />

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

      </div>

      {/* Discovered Devices List (Zero fake devices) */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Appareils réels découverts ({devices.length})
        </h3>

        {devices.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-10 text-center space-y-3">
            <WifiOff className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-white">Aucun appareil à proximité</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Ouvrez KAYDO SHARE dans un autre onglet du navigateur ou sur un autre appareil du réseau pour établir une connexion P2P réelle.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((dev) => {
              const isConnectedHere = connectedPeerName === dev.name;
              return (
                <div
                  key={dev.id}
                  onClick={() => {
                    const manager = TransferManager.getInstance();
                    manager.requestConnect(dev);
                    onConnect(dev);
                    if (mode === 'send') {
                      startTransferWithDevice(dev);
                    }
                  }}
                  className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                    isConnectedHere
                      ? 'bg-emerald-950/20 border-emerald-500/50'
                      : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                      {dev.name.substring(6, 8)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">{dev.name}</h4>
                      <p className="text-xs text-slate-400">{dev.model} • P2P Direct</p>
                    </div>
                  </div>

                  <button className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-colors">
                    Connecter
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
