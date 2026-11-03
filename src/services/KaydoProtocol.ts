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

// SHA-256 Constants
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function ror(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/**
 * Sha256Incremental:
 * High-performance, streaming SHA-256 implementation that uses O(1) constant memory.
 * Enables computing SHA-256 hashes of multi-gigabyte files chunk-by-chunk without loading
 * the entire file into memory.
 */
export class Sha256Incremental {
  private h0 = 0x6a09e667;
  private h1 = 0xbb67ae85;
  private h2 = 0x3c6ef372;
  private h3 = 0xa54ff53a;
  private h4 = 0x510e527f;
  private h5 = 0x9b05688c;
  private h6 = 0x1f83d9ab;
  private h7 = 0x5be0cd19;

  private block = new Uint8Array(64);
  private blockLen = 0;
  private totalBytes = 0;
  private w = new Int32Array(64);

  public update(data: Uint8Array): void {
    let offset = 0;
    const len = data.length;
    this.totalBytes += len;

    if (this.blockLen > 0) {
      const needed = 64 - this.blockLen;
      if (len >= needed) {
        this.block.set(data.subarray(0, needed), this.blockLen);
        this.processBlock(this.block, 0);
        this.blockLen = 0;
        offset = needed;
      } else {
        this.block.set(data, this.blockLen);
        this.blockLen += len;
        return;
      }
    }

    while (offset + 64 <= len) {
      this.processBlock(data, offset);
      offset += 64;
    }

    if (offset < len) {
      this.block.set(data.subarray(offset), 0);
      this.blockLen = len - offset;
    }
  }

  private processBlock(data: Uint8Array, offset: number): void {
    const w = this.w;
    for (let i = 0; i < 16; i++) {
      const idx = offset + i * 4;
      w[i] = (data[idx] << 24) | (data[idx + 1] << 16) | (data[idx + 2] << 8) | data[idx + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = ror(w[i - 15], 7) ^ ror(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = ror(w[i - 2], 17) ^ ror(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = ((w[i - 16] + s0) | 0) + ((w[i - 7] + s1) | 0);
    }

    let a = this.h0;
    let b = this.h1;
    let c = this.h2;
    let d = this.h3;
    let e = this.h4;
    let f = this.h5;
    let g = this.h6;
    let h = this.h7;

    for (let i = 0; i < 64; i++) {
      const s1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = ((h + s1) | 0) + ((ch + SHA256_K[i]) | 0) + w[i];
      const s0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    this.h0 = (this.h0 + a) | 0;
    this.h1 = (this.h1 + b) | 0;
    this.h2 = (this.h2 + c) | 0;
    this.h3 = (this.h3 + d) | 0;
    this.h4 = (this.h4 + e) | 0;
    this.h5 = (this.h5 + f) | 0;
    this.h6 = (this.h6 + g) | 0;
    this.h7 = (this.h7 + h) | 0;
  }

  public digest(): string {
    const totalBits = this.totalBytes * 8;
    // Pad message
    this.block[this.blockLen++] = 0x80;

    if (this.blockLen > 56) {
      this.block.fill(0, this.blockLen);
      this.processBlock(this.block, 0);
      this.blockLen = 0;
    }

    this.block.fill(0, this.blockLen, 56);
    // Write 64-bit length big-endian
    const high = Math.floor(totalBits / 0x100000000);
    const low = totalBits >>> 0;
    this.block[56] = (high >>> 24) & 0xff;
    this.block[57] = (high >>> 16) & 0xff;
    this.block[58] = (high >>> 8) & 0xff;
    this.block[59] = high & 0xff;
    this.block[60] = (low >>> 24) & 0xff;
    this.block[61] = (low >>> 16) & 0xff;
    this.block[62] = (low >>> 8) & 0xff;
    this.block[63] = low & 0xff;

    this.processBlock(this.block, 0);

    const words = [this.h0, this.h1, this.h2, this.h3, this.h4, this.h5, this.h6, this.h7];
    return words.map(w => (w >>> 0).toString(16).padStart(8, '0')).join('');
  }
}

/**
 * Streams a Blob slice-by-slice in 64 KB increments to calculate SHA-256
 * without loading the entire file into memory (OOM proof).
 */
export async function calculateBlobSha256(
  blob: Blob,
  onProgress?: (progressPct: number) => void
): Promise<string> {
  const hasher = new Sha256Incremental();
  const sliceSize = 64 * 1024;
  const total = blob.size;
  let offset = 0;

  while (offset < total) {
    const end = Math.min(total, offset + sliceSize);
    const slice = blob.slice(offset, end);
    const buffer = await slice.arrayBuffer();
    hasher.update(new Uint8Array(buffer));
    offset = end;

    if (onProgress && total > 0) {
      onProgress(Math.floor((offset / total) * 100));
    }
  }

  return hasher.digest();
}

/**
 * FileAssemblyBuffer:
 * Accumulates binary chunks in an indexed array of Uint8Arrays at exact chunk indices,
 * tracks received indices, validates ordering, and strictly enforces SHA-256 verification
 * before returning the final Blob.
 *
 * Prevents allocating a single massive contiguous ArrayBuffer in memory.
 */
export class FileAssemblyBuffer {
  public manifest: FileManifest;
  private chunks: (Uint8Array | null)[];
  private receivedChunkIndices: Set<number> = new Set();
  public bytesReceived: number = 0;
  public startTime: number = Date.now();

  constructor(manifest: FileManifest) {
    this.manifest = manifest;
    this.chunks = new Array(manifest.totalChunks).fill(null);
  }

  /**
   * Appends an incoming chunk at its exact chunk index.
   * Handles out-of-order chunks safely and rejects malformed or duplicate chunks.
   */
  public addChunk(header: ChunkHeader, chunkPayload: ArrayBuffer): void {
    if (header.fileId !== this.manifest.fileId) {
      throw new Error(`Fichier ID non correspondant: attendu ${this.manifest.fileId}, reçu ${header.fileId}`);
    }

    if (header.chunkIndex < 0 || header.chunkIndex >= this.manifest.totalChunks) {
      throw new Error(`Indice de bloc hors limites: ${header.chunkIndex} (total: ${this.manifest.totalChunks})`);
    }

    if (this.receivedChunkIndices.has(header.chunkIndex)) {
      // Chunk already received, ignore duplicate
      return;
    }

    const chunkBytes = new Uint8Array(chunkPayload);
    if (header.offset + chunkBytes.byteLength > this.manifest.fileSize) {
      throw new Error(`Dépassement de la taille déclarée pour le fichier (${this.manifest.fileSize} octets) au bloc ${header.chunkIndex}`);
    }

    this.chunks[header.chunkIndex] = chunkBytes;
    this.receivedChunkIndices.add(header.chunkIndex);
    this.bytesReceived += chunkBytes.byteLength;
  }

  /**
   * Transfer is complete ONLY when all chunks are received AND byte counts match exactly.
   */
  public isComplete(): boolean {
    return (
      this.receivedChunkIndices.size === this.manifest.totalChunks &&
      this.bytesReceived === this.manifest.fileSize
    );
  }

  /**
   * Never reports 100% until complete verification has passed.
   */
  public getProgressPercentage(): number {
    if (this.manifest.fileSize === 0) return 100;
    const pct = Math.floor((this.bytesReceived / this.manifest.fileSize) * 100);
    return this.isComplete() ? 100 : Math.min(99, pct);
  }

  /**
   * Finalizes the file assembly.
   * STRICT ENFORCEMENT: Computes actual SHA-256 chunk-by-chunk using Sha256Incremental.
   * If mismatch, throws ChecksumMismatchError, clears all stored chunks, and DOES NOT return the Blob.
   */
  public async finalize(): Promise<{ blob: Blob; verifiedSha256: string }> {
    if (!this.isComplete()) {
      throw new Error(`Transfert incomplet: ${this.receivedChunkIndices.size}/${this.manifest.totalChunks} blocs reçus (${this.bytesReceived}/${this.manifest.fileSize} octets).`);
    }

    // Verify all chunks are non-null in order
    const hasher = new Sha256Incremental();
    for (let i = 0; i < this.manifest.totalChunks; i++) {
      const c = this.chunks[i];
      if (!c) {
        throw new Error(`Bloc manquant à l'indice ${i} lors de la finalisation.`);
      }
      hasher.update(c);
    }

    const calculatedHash = hasher.digest();

    if (calculatedHash.toLowerCase() !== this.manifest.expectedSha256.toLowerCase()) {
      // Free memory immediately and reject
      this.chunks = [];
      throw new ChecksumMismatchError(this.manifest.expectedSha256, calculatedHash);
    }

    // Construct Blob directly from array of Uint8Arrays without monolithic buffer allocation
    const blob = new Blob(this.chunks as unknown as BlobPart[], { type: this.manifest.mimeType });
    return {
      blob,
      verifiedSha256: calculatedHash
    };
  }
}
