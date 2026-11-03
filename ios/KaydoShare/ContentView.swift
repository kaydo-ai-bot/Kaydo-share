import SwiftUI

struct ContentView: View {
    @StateObject private var multipeerManager = KaydoMultipeerManager()
    @State private var activeMode: String? = nil

    var body: some View {
        ZStack {
            Color(red: 0.03, green: 0.03, blue: 0.06).ignoresSafeArea()

            VStack(spacing: 24) {
                // Header
                VStack(spacing: 4) {
                    Text("KAYDO SHARE")
                        .font(.system(size: 28, weight: .black))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [Color.blue, Color.indigo, Color.purple],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )

                    Text("Partage direct 100% Hors-Ligne (iOS & Android)")
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                }
                .padding(.top, 20)

                // Action Cards: ENVOYER / RECEVOIR
                HStack(spacing: 16) {
                    Button(action: {
                        activeMode = "send"
                        multipeerManager.startAdvertising()
                    }) {
                        VStack(spacing: 8) {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.system(size: 32))
                                .foregroundColor(.blue)
                            Text("ENVOYER")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                            Text("Mode Émetteur")
                                .font(.system(size: 11))
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity, minHeight: 120)
                        .background(Color(red: 0.06, green: 0.09, blue: 0.16))
                        .cornerRadius(20)
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(Color.blue.opacity(0.3), lineWidth: 1)
                        )
                    }

                    Button(action: {
                        activeMode = "receive"
                        multipeerManager.startDiscovery()
                    }) {
                        VStack(spacing: 8) {
                            Image(systemName: "arrow.down.circle.fill")
                                .font(.system(size: 32))
                                .foregroundColor(.purple)
                            Text("RECEVOIR")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                            Text("Mode Radar")
                                .font(.system(size: 11))
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity, minHeight: 120)
                        .background(Color(red: 0.06, green: 0.09, blue: 0.16))
                        .cornerRadius(20)
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(Color.purple.opacity(0.3), lineWidth: 1)
                        )
                    }
                }
                .padding(.horizontal)

                // Discovered Devices Section (Real, zero mock)
                VStack(alignment: .leading, spacing: 12) {
                    Text("APPAREILS DÉTECTÉS (\(multipeerManager.discoveredPeers.count))")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.gray)

                    if multipeerManager.discoveredPeers.isEmpty {
                        VStack(spacing: 8) {
                            Image(systemName: "wifi.slash")
                                .font(.system(size: 24))
                                .foregroundColor(.gray)
                            Text(activeMode != nil ? "Recherche d'appareils réels à proximité..." : "Appuyez sur ENVOYER ou RECEVOIR.")
                                .font(.system(size: 12))
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity, minHeight: 100)
                        .background(Color(red: 0.04, green: 0.05, blue: 0.09))
                        .cornerRadius(16)
                    } else {
                        ForEach(multipeerManager.discoveredPeers) { peer in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(peer.name)
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(.white)
                                    Text("Multipeer P2P")
                                        .font(.system(size: 10))
                                        .foregroundColor(.gray)
                                }
                                Spacer()
                                Button("Connecter") {
                                    multipeerManager.invitePeer(peer)
                                }
                                .font(.system(size: 12, weight: .bold))
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(12)
                            }
                            .padding()
                            .background(Color(red: 0.06, green: 0.09, blue: 0.16))
                            .cornerRadius(16)
                        }
                    }
                }
                .padding(.horizontal)

                // Active Transfer Card
                if multipeerManager.isTransferring || multipeerManager.transferProgress > 0 {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Transfert P2P Direct...")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                            Text("\(Int(multipeerManager.transferProgress * 100))%")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.blue)
                        }

                        ProgressView(value: multipeerManager.transferProgress)
                            .tint(.blue)

                        Text("Validation SHA-256 active")
                            .font(.system(size: 10))
                            .foregroundColor(.green)
                    }
                    .padding()
                    .background(Color(red: 0.08, green: 0.12, blue: 0.2))
                    .cornerRadius(16)
                    .padding(.horizontal)
                }

                Spacer()
            }
        }
    }
}
