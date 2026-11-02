export type AppView = 'home' | 'send' | 'receive' | 'radar' | 'transfer' | 'history' | 'settings' | 'categories';

export type FileCategory = 'photos' | 'videos' | 'music' | 'apps' | 'documents' | 'downloads';

export interface KaydoFile {
  id: string;
  name: string;
  size: number; // in bytes
  type: string;
  category: FileCategory;
  url?: string;
  blob?: Blob;
  date: string;
  thumbnail?: string;
  sender?: string;
}

export interface NearbyDevice {
  id: string;
  name: string;
  model: string;
  os: 'Android' | 'iOS' | 'Windows' | 'Mac';
  rssi: number; // signal strength
  avatarColor: string;
  ip?: string;
}

export interface TransferTask {
  id: string;
  fileName: string;
  fileSize: number;
  transferredBytes: number;
  speedMBs: number;
  progress: number; // 0 to 100
  status: 'pending' | 'connecting' | 'transferring' | 'completed' | 'cancelled' | 'error';
  direction: 'send' | 'receive';
  peerName: string;
  startTime: number;
  error?: string;
  checksum?: string;
}

export interface TransferHistoryRecord {
  id: string;
  fileName: string;
  fileSize: number;
  category: FileCategory;
  direction: 'send' | 'receive';
  peerName: string;
  timestamp: string;
  status: 'completed' | 'cancelled' | 'error';
  durationSeconds: number;
}

export interface AppSettings {
  deviceName: string;
  savePath: string;
  language: 'fr' | 'en' | 'es';
  soundEnabled: boolean;
  autoAccept: boolean;
  themeColor: 'blue' | 'purple' | 'cyan';
}
