import React, { useState } from 'react';
import { ArrowLeft, Image, Video, Music, Smartphone, FileText, Folder, FolderDown, Search, Download, Plus, AlertCircle } from 'lucide-react';
import { AppSettings, FileCategory, KaydoFile } from '../types';
import { createKaydoFile, formatBytes } from '../services/fileStore';
import { translations } from '../i18n';

interface CategoryBrowserProps {
  category: FileCategory;
  files: KaydoFile[];
  onAddFiles: (newFiles: KaydoFile[]) => void;
  settings: AppSettings;
  onBack: () => void;
  onStartSend: (files: KaydoFile[]) => void;
}

export const CategoryBrowser: React.FC<CategoryBrowserProps> = ({
  category,
  files,
  onAddFiles,
  settings,
  onBack,
  onStartSend
}) => {
  const t = translations[settings.language];
  const [searchQuery, setSearchQuery] = useState('');

  const categoryFiles = files.filter(f => f.category === category);
  const filteredFiles = categoryFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const categoryTitles: Record<FileCategory, string> = {
    photos: t.photos,
    videos: t.videos,
    music: t.music,
    apps: t.apps,
    documents: t.documents,
    downloads: t.downloads,
    folders: t.folders || 'Dossiers'
  };

  const fileAccepts: Record<FileCategory, string> = {
    photos: 'image/*',
    videos: 'video/*',
    music: 'audio/*',
    apps: '.apk,application/vnd.android.package-archive',
    documents: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt',
    downloads: '*/*',
    folders: '*/*'
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const added: KaydoFile[] = [];
      for (const file of Array.from(e.target.files)) {
        const kaydoFile = await createKaydoFile(file);
        kaydoFile.category = category;
        // If it's a folder, capture relative path
        if ((file as any).webkitRelativePath) {
          kaydoFile.relativePath = (file as any).webkitRelativePath;
        }
        added.push(kaydoFile);
      }
      onAddFiles(added);
    }
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
          <p className="text-xs text-slate-400">{categoryFiles.length} fichiers réels sur l'appareil</p>
        </div>

        {/* Add files to this specific category */}
        <label className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-blue-600/30 transition-all">
          <Plus className="w-4 h-4" />
          <span>Ajouter</span>
          <input
            type="file"
            multiple
            accept={fileAccepts[category]}
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      {/* Search Input if files exist */}
      {categoryFiles.length > 0 && (
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
      )}

      {/* Files List / Grid */}
      {categoryFiles.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Aucun fichier dans cette catégorie</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              KAYDO SHARE ne propose aucun contenu pré-rempli ou fictif. Cliquez sur le bouton ci-dessous pour choisir de vrais fichiers depuis votre appareil.
            </p>
          </div>
          <label className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition-colors shadow-lg shadow-blue-600/20">
            <Plus className="w-4 h-4" />
            <span>Sélectionner des {categoryTitles[category]}</span>
            <input
              type="file"
              multiple
              accept={fileAccepts[category]}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
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
                     category === 'apps' ? <Smartphone className="w-5 h-5" /> :
                     category === 'folders' ? <Folder className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-bold text-sm text-white truncate max-w-[170px]">{file.name}</h4>
                    <p className="text-xs text-slate-400">{formatBytes(file.size)} • {file.relativePath || file.date}</p>
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
