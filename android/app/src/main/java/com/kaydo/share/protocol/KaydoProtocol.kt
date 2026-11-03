package com.kaydo.share.protocol

import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
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
) {
    fun toJson(): String {
        val json = JSONObject()
        json.put("fileId", fileId)
        json.put("fileName", fileName)
        json.put("fileSize", fileSize)
        json.put("mimeType", mimeType)
        json.put("expectedSha256", expectedSha256)
        json.put("totalChunks", totalChunks)
        json.put("chunkSize", chunkSize)
        return json.toString()
    }

    companion object {
        fun fromJson(jsonStr: String): FileManifest {
            val json = JSONObject(jsonStr)
            return FileManifest(
                fileId = json.getString("fileId"),
                fileName = json.getString("fileName"),
                fileSize = json.getLong("fileSize"),
                mimeType = json.optString("mimeType", "application/octet-stream"),
                expectedSha256 = json.getString("expectedSha256"),
                totalChunks = json.getInt("totalChunks"),
                chunkSize = json.getInt("chunkSize")
            )
        }
    }
}

data class ChunkMeta(
    val fileId: String,
    val chunkIndex: Int,
    val totalChunks: Int,
    val offset: Long
)

class ChecksumMismatchException(val expected: String, val actual: String) :
    Exception("Échec de vérification cryptographique SHA-256. Attendu: $expected, Calculé: $actual. Fichier rejeté.")

class ProtocolViolationException(message: String) : Exception(message)

object KaydoProtocol {

    const val DEFAULT_CHUNK_SIZE = 64 * 1024 // 64 KB per chunk

    /**
     * Calcule le hash SHA-256 en continu (streaming) avec tampon de 64 Ko
     * pour éviter tout OutOfMemoryError sur les fichiers volumineux (100 Mo+).
     */
    fun calculateFileSha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { fis ->
            val buffer = ByteArray(65536)
            var read: Int
            while (fis.read(buffer).also { read = it } != -1) {
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    /**
     * Calcule le SHA-256 d'un flux d'entrée (InputStream).
     */
    fun calculateStreamSha256(stream: InputStream): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(65536)
        var read: Int
        while (stream.read(buffer).also { read = it } != -1) {
            digest.update(buffer, 0, read)
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    /**
     * Calcule le hash SHA-256 en mémoire pour un tampon de données direct.
     */
    fun calculateSha256(data: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(data)
        return hash.joinToString("") { "%02x".format(it) }
    }

    /**
     * Encode une trame de manifeste (FILE_MANIFEST = 0x03)
     */
    fun encodeManifestFrame(manifest: FileManifest): ByteArray {
        val payload = manifest.toJson().toByteArray(Charsets.UTF_8)
        val buffer = ByteBuffer.allocate(6 + payload.size).order(ByteOrder.BIG_ENDIAN)
        buffer.put(KAYDO_MAGIC)
        buffer.put(KAYDO_VERSION)
        buffer.put(KaydoMessageType.FILE_MANIFEST)
        buffer.put(payload)
        return buffer.array()
    }

    /**
     * Décode une trame de manifeste
     */
    fun decodeManifestFrame(data: ByteArray): FileManifest {
        validateHeader(data, KaydoMessageType.FILE_MANIFEST)
        val jsonStr = String(data, 6, data.size - 6, Charsets.UTF_8)
        return FileManifest.fromJson(jsonStr)
    }

    /**
     * Encode un bloc binaire (FILE_CHUNK = 0x04)
     * Format strict gros-boutiste (Big-Endian):
     * [0..3]: Magic 'KYDO'
     * [4]: Version (0x01)
     * [5]: Type (0x04)
     * [6..7]: ChunkIndex (UInt16)
     * [8..9]: TotalChunks (UInt16)
     * [10..13]: Offset (UInt32)
     * [14..15]: FileIdLength (UInt16)
     * [16..16+IdLen-1]: FileId (UTF-8)
     * [16+IdLen..end]: Chunk Payload
     */
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
        buffer.putShort((chunkIndex and 0xFFFF).toShort())
        buffer.putShort((totalChunks and 0xFFFF).toShort())
        buffer.putInt((offset and 0xFFFFFFFFL).toInt())
        buffer.putShort((idBytes.size and 0xFFFF).toShort())
        buffer.put(idBytes)
        buffer.put(chunkData)

        return buffer.array()
    }

    /**
     * Décode un bloc binaire
     */
    fun decodeChunkFrame(data: ByteArray): Pair<ChunkMeta, ByteArray> {
        if (data.size < 16) {
            throw ProtocolViolationException("Trame trop courte (< 16 octets)")
        }

        val buffer = ByteBuffer.wrap(data).order(ByteOrder.BIG_ENDIAN)
        val magic = ByteArray(4)
        buffer.get(magic)

        if (!magic.contentEquals(KAYDO_MAGIC)) {
            throw ProtocolViolationException("Magic bytes 'KYDO' invalides")
        }

        val version = buffer.get()
        if (version != KAYDO_VERSION) {
            throw ProtocolViolationException("Version de protocole non supportée: $version")
        }

        val type = buffer.get()
        if (type != KaydoMessageType.FILE_CHUNK) {
            throw ProtocolViolationException("Type de message attendu FILE_CHUNK (0x04), reçu: $type")
        }

        val chunkIndex = buffer.short.toInt() and 0xFFFF
        val totalChunks = buffer.short.toInt() and 0xFFFF
        val offset = buffer.int.toLong() and 0xFFFFFFFFL
        val idLen = buffer.short.toInt() and 0xFFFF

        if (buffer.remaining() < idLen) {
            throw ProtocolViolationException("Trame tronquée pour l'identifiant de fichier")
        }

        val idBytes = ByteArray(idLen)
        buffer.get(idBytes)
        val fileId = String(idBytes, Charsets.UTF_8)

        val payload = ByteArray(buffer.remaining())
        buffer.get(payload)

        return Pair(ChunkMeta(fileId, chunkIndex, totalChunks, offset), payload)
    }

    /**
     * Trame de contrôle (HANDSHAKE, COMPLETE, CANCEL)
     */
    fun encodeControlFrame(type: Byte, payload: ByteArray = ByteArray(0)): ByteArray {
        val buffer = ByteBuffer.allocate(6 + payload.size).order(ByteOrder.BIG_ENDIAN)
        buffer.put(KAYDO_MAGIC)
        buffer.put(KAYDO_VERSION)
        buffer.put(type)
        if (payload.isNotEmpty()) {
            buffer.put(payload)
        }
        return buffer.array()
    }

    private fun validateHeader(data: ByteArray, expectedType: Byte) {
        if (data.size < 6) {
            throw ProtocolViolationException("Trame trop courte pour l'en-tête de contrôle")
        }
        for (i in 0..3) {
            if (data[i] != KAYDO_MAGIC[i]) {
                throw ProtocolViolationException("Magic bytes 'KYDO' incorrects")
            }
        }
        if (data[4] != KAYDO_VERSION) {
            throw ProtocolViolationException("Version inconnue: ${data[4]}")
        }
        if (data[5] != expectedType) {
            throw ProtocolViolationException("Type attendu $expectedType, reçu: ${data[5]}")
        }
    }
}
