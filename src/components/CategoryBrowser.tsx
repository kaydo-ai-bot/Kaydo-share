import React, { useState } from 'react';
import { ArrowLeft, Image, Video, Music, Smartphone, FileText, FolderDown, Search, Download } from 'lucide-react';
import { AppSettings, FileCategory, KaydoFile } from '../types';
import { INITIAL_FILES, formatBytes } from '../services/fileStore';
import { translations } from '../i18n';

interface CategoryBrowserProps {
  category: FileCategory;
  settings: AppSettings;
  onBack: () => void;
  onStartSend: (files: KaydoFile[]) => void;
}

export const CategoryBrowser: React.FC<CategoryBrowserProps> = ({
  category,
  settings,
  onBack,
  onStartSend
}) => {
  const t = translations[settings.language];
  const [files] = useState<KaydoFile[]>(INITIAL_FILES.filter(f => f.category === category));
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const categoryTitles: Record<FileCategory, string> = {
    photos: t.photos,
    videos: t.videos,
    music: t.music,
    apps: t.apps,
    documents: t.documents,
    downloads: t.downloads
  };

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
            {categoryTitles[category]}
          </h2>
          <p className="text-xs text-slate-400">{filteredFiles.length} fichiers disponibles</p>
        </div>

        <div className="w-20" />
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

      {/* Files List / Grid */}
      {filteredFiles.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <p className="text-slate-400 text-sm">Aucun fichier trouvé dans cette catégorie.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all hover:border-slate-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                    {category === 'photos' ? <Image className="w-5 h-5" /> :
                     category === 'videos' ? <Video className="w-5 h-5" /> :
                     category === 'music' ? <Music className="w-5 h-5" /> :
                     category === 'apps' ? <Smartphone className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-bold text-sm text-white truncate max-w-[170px]">{file.name}</h4>
                    <p className="text-xs text-slate-400">{formatBytes(file.size)} • {file.date}</p>
                  </div>
                </div>
              </div>

              {file.thumbnail && (
                <div className="w-full h-28 rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                  <img src={file.thumbnail} alt={file.name} className="w-full h-full object-cover" />
                </div>
              )}

              <button
                onClick={() => onStartSend([file])}
                className="w-full bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 font-bold py-2 rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Envoyer ce fichier</span>
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
