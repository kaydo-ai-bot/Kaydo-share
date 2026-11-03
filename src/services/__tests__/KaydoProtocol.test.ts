import { describe, it, expect } from 'vitest';
import {
  encodeManifestFrame,
  decodeManifestFrame,
  encodeChunkFrame,
  decodeChunkFrame,
  calculateSha256,
  FileAssemblyBuffer,
  ChecksumMismatchError,
  FileManifest
} from '../KaydoProtocol';

describe('KAYDO Protocol - Binary Framing & Verification Suite', () => {

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

  it('assembles chunks in order and verifies SHA-256 successfully', async () => {
    // Create test binary data: 3 chunks of 10 bytes = 30 bytes
    const originalData = new Uint8Array(30);
    for (let i = 0; i < 30; i++) originalData[i] = i * 3;

    const expectedSha256 = await calculateSha256(originalData.buffer);

    const manifest: FileManifest = {
      fileId: 'file_order_test',
      fileName: 'test_document.bin',
      fileSize: 30,
      mimeType: 'application/octet-stream',
      expectedSha256,
      totalChunks: 3,
      chunkSize: 10
    };

    const assembly = new FileAssemblyBuffer(manifest);

    // Chunk 0 (0..9)
    assembly.addChunk(
      { fileId: manifest.fileId, chunkIndex: 0, totalChunks: 3, offset: 0, payloadLength: 10 },
      originalData.slice(0, 10).buffer
    );
    expect(assembly.getProgressPercentage()).toBe(33);

    // Chunk 1 (10..19)
    assembly.addChunk(
      { fileId: manifest.fileId, chunkIndex: 1, totalChunks: 3, offset: 10, payloadLength: 10 },
      originalData.slice(10, 20).buffer
    );
    expect(assembly.getProgressPercentage()).toBe(66);

    // Chunk 2 (20..29)
    assembly.addChunk(
      { fileId: manifest.fileId, chunkIndex: 2, totalChunks: 3, offset: 20, payloadLength: 10 },
      originalData.slice(20, 30).buffer
    );
    expect(assembly.isComplete()).toBe(true);
    expect(assembly.getProgressPercentage()).toBe(100);

    const result = await assembly.finalize();
    expect(result.verifiedSha256).toBe(expectedSha256);
    expect(result.blob.size).toBe(30);
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
    const { Sha256Incremental, calculateBlobSha256 } = await import('../KaydoProtocol');

    // Create 100 KB test payload
    const testBytes = new Uint8Array(100 * 1024);
    for (let i = 0; i < testBytes.length; i++) {
      testBytes[i] = (i * 7 + 13) & 0xff;
    }

    const expectedHash = await calculateSha256(testBytes.buffer);

    // Feed in 7-byte irregular slices to test internal 64-byte block boundary logic
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

