import React from 'react';
import { History as HistoryIcon, ArrowLeft, Trash2, CheckCircle2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { AppSettings, TransferHistoryRecord } from '../types';
import { formatBytes } from '../services/fileStore';
import { translations } from '../i18n';

interface HistoryViewProps {
  settings: AppSettings;
  history: TransferHistoryRecord[];
  onBack: () => void;
  onClearHistory: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  settings,
  history,
  onBack,
  onClearHistory
}) => {
  const t = translations[settings.language];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      
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
            {t.history}
          </h2>
          <p className="text-xs text-slate-400">Journaux des transferts hors-ligne</p>
        </div>

        {history.length > 0 ? (
          <button
            onClick={onClearHistory}
            className="flex items-center space-x-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 rounded-xl border border-rose-500/30 text-xs font-semibold transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t.clearHistory}</span>
          </button>
        ) : <div className="w-20" />}
      </div>

      {/* History List */}
      {history.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <HistoryIcon className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-slate-400 text-sm">{t.noHistory}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((record) => (
            <div
              key={record.id}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between transition-all hover:bg-slate-800/80"
            >
              <div className="flex items-center space-x-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  record.direction === 'send' ? 'bg-blue-500/10 text-blue-400' : 'bg-violet-500/10 text-violet-400'
                }`}>
                  {record.direction === 'send' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white truncate max-w-[220px] sm:max-w-md">{record.fileName}</h4>
                  <p className="text-xs text-slate-400">
                    {record.direction === 'send' ? 'Vers' : 'Depuis'} <strong className="text-slate-300">{record.peerName}</strong> • {record.timestamp}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm font-bold text-white">{formatBytes(record.fileSize)}</p>
                <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{t.completed}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
