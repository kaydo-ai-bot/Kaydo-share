import React, { useState } from 'react';
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

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [settings, setSettings] = useState<AppSettings>({
    deviceName: 'KAYDO-Android-Pro',
    savePath: '/Download/KaydoShare',
    language: 'fr',
    soundEnabled: true,
    autoAccept: false,
    themeColor: 'blue'
  });

  const [isConnected, setIsConnected] = useState(false);
  const [connectedPeerName, setConnectedPeerName] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>('photos');
  
  const [transferFiles, setTransferFiles] = useState<KaydoFile[]>([]);
  const [transferDirection, setTransferDirection] = useState<'send' | 'receive'>('send');

  const [isQrOpen, setIsQrOpen] = useState(false);
  const [qrMode, setQrMode] = useState<'send' | 'receive'>('send');

  const [history, setHistory] = useState<TransferHistoryRecord[]>([
    {
      id: 'h1',
      fileName: 'Vacances_Bali_2026.jpg',
      fileSize: 4200000,
      category: 'photos',
      direction: 'send',
      peerName: 'KAYDO-Galaxy-S24',
      timestamp: 'Il y a 10 min',
      status: 'completed',
      durationSeconds: 1
    }
  ]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
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
    // Add to history
    const newRecords: TransferHistoryRecord[] = transferFiles.map((f, idx) => ({
      id: `hist_${Date.now()}_${idx}`,
      fileName: f.name,
      fileSize: f.size,
      category: f.category,
      direction: transferDirection,
      peerName: connectedPeerName || 'Appareil distant',
      timestamp: 'À l\'instant',
      status: 'completed',
      durationSeconds: 2
    }));

    setHistory([...newRecords, ...history]);
    setCurrentView('home');
  };

  return (
    <div className="min-h-screen bg-[#07080f] text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      
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
              // If receiver accepts or initiates
              setConnectedPeerName(dev.name);
              setIsConnected(true);
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

      {/* QR Code Modal */}
      <QrCodeModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        settings={settings}
        initialMode={qrMode}
        onConnectSuccess={(dev) => {
          handleConnectDevice(dev);
          if (qrMode === 'receive') {
            setCurrentView('send');
          }
        }}
      />

    </div>
  );
}
