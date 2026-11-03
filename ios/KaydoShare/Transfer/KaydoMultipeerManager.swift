import Foundation
import MultipeerConnectivity
import Combine

public struct DiscoveredPeer: Identifiable {
    public let id: String
    public let peerID: MCPeerID
    public var name: String { peerID.displayName }
}

public class KaydoMultipeerManager: NSObject, ObservableObject {

    private let serviceType = "kaydo-share"
    private let myPeerID = MCPeerID(displayName: "KAYDO-iPhone-\(Int.random(in: 100...999))")

    private var session: MCSession?
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?

    @Published public var discoveredPeers: [DiscoveredPeer] = []
    @Published public var connectedPeer: MCPeerID?
    @Published public var transferProgress: Double = 0.0
    @Published public var isTransferring: Bool = false
    @Published public var errorMessage: String?

    public override init() {
        super.init()
        setupSession()
    }

    private func setupSession() {
        let sess = MCSession(peer: myPeerID, securityIdentity: nil, encryptionPreference: .required)
        sess.delegate = self
        self.session = sess
    }

    public func startAdvertising() {
        advertiser = MCNearbyServiceAdvertiser(peer: myPeerID, discoveryInfo: nil, serviceType: serviceType)
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

    public func sendFile(at url: URL) {
        guard let session = session, let peer = connectedPeer else { return }
        isTransferring = true
        transferProgress = 0.0

        session.sendResource(at: url, withName: url.lastPathComponent, toPeer: peer) { [weak self] error in
            DispatchQueue.main.async {
                self?.isTransferring = false
                if let error = error {
                    self?.errorMessage = error.localizedDescription
                } else {
                    self?.transferProgress = 1.0
                }
            }
        }
    }

    public func stopAll() {
        advertiser?.stopAdvertisingPeer()
        browser?.stopBrowsingForPeers()
        session?.disconnect()
        discoveredPeers.removeAll()
        connectedPeer = nil
    }
}

extension KaydoMultipeerManager: MCSessionDelegate {
    public func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        DispatchQueue.main.async {
            switch state {
            case .connected:
                self.connectedPeer = peerID
            case .notConnected:
                if self.connectedPeer == peerID {
                    self.connectedPeer = nil
                }
            default:
                break
            }
        }
    }

    public func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        // Direct binary frame received
    }

    public func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {
    }

    public func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {
        DispatchQueue.main.async {
            self.isTransferring = true
        }
        progress.observe(\.fractionCompleted) { [weak self] p, _ in
            DispatchQueue.main.async {
                self?.transferProgress = p.fractionCompleted
            }
        }
    }

    public func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {
        DispatchQueue.main.async {
            self.isTransferring = false
            if let error = error {
                self.errorMessage = error.localizedDescription
            }
        }
    }
}

extension KaydoMultipeerManager: MCNearbyServiceAdvertiserDelegate {
    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        // Auto-accept invitation in session
        invitationHandler(true, self.session)
    }
}

extension KaydoMultipeerManager: MCNearbyServiceBrowserDelegate {
    public func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String : String]?) {
        DispatchQueue.main.async {
            if !self.discoveredPeers.contains(where: { $0.peerID == peerID }) {
                self.discoveredPeers.append(DiscoveredPeer(id: peerID.displayName, peerID: peerID))
            }
        }
    }

    public func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        DispatchQueue.main.async {
            self.discoveredPeers.removeAll { $0.peerID == peerID }
        }
    }
}
