import React from 'react';
import { Share2, Globe, Smartphone, ShieldCheck, Settings, History } from 'lucide-react';
import { AppSettings, AppView } from '../types';
import { translations, LanguageKey } from '../i18n';

interface NavbarProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  isConnected: boolean;
  connectedPeerName: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  settings,
  updateSettings,
  isConnected,
  connectedPeerName
}) => {
  const t = translations[settings.language];

  const toggleLanguage = () => {
    const langs: LanguageKey[] = ['fr', 'en', 'es'];
    const nextIdx = (langs.indexOf(settings.language) + 1) % langs.length;
    updateSettings({ language: langs[nextIdx] });
  };

  return (
    <header className="sticky top-0 z-50 bg-[#090b14]/80 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        
        {/* Logo & Brand */}
        <div 
          onClick={() => setCurrentView('home')}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 p-0.5 shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#07080f] rounded-[10px] flex items-center justify-center">
              <Share2 className="w-5 h-5 text-blue-400 group-hover:rotate-12 transition-transform" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#07080f]" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-black text-lg tracking-wider bg-gradient-to-r from-blue-400 via-indigo-300 to-violet-400 bg-clip-text text-transparent">
                {t.appName}
              </span>
              <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center space-x-1">
              <Smartphone className="w-3 h-3 text-emerald-400 inline" />
              <span className="truncate max-w-[140px]">{settings.deviceName}</span>
            </p>
          </div>
        </div>

        {/* Connection status badge */}
        <div className="hidden md:flex items-center space-x-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full text-xs">
          {isConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-300">Connecté à <strong className="text-white">{connectedPeerName}</strong></span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 ml-1" />
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-slate-400">{t.offlineMode}</span>
            </>
          )}
        </div>

        {/* Actions & Navigation Controls */}
        <div className="flex items-center space-x-2">
          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            title="Changer de langue / Change language"
            className="flex items-center space-x-1 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span className="uppercase">{settings.language}</span>
          </button>

          {/* History */}
          <button
            onClick={() => setCurrentView('history')}
            title={t.history}
            className={`p-2.5 rounded-xl border transition-colors ${
              currentView === 'history' 
                ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' 
                : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-slate-300'
            }`}
          >
            <History className="w-4 h-4" />
          </button>

          {/* Settings */}
          <button
            onClick={() => setCurrentView('settings')}
            title={t.settings}
            className={`p-2.5 rounded-xl border transition-colors ${
              currentView === 'settings' 
                ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' 
                : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-slate-300'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
