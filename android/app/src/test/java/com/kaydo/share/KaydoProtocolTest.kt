package com.kaydo.share

import com.kaydo.share.protocol.FileManifest
import com.kaydo.share.protocol.KaydoMessageType
import com.kaydo.share.protocol.KaydoProtocol
import com.kaydo.share.protocol.ProtocolViolationException
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileOutputStream

class KaydoProtocolTest {

    @Test
    fun testMagicBytesAndVersion() {
        val chunkData = "Hello Kaydo P2P World".toByteArray(Charsets.UTF_8)
        val encoded = KaydoProtocol.encodeChunkFrame(
            fileId = "file-1234",
            chunkIndex = 0,
            totalChunks = 10,
            offset = 0L,
            chunkData = chunkData
        )

        // Verifier les 4 octets magiques "KYDO"
        assertEquals('K'.code.toByte(), encoded[0])
        assertEquals('Y'.code.toByte(), encoded[1])
        assertEquals('D'.code.toByte(), encoded[2])
        assertEquals('O'.code.toByte(), encoded[3])

        // Verifier version = 1 et type = FILE_CHUNK (0x04)
        assertEquals(1.toByte(), encoded[4])
        assertEquals(KaydoMessageType.FILE_CHUNK, encoded[5])
    }

    @Test
    fun testEncodeDecodeChunkFrame() {
        val payload = ByteArray(64 * 1024) { (it % 256).toByte() }
        val encoded = KaydoProtocol.encodeChunkFrame(
            fileId = "video-sample-01",
            chunkIndex = 4,
            totalChunks = 100,
            offset = 262144L,
            chunkData = payload
        )

        val (meta, decodedPayload) = KaydoProtocol.decodeChunkFrame(encoded)
        assertEquals("video-sample-01", meta.fileId)
        assertEquals(4, meta.chunkIndex)
        assertEquals(100, meta.totalChunks)
        assertEquals(262144L, meta.offset)
        assertArrayEquals(payload, decodedPayload)
    }

    @Test
    fun testManifestSerialization() {
        val manifest = FileManifest(
            fileId = "doc-999",
            fileName = "presentation.pdf",
            fileSize = 10485760L,
            mimeType = "application/pdf",
            expectedSha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            totalChunks = 160,
            chunkSize = 65536
        )

        val frame = KaydoProtocol.encodeManifestFrame(manifest)
        val decoded = KaydoProtocol.decodeManifestFrame(frame)

        assertEquals(manifest.fileId, decoded.fileId)
        assertEquals(manifest.fileName, decoded.fileName)
        assertEquals(manifest.fileSize, decoded.fileSize)
        assertEquals(manifest.expectedSha256, decoded.expectedSha256)
        assertEquals(manifest.totalChunks, decoded.totalChunks)
    }

    @Test
    fun testSha256StreamingIntegrity() {
        // Test avec flux de 1 Mo
        val data = ByteArray(1024 * 1024) { 0x42 }
        val memoryHash = KaydoProtocol.calculateSha256(data)

        val stream = ByteArrayInputStream(data)
        val streamHash = KaydoProtocol.calculateStreamSha256(stream)

        assertEquals("Le hash en streaming doit correspondre parfaitement au hash en mémoire", memoryHash, streamHash)
    }

    @Test
    fun testCorruptedFrameRejection() {
        val encoded = KaydoProtocol.encodeChunkFrame(
            fileId = "test",
            chunkIndex = 0,
            totalChunks = 1,
            offset = 0L,
            chunkData = byteArrayOf(1, 2, 3)
        )

        // Altérer le magic byte
        val corrupted = encoded.clone()
        corrupted[0] = 0x00

        try {
            KaydoProtocol.decodeChunkFrame(corrupted)
            fail("Aurait du lever ProtocolViolationException pour magic bytes invalides")
        } catch (e: ProtocolViolationException) {
            assertTrue(e.message!!.contains("Magic bytes"))
        }
    }
}
