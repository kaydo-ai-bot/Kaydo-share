import XCTest
@testable import KaydoShare

final class KaydoProtocolTests: XCTestCase {

    func testMagicBytesAndVersion() {
        let chunkData = "Hello Kaydo iOS".data(using: .utf8)!
        let encoded = KaydoProtocol.encodeChunkFrame(
            fileId: "ios-file-1",
            chunkIndex: 0,
            totalChunks: 5,
            offset: 0,
            chunkData: chunkData
        )

        XCTAssertEqual(encoded[0], 0x4B) // 'K'
        XCTAssertEqual(encoded[1], 0x59) // 'Y'
        XCTAssertEqual(encoded[2], 0x44) // 'D'
        XCTAssertEqual(encoded[3], 0x4F) // 'O'
        XCTAssertEqual(encoded[4], 1)    // Version
        XCTAssertEqual(encoded[5], KaydoMessageType.fileChunk.rawValue)
    }

    func testEncodeDecodeChunkFrame() throws {
        let chunkPayload = Data(repeating: 0x5A, count: 65536)
        let encoded = KaydoProtocol.encodeChunkFrame(
            fileId: "large-video-mp4",
            chunkIndex: 3,
            totalChunks: 200,
            offset: 196608,
            chunkData: chunkPayload
        )

        let (header, decodedPayload) = try KaydoProtocol.decodeChunkFrame(data: encoded)
        XCTAssertEqual(header.fileId, "large-video-mp4")
        XCTAssertEqual(header.chunkIndex, 3)
        XCTAssertEqual(header.totalChunks, 200)
        XCTAssertEqual(header.offset, 196608)
        XCTAssertEqual(decodedPayload, chunkPayload)
    }

    func testManifestFrameSerialization() throws {
        let manifest = FileManifest(
            fileId = "test-uuid-99",
            fileName = "archive.zip",
            fileSize = 52428800,
            expectedSha256: "bf85e13589b94098939a8968d6f51c7aa7c300fa6c04fcf1ca4ee28ffca356b2",
            totalChunks = 800,
            chunkSize: 65536
        )

        let frame = try KaydoProtocol.encodeManifestFrame(manifest: manifest)
        let decoded = try KaydoProtocol.decodeManifestFrame(data: frame)

        XCTAssertEqual(decoded.fileId, manifest.fileId)
        XCTAssertEqual(decoded.fileName, manifest.fileName)
        XCTAssertEqual(decoded.fileSize, manifest.fileSize)
        XCTAssertEqual(decoded.expectedSha256, manifest.expectedSha256)
        XCTAssertEqual(decoded.totalChunks, manifest.totalChunks)
    }

    func testCorruptedFrameDetection() {
        var encoded = KaydoProtocol.encodeChunkFrame(
            fileId: "bad-frame",
            chunkIndex: 0,
            totalChunks: 1,
            offset: 0,
            chunkData: Data([1, 2, 3])
        )

        // Corruption du premier octet
        encoded[0] = 0x00

        XCTAssertThrowsError(try KaydoProtocol.decodeChunkFrame(data: encoded)) { error in
            guard let kaydoError = error as? KaydoError else {
                XCTFail("Doit être un KaydoError")
                return
            }
            if case .invalidMagicBytes = kaydoError {
                // Succès
            } else {
                XCTFail("Devrait être invalidMagicBytes")
            }
        }
    }
}
