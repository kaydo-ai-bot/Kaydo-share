import React from 'react';
import { Share2, Globe, Smartphone, ShieldCheck, Settings, History, Sun, Moon } from 'lucide-react';
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
  const isDark = settings.themeMode !== 'light';

  const toggleLanguage = () => {
    const langs: LanguageKey[] = ['fr', 'en', 'es'];
    const nextIdx = (langs.indexOf(settings.language) + 1) % langs.length;
    updateSettings({ language: langs[nextIdx] });
  };

  const toggleTheme = () => {
    updateSettings({ themeMode: isDark ? 'light' : 'dark' });
  };

  return (
    <header className={`sticky top-0 z-50 backdrop-blur-xl border-b px-4 py-3 transition-colors ${
      isDark ? 'bg-[#090b14]/85 border-slate-800/80 text-slate-100' : 'bg-white/90 border-slate-200 text-slate-900 shadow-sm'
    }`}>
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        
        {/* Logo & Brand */}
        <div 
          onClick={() => setCurrentView('home')}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 p-0.5 shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <div className={`w-full h-full rounded-[10px] flex items-center justify-center ${isDark ? 'bg-[#07080f]' : 'bg-white'}`}>
              <Share2 className="w-5 h-5 text-blue-500 group-hover:rotate-12 transition-transform" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#07080f]" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-black text-lg tracking-wider bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
                {t.appName}
              </span>
              <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                PRO
              </span>
            </div>
            <p className={`text-[11px] flex items-center space-x-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Smartphone className="w-3 h-3 text-emerald-400 inline" />
              <span className="truncate max-w-[140px]">{settings.deviceName}</span>
            </p>
          </div>
        </div>

        {/* Connection status badge */}
        <div className={`hidden md:flex items-center space-x-2 border px-3 py-1.5 rounded-full text-xs ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}>
          {isConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                Connecté à <strong className={isDark ? 'text-white' : 'text-slate-900'}>{connectedPeerName}</strong>
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 ml-1" />
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t.offlineMode}</span>
            </>
          )}
        </div>

        {/* Actions & Navigation Controls */}
        <div className="flex items-center space-x-2">
          {/* Dark / Light Mode Toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? t.lightMode : t.darkMode}
            className={`p-2.5 rounded-xl border transition-colors ${
              isDark 
                ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-amber-400' 
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            title="Changer de langue / Change language"
            className={`flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              isDark 
                ? 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-blue-500" />
            <span className="uppercase">{settings.language}</span>
          </button>

          {/* History */}
          <button
            onClick={() => setCurrentView('history')}
            title={t.history}
            className={`p-2.5 rounded-xl border transition-colors ${
              currentView === 'history' 
                ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' 
                : isDark 
                  ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-slate-300' 
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
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
                : isDark 
                  ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-slate-300' 
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
