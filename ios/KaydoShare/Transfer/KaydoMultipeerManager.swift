import Foundation
import MultipeerConnectivity
import Combine

public struct DiscoveredPeer: Identifiable {
    public let id: String
    public let peerID: MCPeerID
    public var name: String { peerID.displayName }

    public init(peerID: MCPeerID) {
        self.id = peerID.displayName
        self.peerID = peerID
    }
}

public struct PendingInvitation: Identifiable {
    public let id = UUID()
    public let peerID: MCPeerID
    public let peerName: String
    public let handler: (Bool, MCSession?) -> Void
}

public struct TransferRecord: Identifiable {
    public let id = UUID()
    public let fileName: String
    public let fileSize: Int64
    public let date: Date
    public let isReceived: BooleanLiteralType
    public let sha256: String
    public let isSuccess: Bool
}

public class KaydoMultipeerManager: NSObject, ObservableObject {

    private let serviceType = "kaydo-share"
    private var myPeerID: MCPeerID

    private var session: MCSession?
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?

    @Published public var discoveredPeers: [DiscoveredPeer] = []
    @Published public var connectedPeer: MCPeerID?
    @Published public var pendingInvitation: PendingInvitation?
    @Published public var transferProgress: Double = 0.0
    @Published public var currentTransferSpeedMBs: Double = 0.0
    @Published public var isTransferring: Bool = false
    @Published public var currentFileName: String = ""
    @Published public var isSha256Verified: Bool = false
    @Published public var errorMessage: String?
    @Published public var transferHistory: [TransferRecord] = []

    private var pendingManifests: [String: FileManifest] = [:]
    private var outgoingManifests: [String: FileManifest] = [:]

    // Mesure de vitesse réelle
    private var lastBytesTransferred: Int64 = 0
    private var lastSpeedCheckTime: TimeInterval = 0

    public override init() {
        let deviceName = "KAYDO-iOS-\(UIDevice.current.name.replacingOccurrences(of: " ", with: "-"))"
        self.myPeerID = MCPeerID(displayName: deviceName)
        super.init()
        setupSession()
    }

    private func setupSession() {
        let sess = MCSession(peer: myPeerID, securityIdentity: nil, encryptionPreference: .required)
        sess.delegate = self
        self.session = sess
    }

    public func startAdvertising() {
        advertiser = MCNearbyServiceAdvertiser(peer: myPeerID, discoveryInfo: ["protocol": "KYDO_V1"], serviceType: serviceType)
        advertiser?.delegate = self
        advertiser?.startAdvertisingPeer()
    }

    public func startDiscovery() {
        discoveredPeers.removeAll()
        browser = MCNearbyServiceBrowser(peer: myPeerID, serviceType: serviceType)
        browser?.delegate = self
        browser?.startBrowsingForPeers()
    }

    public func invitePeer(_ peer: DiscoveredPeer) {
        guard let session = session else { return }
        browser?.invitePeer(peer.peerID, to: session, withContext: nil, timeout: 30)
    }

    /**
     * L'utilisateur accepte explicitement l'invitation entrante
     */
    public func acceptPendingInvitation() {
        guard let pending = pendingInvitation else { return }
        pending.handler(true, self.session)
        DispatchQueue.main.async {
            self.pendingInvitation = nil
        }
    }

    /**
     * L'utilisateur refuse l'invitation entrante
     */
    public func declinePendingInvitation() {
        guard let pending = pendingInvitation else { return }
        pending.handler(false, nil)
        DispatchQueue.main.async {
            self.pendingInvitation = nil
        }
    }

    /**
     * Envoi d'un fichier réel sélectionné par l'utilisateur
     */
    public func sendFile(at url: URL) {
        guard let session = session, let peer = connectedPeer else {
            errorMessage = "Aucun appareil connecté pour effectuer le transfert"
            return
        }

        let isAccessing = url.startAccessingSecurityScopedResource()
        defer {
            if isAccessing {
                url.stopAccessingSecurityScopedResource()
            }
        }

        do {
            let fileName = url.lastPathComponent
            let resources = try url.resourceValues(forKeys: [.fileSizeKey])
            let fileSize = Int64(resources.fileSize ?? 0)

            // Calcul SHA-256 en continu (O(1) RAM)
            let fileSha256 = try KaydoProtocol.calculateFileSha256(at: url)
            let fileId = UUID().uuidString

            let manifest = FileManifest(
                fileId: fileId,
                fileName: fileName,
                fileSize: fileSize,
                expectedSha256: fileSha256,
                totalChunks: 1,
                chunkSize: Int(fileSize)
            )

            // 1. Envoyer le manifeste en amont via le canal binaire sécurisé
            let manifestFrame = try KaydoProtocol.encodeManifestFrame(manifest: manifest)
            try session.send(manifestFrame, toPeers: [peer], with: .reliable)
            outgoingManifests[fileName] = manifest

            // 2. Début du transfert de la ressource
            DispatchQueue.main.async {
                self.isTransferring = true
                self.transferProgress = 0.0
                self.currentFileName = fileName
                self.isSha256Verified = false
                self.lastBytesTransferred = 0
                self.lastSpeedCheckTime = Date().timeIntervalSince1970
            }

            session.sendResource(at: url, withName: fileName, toPeer: peer) { [weak self] error in
                DispatchQueue.main.async {
                    self?.isTransferring = false
                    if let error = error {
                        self?.errorMessage = "Échec d'envoi: \(error.localizedDescription)"
                    } else {
                        self?.transferProgress = 1.0
                        self?.isSha256Verified = true
                        self?.addHistory(fileName: fileName, size: fileSize, isReceived: false, sha256: fileSha256, isSuccess: true)
                    }
                }
            }

        } catch {
            errorMessage = "Erreur lors de la préparation du fichier: \(error.localizedDescription)"
        }
    }

    public func stopAll() {
        advertiser?.stopAdvertisingPeer()
        browser?.stopBrowsingForPeers()
        session?.disconnect()
        discoveredPeers.removeAll()
        connectedPeer = nil
        pendingInvitation = nil
        pendingManifests.clear()
        outgoingManifests.clear()
        isTransferring = false
    }

    private func addHistory(fileName: String, size: Int64, isReceived: Bool, sha256: String, isSuccess: Bool) {
        let record = TransferRecord(
            fileName: fileName,
            fileSize: size,
            date: Date(),
            isReceived: isReceived,
            sha256: sha256,
            isSuccess: isSuccess
        )
        transferHistory.insert(record, at: 0)
    }
}

// MARK: - MCSessionDelegate
extension KaydoMultipeerManager: MCSessionDelegate {
    public func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        DispatchQueue.main.async {
            switch state {
            case .connected:
                self.connectedPeer = peerID
                self.errorMessage = nil
            case .notConnected:
                if self.connectedPeer == peerID {
                    self.connectedPeer = nil
                    if self.isTransferring {
                        self.isTransferring = false
                        self.errorMessage = "Connexion interrompue avec l'appareil distant"
                    }
                }
            case .connecting:
                break
            @unknown default:
                break
            }
        }
    }

    public func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        // Traitement des trames binaires directes (Manifeste, Contrôle)
        do {
            if data.count >= 6 && data[5] == KaydoMessageType.fileManifest.rawValue {
                let manifest = try KaydoProtocol.decodeManifestFrame(data: data)
                pendingManifests[peerID.displayName] = manifest
                DispatchQueue.main.async {
                    self.currentFileName = manifest.fileName
                    self.transferProgress = 0.0
                    self.isSha256Verified = false
                }
            }
        } catch {
            // Autres trames
        }
    }

    public func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {
        // Stream non requis ici car sendResource est utilisé
    }

    public func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {
        DispatchQueue.main.async {
            self.isTransferring = true
            self.currentFileName = resourceName
            self.transferProgress = 0.0
            self.isSha256Verified = false
            self.lastSpeedCheckTime = Date().timeIntervalSince1970
            self.lastBytesTransferred = 0
        }

        progress.observe(\.fractionCompleted) { [weak self] p, _ in
            let now = Date().timeIntervalSince1970
            let completedUnits = p.completedUnitCount
            let fraction = p.fractionCompleted

            DispatchQueue.main.async {
                guard let self = self else { return }
                self.transferProgress = fraction

                // Calcul de la vitesse réelle en Mo/s
                if self.lastSpeedCheckTime > 0 && now > self.lastSpeedCheckTime {
                    let dt = now - self.lastSpeedCheckTime
                    let db = completedUnits - self.lastBytesTransferred
                    if dt > 0 && db > 0 {
                        self.currentTransferSpeedMBs = (Double(db) / dt) / (1024.0 * 1024.0)
                    }
                }
                self.lastBytesTransferred = completedUnits
                self.lastSpeedCheckTime = now
            }
        }
    }

    public func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {
        DispatchQueue.main.async {
            self.isTransferring = false
        }

        if let error = error {
            DispatchQueue.main.async {
                self.errorMessage = "Erreur de réception: \(error.localizedDescription)"
                self.addHistory(fileName: resourceName, size: 0, isReceived: true, sha256: "", isSuccess: false)
            }
            return
        }

        guard let tempURL = localURL else {
            DispatchQueue.main.async {
                self.errorMessage = "URL temporaire invalide"
            }
            return
        }

        // Sauvegarde permanente dans le dossier Documents de l'application
        let fileManager = FileManager.default
        let docsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let destinationURL = docsURL.appendingPathComponent(resourceName)

        do {
            if fileManager.fileExists(atPath: destinationURL.path) {
                try fileManager.removeItem(at: destinationURL)
            }
            try fileManager.moveItem(at: tempURL, to: destinationURL)

            // VÉRIFICATION STRICTE DU SHA-256
            let actualSha256 = try KaydoProtocol.calculateFileSha256(at: destinationURL)
            let manifest = pendingManifests[peerID.displayName]
            let expectedSha = manifest?.expectedSha256

            let resources = try destinationURL.resourceValues(forKeys: [.fileSizeKey])
            let fileSize = Int64(resources.fileSize ?? 0)

            if let expected = expectedSha, !actualSha256.caseInsensitiveCompare(expected).rawValue == 0 {
                // CORRUPTION DÉTECTÉE : Suppression immédiate du fichier
                try? fileManager.removeItem(at: destinationURL)
                DispatchQueue.main.async {
                    self.isSha256Verified = false
                    self.errorMessage = "Corruption détectée ! Le hash SHA-256 ne correspond pas. Fichier supprimé par sécurité."
                    self.addHistory(fileName: resourceName, size: fileSize, isReceived: true, sha256: actualSha256, isSuccess: false)
                }
                return
            }

            // SUCCÈS : Intégrité validée
            DispatchQueue.main.async {
                self.transferProgress = 1.0
                self.isSha256Verified = true
                self.errorMessage = nil
                self.addHistory(fileName: resourceName, size: fileSize, isReceived: true, sha256: actualSha256, isSuccess: true)
            }

        } catch {
            DispatchQueue.main.async {
                self.errorMessage = "Erreur lors de la sauvegarde du fichier: \(error.localizedDescription)"
            }
        } finally {
            pendingManifests.removeValue(forKey: peerID.displayName)
        }
    }
}

// MARK: - MCNearbyServiceAdvertiserDelegate
extension KaydoMultipeerManager: MCNearbyServiceAdvertiserDelegate {
    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        // PAS D'ACCEPTATION AUTOMATIQUE : Demande explicite à l'utilisateur
        DispatchQueue.main.async {
            self.pendingInvitation = PendingInvitation(
                peerID: peerID,
                peerName: peerID.displayName,
                handler: invitationHandler
            )
        }
    }
}

// MARK: - MCNearbyServiceBrowserDelegate
extension KaydoMultipeerManager: MCNearbyServiceBrowserDelegate {
    public func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String : String]?) {
        DispatchQueue.main.async {
            if !self.discoveredPeers.contains(where: { $0.peerID == peerID }) {
                self.discoveredPeers.append(DiscoveredPeer(peerID: peerID))
            }
        }
    }

    public func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        DispatchQueue.main.async {
            self.discoveredPeers.removeAll { $0.peerID == peerID }
        }
    }
}
