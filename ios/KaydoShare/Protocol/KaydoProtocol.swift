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
}

public struct ChunkHeader {
    public let fileId: String
    public let chunkIndex: Int
    public let totalChunks: Int
    public let offset: Int64
}

public enum KaydoError: Error, LocalizedError {
    case invalidMagicBytes
    case invalidMessageType(UInt8)
    case checksumMismatch(expected: String, actual: String)
    case transferCancelled

    public var errorDescription: String? {
        switch self {
        case .invalidMagicBytes:
            return "Protocole invalide: Magic bytes manquants"
        case .invalidMessageType(let type):
            return "Type de message inconnu: \(type)"
        case .checksumMismatch(let exp, let act):
            return "Erreur d'intégrité SHA-256. Attendu: \(exp), Calculé: \(act). Fichier rejeté."
        case .transferCancelled:
            return "Le transfert a été annulé."
        }
    }
}

public struct KaydoProtocol {

    public static func calculateSha256(data: Data) -> String {
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }

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

    public static func decodeChunkFrame(data: Data) throws -> (ChunkHeader, Data) {
        guard data.count >= 16 else {
            throw KaydoError.invalidMagicBytes
        }

        let magic = data.subdata(in: 0..<4)
        guard magic == KAYDO_MAGIC else {
            throw KaydoError.invalidMagicBytes
        }

        let type = data[5]
        guard type == KaydoMessageType.fileChunk.rawValue else {
            throw KaydoError.invalidMessageType(type)
        }

        let idx = data.subdata(in: 6..<8).withUnsafeBytes { $0.load(as: UInt16.self).bigEndian }
        let total = data.subdata(in: 8..<10).withUnsafeBytes { $0.load(as: UInt16.self).bigEndian }
        let off = data.subdata(in: 10..<14).withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
        let idLen = Int(data.subdata(in: 14..<16).withUnsafeBytes { $0.load(as: UInt16.self).bigEndian })

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
}
