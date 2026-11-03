import Foundation
import Network
import CryptoKit

let port: NWEndpoint.Port = 52222
let magic = Data([0x4B, 0x59, 0x44, 0x4F]) // "KYDO"

let downloadDir = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first!
    .appendingPathComponent("KaydoShare")

try? FileManager.default.createDirectory(at: downloadDir, withIntermediateDirectories: true)

print("==========================================")
print("  KAYDO SHARE - Démon macOS Natif")
print("  Dossier : \(downloadDir.path)")
print("  Port TCP : \(port.rawValue)")
print("==========================================")

let listener = try NWListener(using: .tcp, on: port)

listener.newConnectionHandler = { connection in
    connection.start(queue: .main)

    connection.receive(minimumIncompleteLength: 8, maximumLength: 65536) { data, _, isComplete, error in
        guard let data = data, data.count >= 8, data.prefix(4) == magic else {
            connection.cancel()
            return
        }

        let headerLen = Int(data.subdata(in: 6..<8).withUnsafeBytes { $0.load(as: UInt16.self).bigEndian })
        let manifestData = data.subdata(in: 8..<(8 + headerLen))

        guard let manifest = try? JSONSerialization.jsonObject(with: manifestData) as? [String: Any],
              let fileName = manifest["fileName"] as? String else {
            connection.cancel()
            return
        }

        let expectedSha256 = manifest["expectedSha256"] as? String ?? ""
        let safeName = URL(fileURLWithPath: fileName).lastPathComponent
        let tempUrl = downloadDir.appendingPathComponent(".tmp_\(Int(Date().timeIntervalSince1970))_\(safeName)")

        var fileData = data.subdata(in: (8 + headerLen)..<data.count)

        func readRemaining() {
            connection.receive(minimumIncompleteLength: 1, maximumLength: 131072) { chunk, _, chunkComplete, _ in
                if let chunk = chunk {
                    fileData.append(chunk)
                }
                if chunkComplete || chunk == nil {
                    // Verify SHA-256
                    let hash = SHA256.hash(data: fileData).map { String(format: "%02x", $0) }.joined()
                    if !expectedSha256.isEmpty && hash.lowercased() != expectedSha256.lowercased() {
                        print("[ERREUR] SHA-256 non concordant pour \(safeName). Fichier détruit.")
                    } else {
                        let finalUrl = downloadDir.appendingPathComponent(safeName)
                        try? fileData.write(to: finalUrl)
                        print("[SUCCÈS] Fichier reçu et vérifié : \(finalUrl.path)")
                    }
                    connection.cancel()
                } else {
                    readRemaining()
                }
            }
        }

        readRemaining()
    }
}

listener.start(queue: .main)
print("[OK] En attente de transferts entrants depuis Android, iPhone ou PC...")
RunLoop.main.run()
