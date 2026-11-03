export type AppView = 'home' | 'send' | 'receive' | 'radar' | 'transfer' | 'history' | 'settings' | 'categories';

export type FileCategory = 'photos' | 'videos' | 'music' | 'apps' | 'documents' | 'downloads' | 'folders';

export type SupportedPlatform = 'Android' | 'iOS' | 'Windows' | 'macOS' | 'Linux' | 'Web';

export type TransferTechnology =
  | 'Google Nearby Connections'
  | 'Wi-Fi Direct'
  | 'Apple Multipeer'
  | 'Local Hotspot (:52222)'
  | 'WebRTC DataChannel'
  | 'Local Socket TCP';

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
  relativePath?: string; // For folders and nested structures
}

export interface NearbyDevice {
  id: string;
  name: string;
  model: string;
  os: SupportedPlatform;
  rssi?: number; // signal strength if physical radio provides it
  avatarColor: string;
  ip?: string;
  port?: number;
  technology?: TransferTechnology;
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
  technology?: TransferTechnology;
  error?: string;
  checksum?: string;
  estimatedRemainingSeconds?: number;
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
  technology?: TransferTechnology;
}

export interface AppSettings {
  deviceName: string;
  savePath: string;
  language: 'fr' | 'en' | 'es';
  themeMode: 'dark' | 'light';
  soundEnabled: boolean;
  autoAccept: boolean;
  themeColor: 'blue' | 'purple' | 'cyan';
  preferredTechnology: 'auto' | 'hotspot' | 'webrtc' | 'nearby' | 'multipeer';
}
