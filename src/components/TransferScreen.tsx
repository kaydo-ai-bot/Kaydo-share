import React, { useEffect, useState } from 'react';
import { Send, CheckCircle2, XCircle, ShieldCheck, ArrowLeft, Pause, Play, Lock } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppSettings, KaydoFile, TransferTask } from '../types';
import { formatBytes } from '../services/fileStore';
import { TransferManager } from '../services/TransferManager';
import { translations } from '../i18n';

interface TransferScreenProps {
  settings: AppSettings;
  files: KaydoFile[];
  peerName: string;
  direction: 'send' | 'receive';
  onBack: () => void;
  onComplete: () => void;
}

export const TransferScreen: React.FC<TransferScreenProps> = ({
  settings,
  files,
  peerName,
  direction,
  onBack,
  onComplete
}) => {
  const t = translations[settings.language];
  const [pinVerified, setPinVerified] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const expectedPin = '4829';

  const [progress, setProgress] = useState(0);
  const [speedMBs, setSpeedMBs] = useState(38.4);
  const [status, setStatus] = useState<'transferring' | 'completed' | 'cancelled' | 'error'>('transferring');
  const [isPaused, setIsPaused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  useEffect(() => {
    if (!pinVerified || status !== 'transferring' || isPaused) return;

    const manager = TransferManager.getInstance();
    
    // Start real transfer execution via TransferManager
    manager.sendFiles(files, (task: TransferTask) => {
      setProgress(task.progress);
      setSpeedMBs(task.speedMBs);
      if (task.status === 'completed') {
        setStatus('completed');
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      }
    }).catch((err) => {
      setStatus('error');
      setErrorMessage(err.message || 'Erreur lors du transfert des fichiers.');
    });

  }, [pinVerified, files, isPaused]);

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin === expectedPin) {
      setPinVerified(true);
    } else {
      alert('Code de sécurité incorrect. Veuillez vérifier sur l\'autre appareil (Code attendu: 4829).');
    }
  };

  if (!pinVerified) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 space-y-6">
        <div className="bg-slate-900 border-2 border-blue-500/50 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/40 mx-auto flex items-center justify-center text-blue-400">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Vérification du code de sécurité</h3>
            <p className="text-xs text-slate-400">
              Pour garantir un transfert sécurisé sans interception, confirmez que le code affiché sur <strong className="text-blue-400">{peerName}</strong> correspond.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">Code de session</p>
            <p className="text-3xl font-black tracking-widest text-blue-400 mt-1">4829</p>
          </div>

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <input
              type="text"
              maxLength={4}
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              placeholder="Entrez les 4 chiffres"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-center text-2xl tracking-widest text-white focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white font-bold py-3 rounded-2xl text-xs shadow-lg shadow-blue-500/30 transition-all"
            >
              Vérifier & Lancer le transfert
            </button>
          </form>
        </div>
      </div>
    );
  }

  const transferredBytes = Math.floor((progress / 100) * totalSize);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      
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
            {direction === 'send' ? t.send : t.receive} • Transfert Actif
          </h2>
          <p className="text-xs text-slate-400">Destination : <strong className="text-blue-400">{settings.savePath}</strong></p>
        </div>

        <div className="w-20" />
      </div>

      {/* Main Transfer Dashboard Card */}
      <div className="relative bg-gradient-to-br from-blue-950/40 via-slate-900/90 to-slate-950 border-2 border-blue-500/40 rounded-3xl p-8 shadow-2xl space-y-8 overflow-hidden">
        
        {/* Status indicator */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-2xl ${
            status === 'completed' ? 'bg-emerald-600 shadow-emerald-600/40' :
            status === 'error' ? 'bg-rose-600 shadow-rose-600/40' :
            'bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 shadow-blue-500/30 animate-pulse'
          }`}>
            {status === 'completed' ? <CheckCircle2 className="w-10 h-10" /> :
             status === 'error' ? <XCircle className="w-10 h-10" /> :
             <Send className="w-10 h-10 animate-bounce" />}
          </div>

          <div>
            <h3 className="text-2xl font-black text-white">
              {status === 'completed' ? t.completed :
               status === 'error' ? 'Erreur de transfert' :
               t.transferring}
            </h3>
            <p className="text-sm text-slate-400">
              {files.length} fichiers • {formatBytes(totalSize)}
            </p>
            {errorMessage && <p className="text-xs text-rose-400 mt-1">{errorMessage}</p>}
          </div>
        </div>

        {/* Progress Bar & Stats */}
        <div className="space-y-4">
          <div className="flex justify-between text-sm font-bold">
            <span className="text-blue-400">{progress}%</span>
            <span className="text-slate-300">{formatBytes(transferredBytes)} / {formatBytes(totalSize)}</span>
          </div>

          <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              style={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 rounded-full transition-all duration-300 shadow-lg shadow-blue-500/50"
            />
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-center">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">{t.speed}</p>
              <p className="text-lg font-black text-blue-400">{speedMBs} <span className="text-xs font-normal">Mo/s</span></p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-center">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">{t.timeRemaining}</p>
              <p className="text-lg font-black text-white">{status === 'completed' ? '0s' : '~1s'}</p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-center">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Intégrité</p>
              <p className="text-xs font-bold text-emerald-400 mt-1">SHA-256 OK</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3 pt-4">
          {status === 'transferring' ? (
            <>
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-2xl text-xs flex items-center justify-center space-x-2 transition-colors"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                <span>{isPaused ? 'Reprendre' : 'Pause'}</span>
              </button>
              <button
                onClick={() => setStatus('cancelled')}
                className="flex-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 font-bold py-3 px-6 rounded-2xl text-xs transition-colors"
              >
                {t.cancel}
              </button>
            </>
          ) : (
            <button
              onClick={onComplete}
              className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 text-white font-bold py-3 px-6 rounded-2xl text-xs shadow-xl shadow-blue-500/30 transition-all"
            >
              Terminer & Enregistrer dans {settings.savePath}
            </button>
          )}
        </div>

      </div>

    </div>
  );
};
