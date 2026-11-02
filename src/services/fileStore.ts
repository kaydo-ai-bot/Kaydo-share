import { KaydoFile } from '../types';

export const INITIAL_FILES: KaydoFile[] = [
  {
    id: 'f1',
    name: 'Vacances_Bali_2026.jpg',
    size: 4200000, // 4.2 MB
    type: 'image/jpeg',
    category: 'photos',
    date: '2026-11-01',
    thumbnail: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=300&auto=format&fit=crop&q=80'
  },
  {
    id: 'f2',
    name: 'Sunset_Beirut.png',
    size: 3100000, // 3.1 MB
    type: 'image/png',
    category: 'photos',
    date: '2026-10-28',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&auto=format&fit=crop&q=80'
  },
  {
    id: 'f3',
    name: 'Tutoriel_Jetpack_Compose.mp4',
    size: 48500000, // 48.5 MB
    type: 'video/mp4',
    category: 'videos',
    date: '2026-11-02',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80'
  },
  {
    id: 'f4',
    name: 'Cyberpunk_Teaser_4K.mp4',
    size: 124000000, // 124 MB
    type: 'video/mp4',
    category: 'videos',
    date: '2026-10-30',
    thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300&auto=format&fit=crop&q=80'
  },
  {
    id: 'f5',
    name: 'Electro_Synthwave_Mix.mp3',
    size: 12800000, // 12.8 MB
    type: 'audio/mp3',
    category: 'music',
    date: '2026-11-01'
  },
  {
    id: 'f6',
    name: 'Ambient_Night_Lofi.flac',
    size: 28400000, // 28.4 MB
    type: 'audio/flac',
    category: 'music',
    date: '2026-10-25'
  },
  {
    id: 'f7',
    name: 'KaydoShare_v2.4.1.apk',
    size: 24500000, // 24.5 MB
    type: 'application/vnd.android.package-archive',
    category: 'apps',
    date: '2026-11-02'
  },
  {
    id: 'f8',
    name: 'Spotify_Mod_v8.9.apk',
    size: 54000000, // 54 MB
    type: 'application/vnd.android.package-archive',
    category: 'apps',
    date: '2026-10-20'
  },
  {
    id: 'f9',
    name: 'Rapport_Financier_2026.pdf',
    size: 2100000, // 2.1 MB
    type: 'application/pdf',
    category: 'documents',
    date: '2026-11-01'
  },
  {
    id: 'f10',
    name: 'Specification_Technique_BLE.docx',
    size: 950000, // 950 KB
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    category: 'documents',
    date: '2026-10-15'
  },
  {
    id: 'f11',
    name: 'Archivé_System_Logs.zip',
    size: 15600000, // 15.6 MB
    type: 'application/zip',
    category: 'downloads',
    date: '2026-10-29'
  }
];

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Octets';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Octets', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
