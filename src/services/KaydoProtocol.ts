/**
 * KaydoProtocol.ts
 * Core binary framing and cryptographic verification engine for KAYDO SHARE.
 *
 * Binary Frame Format:
 * [0..3]   : Magic Bytes 0x4B 0x59 0x44 0x4F ("KYDO")
 * [4]      : Version (0x01)
 * [5]      : Message Type:
 *              0x01 = HANDSHAKE_REQUEST
 *              0x02 = HANDSHAKE_ACCEPT
 *              0x03 = FILE_MANIFEST
 *              0x04 = FILE_CHUNK
 *              0x05 = TRANSFER_COMPLETE
 *              0x06 = TRANSFER_CANCEL
 *              0x07 = ERROR_CHECKSUM_FAILED
 * [6..7]   : Header Length (UInt16BE)
 * [8..N]   : Type-specific payload (Manifest JSON or Raw Binary with offset header)
 */

export const KAYDO_MAGIC = new Uint8Array([0x4b, 0x59, 0x44, 0x4f]); // "KYDO"
export const KAYDO_VERSION = 1;

export enum KaydoMessageType {
  HANDSHAKE_REQUEST = 0x01,
  HANDSHAKE_ACCEPT = 0x02,
  FILE_MANIFEST = 0x03,
  FILE_CHUNK = 0x04,
  TRANSFER_COMPLETE = 0x05,
  TRANSFER_CANCEL = 0x06,
  ERROR_CHECKSUM_FAILED = 0x07
}

export interface FileManifest {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  expectedSha256: string;
  totalChunks: number;
  chunkSize: number;
}

export interface ChunkHeader {
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  offset: number;
  payloadLength: number;
}

export class ChecksumMismatchError extends Error {
  public expected: string;
  public actual: string;
  constructor(expected: string, actual: string) {
    super(`Échec de vérification cryptographique SHA-256. Attendu: ${expected}, Calculé: ${actual}. Le fichier a été rejeté pour sécurité.`);
    this.name = 'ChecksumMismatchError';
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * Calculates genuine SHA-256 hash of an ArrayBuffer using Web Crypto API.
 */
export async function calculateSha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encodes a file manifest into a binary frame.
 */
export function encodeManifestFrame(manifest: FileManifest): ArrayBuffer {
  const jsonStr = JSON.stringify(manifest);
  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(jsonStr);

  const buffer = new ArrayBuffer(8 + jsonBytes.byteLength);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // Magic
  uint8.set(KAYDO_MAGIC, 0);
  // Version
  view.setUint8(4, KAYDO_VERSION);
  // Type
  view.setUint8(5, KaydoMessageType.FILE_MANIFEST);
  // Payload Length
  view.setUint16(6, jsonBytes.byteLength, false);
  // Payload
  uint8.set(jsonBytes, 8);

  return buffer;
}

/**
 * Decodes a manifest frame.
 */
export function decodeManifestFrame(buffer: ArrayBuffer): FileManifest {
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  if (
    uint8[0] !== KAYDO_MAGIC[0] ||
    uint8[1] !== KAYDO_MAGIC[1] ||
    uint8[2] !== KAYDO_MAGIC[2] ||
    uint8[3] !== KAYDO_MAGIC[3]
  ) {
    throw new Error('Protocole invalide: Magic bytes incorrects');
  }

  const type = view.getUint8(5);
  if (type !== KaydoMessageType.FILE_MANIFEST) {
    throw new Error(`Type de message attendu FILE_MANIFEST (0x03), reçu: 0x${type.toString(16)}`);
  }

  const payloadLen = view.getUint16(6, false);
  const jsonBytes = uint8.subarray(8, 8 + payloadLen);
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(jsonBytes));
}

/**
 * Encodes a binary chunk frame.
 * Header:
 * [0..3]   : Magic "KYDO"
 * [4]      : Version 1
 * [5]      : Type FILE_CHUNK (0x04)
 * [6..7]   : Chunk index (UInt16BE)
 * [8..9]   : Total chunks (UInt16BE)
 * [10..13] : Byte offset in file (UInt32BE)
 * [14..15] : FileId string length (UInt16BE)
 * [16..N]  : FileId (UTF-8)
 * [N+1..]  : Raw binary chunk bytes
 */
export function encodeChunkFrame(
  fileId: string,
  chunkIndex: number,
  totalChunks: number,
  offset: number,
  chunkData: ArrayBuffer
): ArrayBuffer {
  const idBytes = new TextEncoder().encode(fileId);
  const headerSize = 16 + idBytes.byteLength;
  const totalLength = headerSize + chunkData.byteLength;

  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  uint8.set(KAYDO_MAGIC, 0);
  view.setUint8(4, KAYDO_VERSION);
  view.setUint8(5, KaydoMessageType.FILE_CHUNK);
  view.setUint16(6, chunkIndex, false);
  view.setUint16(8, totalChunks, false);
  view.setUint32(10, offset, false);
  view.setUint16(14, idBytes.byteLength, false);
  uint8.set(idBytes, 16);
  uint8.set(new Uint8Array(chunkData), headerSize);

  return buffer;
}

/**
 * Decodes a binary chunk frame into header and raw binary payload.
 */
export function decodeChunkFrame(buffer: ArrayBuffer): { header: ChunkHeader; payload: ArrayBuffer } {
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  if (
    uint8[0] !== KAYDO_MAGIC[0] ||
    uint8[1] !== KAYDO_MAGIC[1] ||
    uint8[2] !== KAYDO_MAGIC[2] ||
    uint8[3] !== KAYDO_MAGIC[3]
  ) {
    throw new Error('Protocole invalide: Magic bytes incorrects');
  }

  const type = view.getUint8(5);
  if (type !== KaydoMessageType.FILE_CHUNK) {
    throw new Error(`Type de message attendu FILE_CHUNK (0x04), reçu: 0x${type.toString(16)}`);
  }

  const chunkIndex = view.getUint16(6, false);
  const totalChunks = view.getUint16(8, false);
  const offset = view.getUint32(10, false);
  const idLen = view.getUint16(14, false);

  const fileId = new TextDecoder().decode(uint8.subarray(16, 16 + idLen));
  const payloadOffset = 16 + idLen;
  const payload = buffer.slice(payloadOffset);

  return {
    header: {
      fileId,
      chunkIndex,
      totalChunks,
      offset,
      payloadLength: payload.byteLength
    },
    payload
  };
}

/**
 * FileAssemblyBuffer:
 * Accumulates binary chunks in memory / buffer at exact byte offsets,
 * tracks progress, and strictly enforces SHA-256 verification before completing.
 */
export class FileAssemblyBuffer {
  public manifest: FileManifest;
  private buffer: Uint8Array;
  private receivedChunkIndices: Set<number> = new Set();
  public bytesReceived: number = 0;
  public startTime: number = Date.now();

  constructor(manifest: FileManifest) {
    this.manifest = manifest;
    this.buffer = new Uint8Array(manifest.fileSize);
  }

  /**
   * Appends an incoming chunk at its exact byte offset.
   * Handles out-of-order chunks safely.
   */
  public addChunk(header: ChunkHeader, chunkPayload: ArrayBuffer): void {
    if (header.fileId !== this.manifest.fileId) {
      throw new Error(`Fichier ID non correspondant: attendu ${this.manifest.fileId}, reçu ${header.fileId}`);
    }

    if (this.receivedChunkIndices.has(header.chunkIndex)) {
      // Chunk already received, ignore duplicate
      return;
    }

    const chunkBytes = new Uint8Array(chunkPayload);
    this.buffer.set(chunkBytes, header.offset);
    this.receivedChunkIndices.add(header.chunkIndex);
    this.bytesReceived += chunkBytes.byteLength;
  }

  public isComplete(): boolean {
    return this.receivedChunkIndices.size === this.manifest.totalChunks || this.bytesReceived >= this.manifest.fileSize;
  }

  public getProgressPercentage(): number {
    if (this.manifest.fileSize === 0) return 100;
    return Math.min(100, Math.floor((this.bytesReceived / this.manifest.fileSize) * 100));
  }

  /**
   * Finalizes the file assembly.
   * STRICT ENFORCEMENT: Computes actual SHA-256. If mismatch, throws ChecksumMismatchError
   * and DOES NOT return the assembled Blob.
   */
  public async finalize(): Promise<{ blob: Blob; verifiedSha256: string }> {
    if (!this.isComplete()) {
      throw new Error(`Transfert incomplet: ${this.receivedChunkIndices.size}/${this.manifest.totalChunks} blocs reçus.`);
    }

    const calculatedHash = await calculateSha256(this.buffer.buffer as ArrayBuffer);

    if (calculatedHash.toLowerCase() !== this.manifest.expectedSha256.toLowerCase()) {
      throw new ChecksumMismatchError(this.manifest.expectedSha256, calculatedHash);
    }

    const blob = new Blob([this.buffer as unknown as BlobPart], { type: this.manifest.mimeType });
    return {
      blob,
      verifiedSha256: calculatedHash
    };
  }
}
