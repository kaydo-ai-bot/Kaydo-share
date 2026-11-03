import React, { useState, useEffect } from 'react';
import { AppSettings, AppView, FileCategory, KaydoFile, NearbyDevice, TransferHistoryRecord } from './types';
import { Navbar } from './components/Navbar';
import { HeroActions } from './components/HeroActions';
import { RadarScanner } from './components/RadarScanner';
import { QrCodeModal } from './components/QrCodeModal';
import { FileSelectorModal } from './components/FileSelectorModal';
import { TransferScreen } from './components/TransferScreen';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { CategoryBrowser } from './components/CategoryBrowser';
import { TransferManager } from './services/TransferManager';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [settings, setSettings] = useState<AppSettings>(() => {
    const savedName = localStorage.getItem('kaydo_device_name') || `KAYDO-${Math.floor(100 + Math.random() * 900)}`;
    const savedTheme = (localStorage.getItem('kaydo_theme') as 'dark' | 'light') || 'dark';
    return {
      deviceName: savedName,
      savePath: '/Download/KaydoShare',
      language: 'fr',
      themeMode: savedTheme,
      soundEnabled: true,
      autoAccept: false,
      themeColor: 'blue',
      preferredTechnology: 'auto'
    };
  });

  const [isConnected, setIsConnected] = useState(false);
  const [connectedPeerName, setConnectedPeerName] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>('photos');
  
  // Real files picked by the user from their device (strictly zero mock files)
  const [userFiles, setUserFiles] = useState<KaydoFile[]>([]);
  const [transferFiles, setTransferFiles] = useState<KaydoFile[]>([]);
  const [transferDirection, setTransferDirection] = useState<'send' | 'receive'>('send');

  const [isQrOpen, setIsQrOpen] = useState(false);
  const [qrMode, setQrMode] = useState<'send' | 'receive'>('send');

  // Real transfer history (strictly zero mock records)
  const [history, setHistory] = useState<TransferHistoryRecord[]>([]);

  useEffect(() => {
    localStorage.setItem('kaydo_theme', settings.themeMode);
    if (settings.themeMode === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [settings.themeMode]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.deviceName) {
        TransferManager.getInstance().setLocalDeviceName(newSettings.deviceName);
      }
      return updated;
    });
  };

  const handleAddFiles = (newFiles: KaydoFile[]) => {
    setUserFiles(prev => [...newFiles, ...prev]);
  };

  const handleConnectDevice = (device: NearbyDevice) => {
    setIsConnected(true);
    setConnectedPeerName(device.name);
  };

  const handleStartTransfer = (files: KaydoFile[], targetDevice?: NearbyDevice) => {
    if (targetDevice) {
      setConnectedPeerName(targetDevice.name);
      setIsConnected(true);
    }
    setTransferFiles(files);
    setTransferDirection('send');
    setCurrentView('transfer');
  };

  const handleTransferComplete = () => {
    // Record real completed transfers to history
    const newRecords: TransferHistoryRecord[] = transferFiles.map((f, idx) => ({
      id: `hist_${Date.now()}_${idx}`,
      fileName: f.name,
      fileSize: f.size,
      category: f.category,
      direction: transferDirection,
      peerName: connectedPeerName || 'Appareil distant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'completed',
      durationSeconds: 1,
      technology: 'WebRTC DataChannel'
    }));

    setHistory(prev => [...newRecords, ...prev]);
    setCurrentView('home');
  };

  const isDark = settings.themeMode !== 'light';

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors selection:bg-blue-500 selection:text-white ${
      isDark ? 'bg-[#07080f] text-slate-100' : 'bg-[#f8fafc] text-slate-900'
    }`}>
      
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        settings={settings}
        updateSettings={updateSettings}
        isConnected={isConnected}
        connectedPeerName={connectedPeerName}
      />

      {/* Main Content Router */}
      <main className="flex-1 pb-16">
        {currentView === 'home' && (
          <HeroActions
            setCurrentView={setCurrentView}
            setSelectedCategory={setSelectedCategory}
            settings={settings}
            openQrModal={(mode) => { setQrMode(mode); setIsQrOpen(true); }}
            isConnected={isConnected}
            connectedPeerName={connectedPeerName}
          />
        )}

        {currentView === 'send' && (
          <FileSelectorModal
            settings={settings}
            files={userFiles}
            onAddFiles={handleAddFiles}
            onBack={() => setCurrentView('home')}
            onStartTransfer={handleStartTransfer}
            connectedPeerName={connectedPeerName}
          />
        )}

        {currentView === 'receive' && (
          <RadarScanner
            settings={settings}
            mode="receive"
            onBack={() => setCurrentView('home')}
            onConnect={handleConnectDevice}
            isConnected={isConnected}
            connectedPeerName={connectedPeerName}
            startTransferWithDevice={(dev) => {
              setConnectedPeerName(dev.name);
              setIsConnected(true);
              setTransferDirection('receive');
              setCurrentView('transfer');
            }}
          />
        )}

        {currentView === 'radar' && (
          <RadarScanner
            settings={settings}
            mode="send"
            onBack={() => setCurrentView('home')}
            onConnect={handleConnectDevice}
            isConnected={isConnected}
            connectedPeerName={connectedPeerName}
            startTransferWithDevice={(dev) => {
              handleConnectDevice(dev);
              setCurrentView('send');
            }}
          />
        )}

        {currentView === 'transfer' && (
          <TransferScreen
            settings={settings}
            files={transferFiles}
            peerName={connectedPeerName || 'Appareil distant'}
            direction={transferDirection}
            onBack={() => setCurrentView('home')}
            onComplete={handleTransferComplete}
          />
        )}

        {currentView === 'history' && (
          <HistoryView
            settings={settings}
            history={history}
            onBack={() => setCurrentView('home')}
            onClearHistory={() => setHistory([])}
          />
        )}

        {currentView === 'settings' && (
          <SettingsView
            settings={settings}
            updateSettings={updateSettings}
            onBack={() => setCurrentView('home')}
          />
        )}

        {currentView === 'categories' && (
          <CategoryBrowser
            category={selectedCategory}
            files={userFiles}
            onAddFiles={handleAddFiles}
            settings={settings}
            onBack={() => setCurrentView('home')}
            onStartSend={(files) => {
              setTransferFiles(files);
              setTransferDirection('send');
              setCurrentView('transfer');
            }}
          />
        )}
      </main>

      {/* QR Code Modal with Real Camera Scanner */}
      <QrCodeModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        settings={settings}
        initialMode={qrMode}
        onConnectSuccess={(dev) => {
          handleConnectDevice(dev);
          if (qrMode === 'receive') {
            setTransferDirection('receive');
            setCurrentView('transfer');
          } else {
            setTransferDirection('send');
            setCurrentView('send');
          }
        }}
      />

    </div>
  );
}
