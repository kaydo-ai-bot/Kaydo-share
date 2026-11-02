import React, { useState } from 'react';
import { Search, Plus, Check, Trash2, Send, Image, Video, Music, Smartphone, FileText, FolderDown, ArrowLeft } from 'lucide-react';
import { AppSettings, FileCategory, KaydoFile, NearbyDevice } from '../types';
import { INITIAL_FILES, formatBytes } from '../services/fileStore';
import { translations } from '../i18n';

interface FileSelectorModalProps {
  settings: AppSettings;
  onBack: () => void;
  onStartTransfer: (selectedFiles: KaydoFile[], targetDevice?: NearbyDevice) => void;
  connectedPeerName: string | null;
}

export const FileSelectorModal: React.FC<FileSelectorModalProps> = ({
  settings,
  onBack,
  onStartTransfer,
  connectedPeerName
}) => {
  const t = translations[settings.language];
  const [files, setFiles] = useState<KaydoFile[]>(INITIAL_FILES);
  const [selectedIds, setSelectedIds] = useState<string[]>(['f1', 'f3']); // default pre-selected
  const [activeCategory, setActiveCategory] = useState<FileCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: KaydoFile[] = Array.from(e.target.files).map((file, idx) => {
        let cat: FileCategory = 'documents';
        if (file.type.startsWith('image/')) cat = 'photos';
        else if (file.type.startsWith('video/')) cat = 'videos';
        else if (file.type.startsWith('audio/')) cat = 'music';
        else if (file.name.endsWith('.apk')) cat = 'apps';

        return {
          id: `custom_${Date.now()}_${idx}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          category: cat,
          date: new Date().toISOString().split('T')[0],
          blob: file
        };
      });

      setFiles([...newFiles, ...files]);
      setSelectedIds([...selectedIds, ...newFiles.map(f => f.id)]);
    }
  };

  const filteredFiles = files.filter(f => {
    const matchesCategory = activeCategory === 'all' || f.category === activeCategory;
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalSelectedSize = files
    .filter(f => selectedIds.includes(f.id))
    .reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      
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
            {t.send} • Sélection de fichiers
          </h2>
          <p className="text-xs text-slate-400">
            {connectedPeerName ? `Destinataire : ${connectedPeerName}` : 'Aucun appareil sélectionné (mode local)'}
          </p>
        </div>

        {/* Custom File Upload Button */}
        <label className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-blue-600/30 transition-all">
          <Plus className="w-4 h-4" />
          <span>Ajouter</span>
          <input type="file" multiple onChange={handleCustomFileUpload} className="hidden" />
        </label>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {(['all', 'photos', 'videos', 'music', 'apps', 'documents', 'downloads'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {cat === 'all' ? 'Tous les fichiers' : t[cat]}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Files Grid / List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filteredFiles.map((file) => {
          const isSelected = selectedIds.includes(file.id);
          return (
            <div
              key={file.id}
              onClick={() => toggleSelect(file.id)}
              className={`group relative bg-slate-900/60 hover:bg-slate-800/80 border rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                isSelected
                  ? 'border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-500/10'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                    file.category === 'photos' ? 'bg-blue-500/10 text-blue-400' :
                    file.category === 'videos' ? 'bg-violet-500/10 text-violet-400' :
                    file.category === 'music' ? 'bg-pink-500/10 text-pink-400' :
                    file.category === 'apps' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {file.category === 'photos' ? <Image className="w-5 h-5" /> :
                     file.category === 'videos' ? <Video className="w-5 h-5" /> :
                     file.category === 'music' ? <Music className="w-5 h-5" /> :
                     file.category === 'apps' ? <Smartphone className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-bold text-sm text-white truncate max-w-[180px]">{file.name}</h4>
                    <p className="text-xs text-slate-400">{formatBytes(file.size)} • {file.date}</p>
                  </div>
                </div>

                <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                  isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 bg-slate-800/50 text-transparent'
                }`}>
                  <Check className="w-3.5 h-3.5" />
                </div>
              </div>

              {file.thumbnail && (
                <div className="w-full h-28 rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                  <img src={file.thumbnail} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Send Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky bottom-6 bg-[#090b14]/90 backdrop-blur-xl border border-blue-500/40 rounded-3xl p-4 shadow-2xl flex items-center justify-between animate-slide-up">
          <div>
            <p className="text-sm font-bold text-white">
              {selectedIds.length} {t.fileCount}
            </p>
            <p className="text-xs text-blue-400">
              Taille totale : {formatBytes(totalSelectedSize)}
            </p>
          </div>

          <button
            onClick={() => {
              const selectedFilesList = files.filter(f => selectedIds.includes(f.id));
              onStartTransfer(selectedFilesList);
            }}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-bold px-6 py-3 rounded-2xl shadow-xl shadow-blue-500/30 transition-all hover:scale-105"
          >
            <Send className="w-4 h-4" />
            <span>{t.startSending}</span>
          </button>
        </div>
      )}

    </div>
  );
};
