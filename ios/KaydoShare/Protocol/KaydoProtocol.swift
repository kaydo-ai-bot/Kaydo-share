import Foundation
import CryptoKit

public let KAYDO_MAGIC = Data([0x4B, 0x59, 0x44, 0x4F]) // "KYDO"
public let KAYDO_VERSION: UInt8 = 1

public enum KaydoMessageType: UInt8 {
    case handshakeRequest = 0x01
    case handshakeAccept = 0x02
    case fileManifest = 0x03
    case fileChunk = 0x04
    case transferComplete = 0x05
    case transferCancel = 0x06
    case errorChecksumFailed = 0x07
}

public struct FileManifest: Codable {
    public let fileId: String
    public let fileName: String
    public let fileSize: Int64
    public let mimeType: String
    public let expectedSha256: String
    public let totalChunks: Int
    public let chunkSize: Int

    public init(
        fileId: String,
        fileName: String,
        fileSize: Int64,
        mimeType: String = "application/octet-stream",
        expectedSha256: String,
        totalChunks: Int,
        chunkSize: Int
    ) {
        self.fileId = fileId
        self.fileName = fileName
        self.fileSize = fileSize
        self.mimeType = mimeType
        self.expectedSha256 = expectedSha256
        self.totalChunks = totalChunks
        self.chunkSize = chunkSize
    }
}

public struct ChunkHeader {
    public let fileId: String
    public let chunkIndex: Int
    public let totalChunks: Int
    public let offset: Int64
}

public enum KaydoError: Error, LocalizedError {
    case invalidMagicBytes
    case unsupportedVersion(UInt8)
    case invalidMessageType(UInt8)
    case checksumMismatch(expected: String, actual: String)
    case transferCancelled
    case fileReadError(String)
    case fileWriteError(String)

    public var errorDescription: String? {
        switch self {
        case .invalidMagicBytes:
            return "Protocole invalide: Magic bytes 'KYDO' manquants"
        case .unsupportedVersion(let v):
            return "Version de protocole non supportée: \(v)"
        case .invalidMessageType(let type):
            return "Type de message inconnu: \(type)"
        case .checksumMismatch(let exp, let act):
            return "Échec de vérification cryptographique SHA-256. Attendu: \(exp), Calculé: \(act). Fichier rejeté."
        case .transferCancelled:
            return "Le transfert a été interrompu ou annulé."
        case .fileReadError(let msg):
            return "Erreur de lecture du fichier: \(msg)"
        case .fileWriteError(let msg):
            return "Erreur d'écriture du fichier: \(msg)"
        }
    }
}

public struct KaydoProtocol {

    public static let defaultChunkSize = 64 * 1024 // 64 KB per chunk

    /**
     * Calcule le hash SHA-256 en continu (streaming) par blocs de 64 Ko
     * pour garantir une utilisation mémoire O(1) même sur des fichiers de 100 Mo et plus.
     */
    public static func calculateFileSha256(at url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }

        var hasher = SHA256()
        let bufferSize = 65536

        while true {
            let chunk = handle.readData(ofLength: bufferSize)
            if chunk.isEmpty { break }
            hasher.update(data: chunk)
        }

        let digest = hasher.finalize()
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    /**
     * Calcule le SHA-256 en mémoire pour les trames et tampons directs.
     */
    public static func calculateSha256(data: Data) -> String {
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    /**
     * Encode le manifeste sous forme de trame binaire FILE_MANIFEST
     */
    public static func encodeManifestFrame(manifest: FileManifest) throws -> Data {
        let encoder = JSONEncoder()
        let jsonData = try encoder.encode(manifest)

        var data = Data()
        data.append(KAYDO_MAGIC)
        data.append(KAYDO_VERSION)
        data.append(KaydoMessageType.fileManifest.rawValue)
        data.append(jsonData)
        return data
    }

    /**
     * Décode une trame FILE_MANIFEST
     */
    public static func decodeManifestFrame(data: Data) throws -> FileManifest {
        guard data.count >= 6 else {
            throw KaydoError.invalidMagicBytes
        }

        let magic = data.subdata(in: 0..<4)
        guard magic == KAYDO_MAGIC else {
            throw KaydoError.invalidMagicBytes
        }

        let version = data[4]
        guard version == KAYDO_VERSION else {
            throw KaydoError.unsupportedVersion(version)
        }

        let type = data[5]
        guard type == KaydoMessageType.fileManifest.rawValue else {
            throw KaydoError.invalidMessageType(type)
        }

        let jsonPayload = data.subdata(in: 6..<data.count)
        let decoder = JSONDecoder()
        return try decoder.decode(FileManifest.self, from: jsonPayload)
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
    public static func encodeChunkFrame(
        fileId: String,
        chunkIndex: Int,
        totalChunks: Int,
        offset: Int64,
        chunkData: Data
    ) -> Data {
        var data = Data()
        data.append(KAYDO_MAGIC)
        data.append(KAYDO_VERSION)
        data.append(KaydoMessageType.fileChunk.rawValue)

        var idx = UInt16(chunkIndex).bigEndian
        data.append(Data(bytes: &idx, count: 2))

        var total = UInt16(totalChunks).bigEndian
        data.append(Data(bytes: &total, count: 2))

        var off = UInt32(offset).bigEndian
        data.append(Data(bytes: &off, count: 4))

        let idBytes = fileId.data(using: .utf8) ?? Data()
        var idLen = UInt16(idBytes.count).bigEndian
        data.append(Data(bytes: &idLen, count: 2))
        data.append(idBytes)

        data.append(chunkData)
        return data
    }

    /**
     * Décode un bloc binaire FILE_CHUNK
     */
    public static func decodeChunkFrame(data: Data) throws -> (ChunkHeader, Data) {
        guard data.count >= 16 else {
            throw KaydoError.invalidMagicBytes
        }

        let magic = data.subdata(in: 0..<4)
        guard magic == KAYDO_MAGIC else {
            throw KaydoError.invalidMagicBytes
        }

        let version = data[4]
        guard version == KAYDO_VERSION else {
            throw KaydoError.unsupportedVersion(version)
        }

        let type = data[5]
        guard type == KaydoMessageType.fileChunk.rawValue else {
            throw KaydoError.invalidMessageType(type)
        }

        let idx = data.subdata(in: 6..<8).withUnsafeBytes { $0.load(as: UInt16.self).bigEndian }
        let total = data.subdata(in: 8..<10).withUnsafeBytes { $0.load(as: UInt16.self).bigEndian }
        let off = data.subdata(in: 10..<14).withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
        let idLen = Int(data.subdata(in: 14..<16).withUnsafeBytes { $0.load(as: UInt16.self).bigEndian })

        guard data.count >= 16 + idLen else {
            throw KaydoError.invalidMagicBytes
        }

        let idData = data.subdata(in: 16..<(16 + idLen))
        let fileId = String(data: idData, encoding: .utf8) ?? ""

        let payloadOffset = 16 + idLen
        let payload = data.subdata(in: payloadOffset..<data.count)

        let header = ChunkHeader(
            fileId: fileId,
            chunkIndex: Int(idx),
            totalChunks: Int(total),
            offset: Int64(off)
        )
        return (header, payload)
    }

    /**
     * Trame de contrôle (HANDSHAKE, COMPLETE, CANCEL, CHECKSUM_FAILED)
     */
    public static func encodeControlFrame(type: KaydoMessageType, payload: Data = Data()) -> Data {
        var data = Data()
        data.append(KAYDO_MAGIC)
        data.append(KAYDO_VERSION)
        data.append(type.rawValue)
        data.append(payload)
        return data
    }
}
