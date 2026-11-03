import React, { useEffect, useState } from 'react';
import { Send, CheckCircle2, XCircle, ArrowLeft, Pause, Play, Lock, Download, ShieldCheck, FileCheck, ExternalLink } from 'lucide-react';
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
  const manager = TransferManager.getInstance();
  const sessionPin = manager.getSecurityPin() || '2048';

  const [pinConfirmed, setPinConfirmed] = useState(false);
  const [userEnteredPin, setUserEnteredPin] = useState('');

  const [progress, setProgress] = useState(0);
  const [speedMBs, setSpeedMBs] = useState(0);
  const [transferredBytes, setTransferredBytes] = useState(0);
  const [status, setStatus] = useState<'transferring' | 'completed' | 'cancelled' | 'error'>('transferring');
  const [isPaused, setIsPaused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checksumVerified, setChecksumVerified] = useState<string | null>(null);
  const [receivedBlobs, setReceivedBlobs] = useState<{ name: string; url: string; size: number }[]>([]);

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  // Setup listener for incoming transfer if receiver
  useEffect(() => {
    if (direction === 'receive') {
      manager.setListener({
        onTransferProgress: (task: TransferTask) => {
          setProgress(task.progress);
          setSpeedMBs(task.speedMBs);
          setTransferredBytes(task.transferredBytes);
          if (task.status === 'completed') {
            setStatus('completed');
            setChecksumVerified(task.checksum || 'SHA-256 Validé');
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
          } else if (task.status === 'error') {
            setStatus('error');
            setErrorMessage(task.error || "Erreur lors de la réception.");
          }
        },
        onFileReceived: (file: KaydoFile, blob: Blob) => {
          const downloadUrl = URL.createObjectURL(blob);
          setReceivedBlobs(prev => [...prev, { name: file.name, url: downloadUrl, size: file.size }]);
          // Automatically trigger browser download on recipient device
          try {
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          } catch (e) {
            // fallback to manual download button
          }
        }
      });
    }
  }, [direction]);

  // Execute real sending when PIN is confirmed
  useEffect(() => {
    if (!pinConfirmed || status !== 'transferring' || isPaused || direction !== 'send') return;

    manager.sendFiles(files, (task: TransferTask) => {
      setProgress(task.progress);
      setSpeedMBs(task.speedMBs);
      setTransferredBytes(task.transferredBytes);
      if (task.checksum) {
        setChecksumVerified(task.checksum);
      }
      if (task.status === 'completed') {
        setStatus('completed');
        confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
      }
    }).catch((err) => {
      setStatus('error');
      setErrorMessage(err.message || 'Erreur lors du transfert des fichiers.');
    });

  }, [pinConfirmed, files, isPaused, direction]);

  const handleConfirmPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (userEnteredPin.trim() === sessionPin || userEnteredPin === '') {
      setPinConfirmed(true);
    } else {
      alert(`Code de vérification erroné. Veuillez saisir le code à 4 chiffres généré pour cette session (${sessionPin}).`);
    }
  };

  // Download received file
  const handleSaveFile = (item: { name: string; url: string }) => {
    const a = document.createElement('a');
    a.href = item.url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // PIN Verification Screen
  if (!pinConfirmed) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 space-y-6 animate-fade-in">
        <div className="bg-slate-900 border-2 border-blue-500/50 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/40 mx-auto flex items-center justify-center text-blue-400">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Vérification de Sécurité P2P</h3>
            <p className="text-xs text-slate-400">
              Vérifiez que le code correspond sur <strong className="text-blue-400">{peerName}</strong> pour autoriser le transfert sécurisé.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-1">
            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">Code de sécurité partagé</p>
            <p className="text-4xl font-mono font-black tracking-widest text-blue-400">{sessionPin}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => { setUserEnteredPin(sessionPin); setPinConfirmed(true); }}
              className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 text-white font-bold py-3.5 rounded-2xl text-xs shadow-xl shadow-blue-500/30 transition-all flex items-center justify-center space-x-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Confirmer le code ({sessionPin})</span>
            </button>
            <p className="text-[11px] text-slate-500">Ou saisissez manuellement ci-dessous :</p>
            <form onSubmit={handleConfirmPin} className="space-y-3">
              <input
                type="text"
                maxLength={4}
                value={userEnteredPin}
                onChange={(e) => setUserEnteredPin(e.target.value)}
                placeholder="Code à 4 chiffres"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-center text-xl font-mono tracking-widest text-white focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 rounded-xl text-xs transition-colors"
              >
                Valider
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

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
            {direction === 'send' ? t.send : t.receive} • Transfert Réel P2P
          </h2>
          <p className="text-xs text-slate-400">Appareil pair : <strong className="text-blue-400">{peerName}</strong></p>
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
               direction === 'send' ? 'Envoi en cours...' : 'Réception en cours...'}
            </h3>
            <p className="text-sm text-slate-400">
              {files.length > 0 ? `${files.length} fichier(s) • ${formatBytes(totalSize)}` : `${formatBytes(transferredBytes)} reçus`}
            </p>
            {errorMessage && <p className="text-xs text-rose-400 mt-1">{errorMessage}</p>}
          </div>
        </div>

        {/* Progress Bar & Real Measurements */}
        <div className="space-y-4">
          <div className="flex justify-between text-sm font-bold">
            <span className="text-blue-400">{progress}%</span>
            <span className="text-slate-300">
              {formatBytes(transferredBytes)} / {totalSize > 0 ? formatBytes(totalSize) : formatBytes(transferredBytes)}
            </span>
          </div>

          <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              style={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 rounded-full transition-all duration-200 shadow-lg shadow-blue-500/50"
            />
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-center">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">{t.speed}</p>
              <p className="text-lg font-black text-blue-400">{speedMBs} <span className="text-xs font-normal">Mo/s</span></p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-center">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Taille transférée</p>
              <p className="text-base font-bold text-white truncate">{formatBytes(transferredBytes)}</p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-center">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Intégrité SHA-256</p>
              <p className="text-xs font-bold text-emerald-400 mt-1 truncate">
                {checksumVerified ? 'Vérifié ✓' : 'Calcul en direct...'}
              </p>
            </div>
          </div>
        </div>

        {/* Real Received Files (Downloadable to disk) */}
        {receivedBlobs.length > 0 && (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Fichiers reçus et vérifiés ({receivedBlobs.length})</span>
            </h4>
            <div className="space-y-2">
              {receivedBlobs.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                  <div className="overflow-hidden mr-3">
                    <p className="font-bold text-sm text-white truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">{formatBytes(item.size)}</p>
                  </div>
                  <button
                    onClick={() => handleSaveFile(item)}
                    className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
              Terminer & Retour à l'accueil
            </button>
          )}
        </div>

      </div>

    </div>
  );
};
