import { FileCategory, KaydoFile } from '../types';

// Zero fake/mock files. Starts completely empty until the user picks real files from their device.
export const INITIAL_FILES: KaydoFile[] = [];

export function categorizeFile(file: File): FileCategory {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (name.endsWith('.apk')) return 'apps';
  if (type.startsWith('image/')) return 'photos';
  if (type.startsWith('video/')) return 'videos';
  if (type.startsWith('audio/')) return 'music';
  if (
    type.includes('pdf') ||
    type.includes('word') ||
    type.includes('document') ||
    type.includes('sheet') ||
    type.includes('text') ||
    name.endsWith('.txt') ||
    name.endsWith('.pdf') ||
    name.endsWith('.docx') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.pptx')
  ) {
    return 'documents';
  }
  return 'downloads';
}

export async function createKaydoFile(file: File): Promise<KaydoFile> {
  const category = categorizeFile(file);
  let thumbnail: string | undefined = undefined;

  if (file.type.startsWith('image/')) {
    thumbnail = URL.createObjectURL(file);
  }

  return {
    id: `file_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    category,
    date: new Date().toLocaleDateString(),
    thumbnail,
    blob: file
  };
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Octets';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Octets', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
