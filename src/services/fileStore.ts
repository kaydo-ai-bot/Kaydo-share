import { FileCategory, KaydoFile } from '../types';

// Zero mock files: starts empty until real files/folders are selected by the user.
export const INITIAL_FILES: KaydoFile[] = [];

export function categorizeFile(file: File): FileCategory {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (name.endsWith('.apk')) return 'apps';
  if (type.startsWith('image/')) return 'photos';
  if (type.startsWith('video/')) return 'videos';
  if (type.startsWith('audio/')) return 'music';
  if (name.endsWith('.zip') || name.endsWith('.tar') || name.endsWith('.gz') || name.endsWith('.rar') || name.endsWith('.7z')) {
    return 'downloads';
  }
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
    name.endsWith('.pptx') ||
    name.endsWith('.md')
  ) {
    return 'documents';
  }
  return 'downloads';
}

export async function createKaydoFile(file: File, relativePath?: string): Promise<KaydoFile> {
  const category = relativePath && relativePath.includes('/') ? 'folders' : categorizeFile(file);
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
    blob: file,
    relativePath: relativePath || (file as any).webkitRelativePath || file.name
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
