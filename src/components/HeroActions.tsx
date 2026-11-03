import React from 'react';
import { Send, Download, Image, Video, Music, Smartphone, FileText, FolderDown, Folder, QrCode, Wifi, Monitor, Laptop } from 'lucide-react';
import { AppSettings, AppView, FileCategory } from '../types';
import { translations } from '../i18n';

interface HeroActionsProps {
  setCurrentView: (view: AppView) => void;
  setSelectedCategory: (category: FileCategory) => void;
  settings: AppSettings;
  openQrModal: (mode: 'send' | 'receive') => void;
  isConnected: boolean;
  connectedPeerName: string | null;
}

export const HeroActions: React.FC<HeroActionsProps> = ({
  setCurrentView,
  setSelectedCategory,
  settings,
  openQrModal,
  isConnected,
  connectedPeerName
}) => {
  const t = translations[settings.language];
  const isDark = settings.themeMode !== 'light';

  const handleCategoryClick = (cat: FileCategory) => {
    setSelectedCategory(cat);
    setCurrentView('categories');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      
      {/* Welcome & Universal Compatibility Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
          <Wifi className="w-3.5 h-3.5 animate-pulse" />
          <span>Plateforme Universelle Hors-Ligne : Android • iPhone • Windows • Mac • Linux</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-violet-400 bg-clip-text text-transparent">
          KAYDO <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent">SHARE</span>
        </h1>
        <p className={`text-sm sm:text-base max-w-xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Transférez photos, vidéos, musiques, documents et dossiers directement entre appareils sans connexion Internet, sans serveur distant et sans compte utilisateur.
        </p>
      </div>

      {/* Two Main Action Cards: ENVOYER / RECEVOIR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* ENVOYER (SEND) */}
        <div 
          onClick={() => setCurrentView('send')}
          className={`group relative border-2 rounded-3xl p-8 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden ${
            isDark
              ? 'bg-gradient-to-br from-blue-950/40 via-slate-900/80 to-slate-950 border-blue-500/30 hover:border-blue-500 hover:shadow-blue-500/20'
              : 'bg-gradient-to-br from-blue-50 to-white border-blue-200 hover:border-blue-500 hover:shadow-blue-200'
          }`}
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl group-hover:bg-blue-600/20 transition-all pointer-events-none" />
          
          <div className="relative z-10 flex flex-col h-full justify-between space-y-6">
            <div className="flex items-center justify-between">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                <Send className="w-8 h-8" />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); openQrModal('send'); }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold transition-colors"
              >
                <QrCode className="w-4 h-4" />
                <span>QR Code</span>
              </button>
            </div>

            <div className="space-y-2">
              <h2 className={`text-2xl font-bold tracking-wide transition-colors ${isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'}`}>
                {t.send}
              </h2>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Sélectionnez et envoyez vos fichiers et dossiers vers n'importe quel appareil Android, iOS, Windows, Mac ou Linux.
              </p>
            </div>

            <div className={`pt-4 flex items-center justify-between border-t text-xs ${isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                <span>Fichiers, Dossiers, Photos, Vidéos, APK</span>
              </span>
              <span className="font-bold text-blue-400 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </div>

        {/* RECEVOIR (RECEIVE) */}
        <div 
          onClick={() => setCurrentView('receive')}
          className={`group relative border-2 rounded-3xl p-8 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden ${
            isDark
              ? 'bg-gradient-to-br from-violet-950/40 via-slate-900/80 to-slate-950 border-violet-500/30 hover:border-violet-500 hover:shadow-violet-500/20'
              : 'bg-gradient-to-br from-violet-50 to-white border-violet-200 hover:border-violet-500 hover:shadow-violet-200'
          }`}
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-violet-600/10 rounded-full blur-3xl group-hover:bg-violet-600/20 transition-all pointer-events-none" />

          <div className="relative z-10 flex flex-col h-full justify-between space-y-6">
            <div className="flex items-center justify-between">
              <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-400 group-hover:scale-110 transition-transform">
                <Download className="w-8 h-8" />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); openQrModal('receive'); }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/30 text-xs font-semibold transition-colors"
              >
                <QrCode className="w-4 h-4" />
                <span>Scanner</span>
              </button>
            </div>

            <div className="space-y-2">
              <h2 className={`text-2xl font-bold tracking-wide transition-colors ${isDark ? 'text-white group-hover:text-violet-400' : 'text-slate-900 group-hover:text-violet-600'}`}>
                {t.receive}
              </h2>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Ouvrez le radar pour découvrir les émetteurs proches et recevoir les données directement en toute sécurité.
              </p>
            </div>

            <div className={`pt-4 flex items-center justify-between border-t text-xs ${isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-ping" />
                <span>{isConnected ? `Connecté: ${connectedPeerName}` : t.waitingPeer}</span>
              </span>
              <span className="font-bold text-violet-400 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </div>

      </div>

      {/* Categories Grid (Photos, Videos, Music, Apps, Documents, Downloads, Folders) */}
      <div className="space-y-4 pt-4">
        <h3 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Explorer par catégorie
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          
          <div 
            onClick={() => handleCategoryClick('photos')}
            className={`group rounded-2xl p-4 flex flex-col items-center text-center space-y-2 cursor-pointer transition-all border ${
              isDark ? 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 hover:border-blue-500/50' : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-blue-400 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Image className="w-6 h-6" />
            </div>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t.photos}</span>
          </div>

          <div 
            onClick={() => handleCategoryClick('videos')}
            className={`group rounded-2xl p-4 flex flex-col items-center text-center space-y-2 cursor-pointer transition-all border ${
              isDark ? 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 hover:border-violet-500/50' : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-violet-400 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Video className="w-6 h-6" />
            </div>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t.videos}</span>
          </div>

          <div 
            onClick={() => handleCategoryClick('music')}
            className={`group rounded-2xl p-4 flex flex-col items-center text-center space-y-2 cursor-pointer transition-all border ${
              isDark ? 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 hover:border-pink-500/50' : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-pink-400 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Music className="w-6 h-6" />
            </div>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t.music}</span>
          </div>

          <div 
            onClick={() => handleCategoryClick('apps')}
            className={`group rounded-2xl p-4 flex flex-col items-center text-center space-y-2 cursor-pointer transition-all border ${
              isDark ? 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 hover:border-emerald-500/50' : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-emerald-400 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Smartphone className="w-6 h-6" />
            </div>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t.apps}</span>
          </div>

          <div 
            onClick={() => handleCategoryClick('documents')}
            className={`group rounded-2xl p-4 flex flex-col items-center text-center space-y-2 cursor-pointer transition-all border ${
              isDark ? 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 hover:border-amber-500/50' : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-amber-400 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6" />
            </div>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t.documents}</span>
          </div>

          <div 
            onClick={() => handleCategoryClick('downloads')}
            className={`group rounded-2xl p-4 flex flex-col items-center text-center space-y-2 cursor-pointer transition-all border ${
              isDark ? 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 hover:border-cyan-500/50' : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-cyan-400 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FolderDown className="w-6 h-6" />
            </div>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t.downloads}</span>
          </div>

          <div 
            onClick={() => handleCategoryClick('folders')}
            className={`group rounded-2xl p-4 flex flex-col items-center text-center space-y-2 cursor-pointer transition-all border ${
              isDark ? 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 hover:border-indigo-500/50' : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-indigo-400 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Folder className="w-6 h-6" />
            </div>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t.folders}</span>
          </div>

        </div>
      </div>

    </div>
  );
};
