package com.kaydo.share.protocol

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest

val KAYDO_MAGIC = byteArrayOf(0x4B.toByte(), 0x59.toByte(), 0x44.toByte(), 0x4F.toByte()) // "KYDO"
const val KAYDO_VERSION: Byte = 1

object KaydoMessageType {
    const val HANDSHAKE_REQUEST: Byte = 0x01
    const val HANDSHAKE_ACCEPT: Byte = 0x02
    const val FILE_MANIFEST: Byte = 0x03
    const val FILE_CHUNK: Byte = 0x04
    const val TRANSFER_COMPLETE: Byte = 0x05
    const val TRANSFER_CANCEL: Byte = 0x06
    const val ERROR_CHECKSUM_FAILED: Byte = 0x07
}

data class FileManifest(
    val fileId: String,
    val fileName: String,
    val fileSize: Long,
    val mimeType: String,
    val expectedSha256: String,
    val totalChunks: Int,
    val chunkSize: Int
)

class ChecksumMismatchException(expected: String, actual: String) :
    Exception("Échec de vérification cryptographique SHA-256. Attendu: $expected, Calculé: $actual. Fichier rejeté.")

object KaydoProtocol {

    fun calculateSha256(data: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(data)
        return hash.joinToString("") { "%02x".format(it) }
    }

    fun encodeChunkFrame(
        fileId: String,
        chunkIndex: Int,
        totalChunks: Int,
        offset: Long,
        chunkData: ByteArray
    ): ByteArray {
        val idBytes = fileId.toByteArray(Charsets.UTF_8)
        val headerLength = 16 + idBytes.size
        val totalLength = headerLength + chunkData.size

        val buffer = ByteBuffer.allocate(totalLength).order(ByteOrder.BIG_ENDIAN)
        buffer.put(KAYDO_MAGIC)
        buffer.put(KAYDO_VERSION)
        buffer.put(KaydoMessageType.FILE_CHUNK)
        buffer.putShort(chunkIndex.toShort())
        buffer.putShort(totalChunks.toShort())
        buffer.putInt(offset.toInt())
        buffer.putShort(idBytes.size.toShort())
        buffer.put(idBytes)
        buffer.put(chunkData)

        return buffer.array()
    }

    fun decodeChunkFrame(data: ByteArray): Pair<ChunkMeta, ByteArray> {
        val buffer = ByteBuffer.wrap(data).order(ByteOrder.BIG_ENDIAN)
        val magic = ByteArray(4)
        buffer.get(magic)

        if (!magic.contentEquals(KAYDO_MAGIC)) {
            throw IllegalArgumentException("Magic bytes incorrects")
        }

        val version = buffer.get()
        val type = buffer.get()
        if (type != KaydoMessageType.FILE_CHUNK) {
            throw IllegalArgumentException("Type attendu FILE_CHUNK (0x04), reçu: $type")
        }

        val chunkIndex = buffer.short.toInt() and 0xFFFF
        val totalChunks = buffer.short.toInt() and 0xFFFF
        val offset = buffer.int.toLong() and 0xFFFFFFFFL
        val idLen = buffer.short.toInt() and 0xFFFF

        val idBytes = ByteArray(idLen)
        buffer.get(idBytes)
        val fileId = String(idBytes, Charsets.UTF_8)

        val payload = ByteArray(buffer.remaining())
        buffer.get(payload)

        return Pair(ChunkMeta(fileId, chunkIndex, totalChunks, offset), payload)
    }
}

data class ChunkMeta(
    val fileId: String,
    val chunkIndex: Int,
    val totalChunks: Int,
    val offset: Long
)
