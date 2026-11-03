import { describe, it, expect } from 'vitest';
import {
  encodeManifestFrame,
  decodeManifestFrame,
  encodeChunkFrame,
  decodeChunkFrame,
  calculateSha256,
  FileAssemblyBuffer,
  ChecksumMismatchError,
  FileManifest,
  KAYDO_MAGIC,
  KAYDO_VERSION,
  KaydoMessageType,
  Sha256Incremental,
  calculateBlobSha256
} from '../KaydoProtocol';

describe('KAYDO Protocol - Binary Framing & Verification Suite', () => {

  it('verifies exact wire format matching Android Kotlin and iOS Swift implementations', () => {
    // Magic 'KYDO': 0x4B, 0x59, 0x44, 0x4F
    expect(Array.from(KAYDO_MAGIC)).toEqual([0x4b, 0x59, 0x44, 0x4f]);
    expect(KAYDO_VERSION).toBe(1);
    expect(KaydoMessageType.FILE_CHUNK).toBe(0x04);
    expect(KaydoMessageType.FILE_MANIFEST).toBe(0x03);

    // Verify Big-Endian byte layout of encodeChunkFrame
    const testPayload = new Uint8Array([0xaa, 0xbb]).buffer;
    const frame = new Uint8Array(encodeChunkFrame('test', 1, 10, 65536, testPayload));

    // Magic
    expect(frame[0]).toBe(0x4b);
    expect(frame[1]).toBe(0x59);
    expect(frame[2]).toBe(0x44);
    expect(frame[3]).toBe(0x4f);
    // Version & Type
    expect(frame[4]).toBe(1);
    expect(frame[5]).toBe(0x04);

    // ChunkIndex = 1 (UInt16 Big-Endian: [0x00, 0x01])
    expect(frame[6]).toBe(0x00);
    expect(frame[7]).toBe(0x01);

    // TotalChunks = 10 (UInt16 Big-Endian: [0x00, 0x0a])
    expect(frame[8]).toBe(0x00);
    expect(frame[9]).toBe(0x0a);

    // Offset = 65536 (UInt32 Big-Endian: [0x00, 0x01, 0x00, 0x00])
    expect(frame[10]).toBe(0x00);
    expect(frame[11]).toBe(0x01);
    expect(frame[12]).toBe(0x00);
    expect(frame[13]).toBe(0x00);
  });

  it('correctly encodes and decodes a file manifest binary frame', () => {
    const manifest: FileManifest = {
      fileId: 'file_test_123',
      fileName: 'photo_vacances.jpg',
      fileSize: 1048576,
      mimeType: 'image/jpeg',
      expectedSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      totalChunks: 16,
      chunkSize: 65536
    };

    const frame = encodeManifestFrame(manifest);
    expect(frame.byteLength).toBeGreaterThan(8);

    const decoded = decodeManifestFrame(frame);
    expect(decoded.fileId).toBe(manifest.fileId);
    expect(decoded.fileName).toBe(manifest.fileName);
    expect(decoded.fileSize).toBe(manifest.fileSize);
    expect(decoded.expectedSha256).toBe(manifest.expectedSha256);
    expect(decoded.totalChunks).toBe(16);
  });

  it('correctly encodes and decodes binary chunk frames with zero base64 overhead', () => {
    const fileId = 'file_abc_999';
    const payload = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]).buffer;

    const chunkFrame = encodeChunkFrame(fileId, 2, 10, 131072, payload);
    const decoded = decodeChunkFrame(chunkFrame);

    expect(decoded.header.fileId).toBe(fileId);
    expect(decoded.header.chunkIndex).toBe(2);
    expect(decoded.header.totalChunks).toBe(10);
    expect(decoded.header.offset).toBe(131072);
    expect(decoded.header.payloadLength).toBe(8);

    const decodedPayload = new Uint8Array(decoded.payload);
    expect(Array.from(decodedPayload)).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });

  it('handles 1 MB file chunking, reassembly, and cryptographic verification', async () => {
    const oneMB = 1024 * 1024;
    const data = new Uint8Array(oneMB);
    for (let i = 0; i < oneMB; i++) {
      data[i] = (i * 31) & 0xff;
    }

    const expectedSha256 = await calculateSha256(data.buffer);
    const chunkSize = 64 * 1024; // 64 KB per chunk
    const totalChunks = Math.ceil(oneMB / chunkSize);

    const manifest: FileManifest = {
      fileId: 'file_1mb_test',
      fileName: 'large_payload_1mb.bin',
      fileSize: oneMB,
      mimeType: 'application/octet-stream',
      expectedSha256,
      totalChunks,
      chunkSize
    };

    const assembly = new FileAssemblyBuffer(manifest);

    for (let i = 0; i < totalChunks; i++) {
      const offset = i * chunkSize;
      const end = Math.min(offset + chunkSize, oneMB);
      const chunkBytes = data.slice(offset, end);

      const chunkFrame = encodeChunkFrame(
        manifest.fileId,
        i,
        totalChunks,
        offset,
        chunkBytes.buffer
      );

      const decoded = decodeChunkFrame(chunkFrame);
      assembly.addChunk(decoded.header, decoded.payload);
    }

    expect(assembly.isComplete()).toBe(true);
    const result = await assembly.finalize();
    expect(result.verifiedSha256).toBe(expectedSha256);
    expect(result.blob.size).toBe(oneMB);
  });

  it('correctly handles out-of-order chunk arrival without corrupting bytes', async () => {
    const originalData = new Uint8Array(20);
    for (let i = 0; i < 20; i++) originalData[i] = i + 1;

    const expectedSha256 = await calculateSha256(originalData.buffer);

    const manifest: FileManifest = {
      fileId: 'file_outoforder_test',
      fileName: 'unordered.bin',
      fileSize: 20,
      mimeType: 'application/octet-stream',
      expectedSha256,
      totalChunks: 2,
      chunkSize: 10
    };

    const assembly = new FileAssemblyBuffer(manifest);

    // Send Chunk 1 FIRST (offset 10..19)
    assembly.addChunk(
      { fileId: manifest.fileId, chunkIndex: 1, totalChunks: 2, offset: 10, payloadLength: 10 },
      originalData.slice(10, 20).buffer
    );
    expect(assembly.isComplete()).toBe(false);

    // Send Chunk 0 SECOND (offset 0..9)
    assembly.addChunk(
      { fileId: manifest.fileId, chunkIndex: 0, totalChunks: 2, offset: 0, payloadLength: 10 },
      originalData.slice(0, 10).buffer
    );
    expect(assembly.isComplete()).toBe(true);

    const result = await assembly.finalize();
    expect(result.verifiedSha256).toBe(expectedSha256);

    const assembledArray = new Uint8Array(await result.blob.arrayBuffer());
    expect(Array.from(assembledArray)).toEqual(Array.from(originalData));
  });

  it('STRICT REJECTION: blocks and refuses to save any file if SHA-256 does not match', async () => {
    const originalData = new Uint8Array(20);
    for (let i = 0; i < 20; i++) originalData[i] = i + 1;

    const expectedSha256 = await calculateSha256(originalData.buffer);

    const manifest: FileManifest = {
      fileId: 'file_corrupted_test',
      fileName: 'corrupted_sample.apk',
      fileSize: 20,
      mimeType: 'application/vnd.android.package-archive',
      expectedSha256, // Real expected hash
      totalChunks: 2,
      chunkSize: 10
    };

    const assembly = new FileAssemblyBuffer(manifest);

    // Deliver Chunk 0 intact
    assembly.addChunk(
      { fileId: manifest.fileId, chunkIndex: 0, totalChunks: 2, offset: 0, payloadLength: 10 },
      originalData.slice(0, 10).buffer
    );

    // Deliver Chunk 1 WITH CORRUPTION (alter 1 single byte)
    const corruptedChunk = originalData.slice(10, 20);
    corruptedChunk[4] = 0xff; // Bit flip / corruption

    assembly.addChunk(
      { fileId: manifest.fileId, chunkIndex: 1, totalChunks: 2, offset: 10, payloadLength: 10 },
      corruptedChunk.buffer
    );

    expect(assembly.isComplete()).toBe(true);

    // Finalize MUST reject the file and throw ChecksumMismatchError
    await expect(assembly.finalize()).rejects.toThrow(ChecksumMismatchError);
  });

  it('Sha256Incremental calculates identical hash to Web Crypto API across multiple chunk feeds', async () => {
    // Create 100 KB test payload
    const testBytes = new Uint8Array(100 * 1024);
    for (let i = 0; i < testBytes.length; i++) {
      testBytes[i] = (i * 7 + 13) & 0xff;
    }

    const expectedHash = await calculateSha256(testBytes.buffer);

    // Feed in irregular slices to test internal 64-byte block boundary logic
    const incremental = new Sha256Incremental();
    const sliceSize = 777;
    for (let offset = 0; offset < testBytes.length; offset += sliceSize) {
      const slice = testBytes.subarray(offset, Math.min(testBytes.length, offset + sliceSize));
      incremental.update(slice);
    }
    const actualHash = incremental.digest();

    expect(actualHash).toBe(expectedHash);

    // Test calculateBlobSha256
    const blob = new Blob([testBytes]);
    const blobHash = await calculateBlobSha256(blob);
    expect(blobHash).toBe(expectedHash);
  });

});
