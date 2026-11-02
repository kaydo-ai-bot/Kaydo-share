import React, { useState } from 'react';
import { Settings as SettingsIcon, ArrowLeft, Smartphone, Globe, Folder, Volume2, ShieldCheck, Check } from 'lucide-react';
import { AppSettings } from '../types';
import { translations, LanguageKey } from '../i18n';

interface SettingsViewProps {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  updateSettings,
  onBack
}) => {
  const t = translations[settings.language];
  const [nameInput, setNameInput] = useState(settings.deviceName);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      updateSettings({ deviceName: nameInput.trim() });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      
      {/* Header */}
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
            {t.settings}
          </h2>
          <p className="text-xs text-slate-400">Configuration de l'appareil KAYDO SHARE</p>
        </div>

        <div className="w-20" />
      </div>

      <div className="space-y-6">
        
        {/* Device Name Configuration */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{t.deviceName}</h3>
              <p className="text-xs text-slate-400">Nom visible par les autres appareils lors de la recherche radar.</p>
            </div>
          </div>

          <form onSubmit={handleSaveName} className="flex space-x-3">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-2xl text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center space-x-1.5"
            >
              {savedSuccess ? <Check className="w-4 h-4" /> : null}
              <span>{savedSuccess ? 'Enregistré' : 'Enregistrer'}</span>
            </button>
          </form>
        </div>

        {/* Language Selection */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{t.language}</h3>
              <p className="text-xs text-slate-400">Langue de l'interface utilisateur.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {(['fr', 'en', 'es'] as LanguageKey[]).map((lang) => (
              <button
                key={lang}
                onClick={() => updateSettings({ language: lang })}
                className={`py-3 rounded-2xl text-xs font-bold uppercase transition-all border ${
                  settings.language === lang
                    ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'fr' ? 'Français' : lang === 'en' ? 'English' : 'Español'}
              </button>
            ))}
          </div>
        </div>

        {/* Storage Path & Sound Effects */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{t.storagePath}</h3>
                <p className="text-xs text-slate-400">/InternalStorage/Download/KaydoShare</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{t.soundEffects}</h3>
                <p className="text-xs text-slate-400">Sons de connexion et de transfert</p>
              </div>
            </div>

            <button
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
              className={`w-12 h-6 rounded-full transition-colors relative p-1 ${
                settings.soundEnabled ? 'bg-blue-600' : 'bg-slate-800'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                settings.soundEnabled ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        {/* Future iOS Note */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 flex items-center space-x-4">
          <ShieldCheck className="w-8 h-8 text-blue-400 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Compatibilité iOS Future</h4>
            <p className="text-xs text-slate-400">{t.futureIosNote}</p>
          </div>
        </div>

      </div>

    </div>
  );
};
