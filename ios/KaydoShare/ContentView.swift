import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
    @StateObject private var multipeerManager = KaydoMultipeerManager()
    @StateObject private var crossPlatformManager = KaydoCrossPlatformManager()

    @State private var activeMode: String? = nil
    @State private var showFilePicker: Bool = false
    @State private var showCrossPlatformSheet: Bool = false

    // Cross-platform inputs
    @State private var hostIp: String = "192.168.43.1"
    @State private var pinCode: String = "4829"

    var body: some View {
        ZStack {
            Color(red: 0.03, green: 0.03, blue: 0.06).ignoresSafeArea()

            VStack(spacing: 20) {
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
                .padding(.top, 16)

                // Deux Grandes Actions : ENVOYER & RECEVOIR
                HStack(spacing: 14) {
                    // ENVOYER : Ouvre le véritable sélecteur de fichiers iOS
                    Button(action: {
                        activeMode = "send"
                        multipeerManager.startAdvertising()
                        showFilePicker = true
                    }) {
                        VStack(spacing: 6) {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.system(size: 30))
                                .foregroundColor(.blue)
                            Text("ENVOYER")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(.white)
                            Text("Sélectionner fichiers")
                                .font(.system(size: 11))
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity, minHeight: 110)
                        .background(Color(red: 0.06, green: 0.09, blue: 0.16))
                        .cornerRadius(18)
                        .overlay(
                            RoundedRectangle(cornerRadius: 18)
                                .stroke(Color.blue.opacity(0.3), lineWidth: 1)
                        )
                    }

                    // RECEVOIR : Active la recherche Multipeer
                    Button(action: {
                        activeMode = "receive"
                        multipeerManager.startDiscovery()
                    }) {
                        VStack(spacing: 6) {
                            Image(systemName: "arrow.down.circle.fill")
                                .font(.system(size: 30))
                                .foregroundColor(.purple)
                            Text("RECEVOIR")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(.white)
                            Text("Mode Radar")
                                .font(.system(size: 11))
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity, minHeight: 110)
                        .background(Color(red: 0.06, green: 0.09, blue: 0.16))
                        .cornerRadius(18)
                        .overlay(
                            RoundedRectangle(cornerRadius: 18)
                                .stroke(Color.purple.opacity(0.3), lineWidth: 1)
                        )
                    }
                }
                .padding(.horizontal)

                // Mode Direct Cross-Platform (Android ↔ iPhone)
                Button(action: {
                    showCrossPlatformSheet = true
                }) {
                    HStack {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .foregroundColor(.cyan)
                        Text("Mode Direct Android ↔ iPhone (Point d'accès local)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.white)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11))
                            .foregroundColor(.gray)
                    }
                    .padding(12)
                    .background(Color(red: 0.05, green: 0.07, blue: 0.13))
                    .cornerRadius(14)
                }
                .padding(.horizontal)

                // Appareil Connecté Actif
                if let connected = multipeerManager.connectedPeer {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Connecté à")
                                .font(.system(size: 10))
                                .foregroundColor(.gray)
                            Text(connected.displayName)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.green)
                        }
                        Spacer()
                        Button("Envoyer un fichier") {
                            showFilePicker = true
                        }
                        .font(.system(size: 11, weight: .bold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                    }
                    .padding(12)
                    .background(Color(red: 0.07, green: 0.11, blue: 0.19))
                    .cornerRadius(14)
                    .padding(.horizontal)
                }

                // Section Appareils Détectés
                VStack(alignment: .leading, spacing: 10) {
                    Text("APPAREILS DÉTECTÉS (\(multipeerManager.discoveredPeers.count))")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.gray)

                    if multipeerManager.discoveredPeers.isEmpty {
                        VStack(spacing: 6) {
                            Image(systemName: "wifi.slash")
                                .font(.system(size: 20))
                                .foregroundColor(.gray)
                            Text(activeMode != nil ? "Recherche d'appareils réels à proximité..." : "Appuyez sur ENVOYER ou RECEVOIR.")
                                .font(.system(size: 11))
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity, minHeight: 80)
                        .background(Color(red: 0.04, green: 0.05, blue: 0.09))
                        .cornerRadius(14)
                    } else {
                        ForEach(multipeerManager.discoveredPeers) { peer in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(peer.name)
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundColor(.white)
                                    Text("Multipeer P2P Direct")
                                        .font(.system(size: 10))
                                        .foregroundColor(.gray)
                                }
                                Spacer()
                                Button("Connecter") {
                                    multipeerManager.invitePeer(peer)
                                }
                                .font(.system(size: 11, weight: .bold))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 6)
                                .background(Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                            }
                            .padding(12)
                            .background(Color(red: 0.06, green: 0.09, blue: 0.16))
                            .cornerRadius(14)
                        }
                    }
                }
                .padding(.horizontal)

                // Carte Transfert Actif
                if multipeerManager.isTransferring || multipeerManager.transferProgress > 0 {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(multipeerManager.currentFileName.isEmpty ? "Transfert en cours..." : multipeerManager.currentFileName)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                                .lineLimit(1)
                            Spacer()
                            Text("\(Int(multipeerManager.transferProgress * 100))%")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.blue)
                        }

                        ProgressView(value: multipeerManager.transferProgress)
                            .tint(.blue)

                        HStack {
                            if multipeerManager.currentTransferSpeedMBs > 0 {
                                Text(String(format: "%.2f Mo/s", multipeerManager.currentTransferSpeedMBs))
                                    .font(.system(size: 10))
                                    .foregroundColor(.cyan)
                            }
                            Spacer()
                            if multipeerManager.isSha256Verified {
                                Text("SHA-256 Validé")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.green)
                            }
                        }
                    }
                    .padding(12)
                    .background(Color(red: 0.08, green: 0.12, blue: 0.2))
                    .cornerRadius(14)
                    .padding(.horizontal)
                }

                // Historique des Transferts
                if !multipeerManager.transferHistory.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("HISTORIQUE DES FICHIERS")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.gray)

                        ScrollView {
                            VStack(spacing: 6) {
                                ForEach(multipeerManager.transferHistory) { record in
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(record.fileName)
                                                .font(.system(size: 12, weight: .semibold))
                                                .foregroundColor(.white)
                                                .lineLimit(1)
                                            Text("\(record.isReceived ? "Reçu" : "Envoyé") • \(record.fileSize / 1024) Ko")
                                                .font(.system(size: 10))
                                                .foregroundColor(.gray)
                                        }
                                        Spacer()
                                        Text(record.isSuccess ? "SHA-256 OK" : "Échec")
                                            .font(.system(size: 10, weight: .bold))
                                            .foregroundColor(record.isSuccess ? .green : .red)
                                    }
                                    .padding(10)
                                    .background(Color(red: 0.05, green: 0.07, blue: 0.13))
                                    .cornerRadius(10)
                                }
                            }
                        }
                        .frame(maxHeight: 130)
                    }
                    .padding(.horizontal)
                }

                Spacer()
            }
        }
        // Vrai sélecteur de fichiers natif iOS (SwiftUI fileImporter)
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [.item],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                if let url = urls.first {
                    multipeerManager.sendFile(at: url)
                }
            case .failure(let error):
                multipeerManager.errorMessage = "Sélection annulée : \(error.localizedDescription)"
            }
        }
        // Dialogue de confirmation explicite pour accepter/refuser la connexion
        .alert(
            "Demande de connexion",
            isPresented: Binding(
                get: { multipeerManager.pendingInvitation != nil },
                set: { if !$0 { multipeerManager.declinePendingInvitation() } }
            )
        ) {
            Button("Accepter", role: .none) {
                multipeerManager.acceptPendingInvitation()
            }
            Button("Refuser", role: .cancel) {
                multipeerManager.declinePendingInvitation()
            }
        } message: {
            if let pending = multipeerManager.pendingInvitation {
                Text("L'appareil '\(pending.peerName)' souhaite se connecter directement à votre iPhone.")
            }
        }
        // Feuille de transfert direct Android ↔ iPhone
        .sheet(isPresented: $showCrossPlatformSheet) {
            CrossPlatformView(manager: crossPlatformManager)
        }
    }
}

struct CrossPlatformView: View {
    @ObservedObject var manager: KaydoCrossPlatformManager
    @Environment(\.dismiss) var dismiss

    @State private var hostIp = "192.168.43.1"
    @State private var pinCode = "4829"
    @State private var showUploadPicker = false

    var body: some View {
        NavigationView {
            ZStack {
                Color(red: 0.04, green: 0.05, blue: 0.09).ignoresSafeArea()

                VStack(spacing: 16) {
                    Text("Connexion directe au point d'accès Android")
                        .font(.system(size: 13))
                        .foregroundColor(.gray)

                    HStack {
                        TextField("IP Hôte (ex: 192.168.43.1)", text: $hostIp)
                            .textFieldStyle(.roundedBorder)
                        TextField("Code PIN", text: $pinCode)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 90)
                    }
                    .padding(.horizontal)

                    Button("Se connecter au Hub local") {
                        manager.connectToHost(hostAddress: hostIp, pin: pinCode)
                    }
                    .buttonStyle(.borderedProminent)

                    if let err = manager.errorMessage {
                        Text(err).font(.system(size: 11)).foregroundColor(.red)
                    }
                    if let succ = manager.successMessage {
                        Text(succ).font(.system(size: 11)).foregroundColor(.green)
                    }

                    if manager.isConnected {
                        Text("Connecté au Hub Android")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.green)

                        Button("Envoyer un fichier vers Android") {
                            showUploadPicker = true
                        }
                        .buttonStyle(.bordered)

                        if !manager.availableRemoteFiles.isEmpty {
                            Text("Fichiers disponibles :")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.gray)

                            List(manager.availableRemoteFiles) { file in
                                HStack {
                                    VStack(alignment: .leading) {
                                        Text(file.name).font(.system(size: 12, weight: .bold))
                                        Text("\(file.size / 1024) Ko").font(.system(size: 10)).foregroundColor(.gray)
                                    }
                                    Spacer()
                                    Button("Télécharger") {
                                        manager.downloadFile(hostAddress: hostIp, file: file, pin: pinCode)
                                    }
                                    .font(.system(size: 11))
                                }
                            }
                        }
                    }

                    Spacer()
                }
                .padding(.top, 20)
            }
            .navigationTitle("Android ↔ iPhone")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fermer") { dismiss() }
                }
            }
            .fileImporter(
                isPresented: $showUploadPicker,
                allowedContentTypes: [.item],
                allowsMultipleSelection: false
            ) { res in
                if case .success(let urls) = res, let url = urls.first {
                    manager.uploadFile(hostAddress: hostIp, fileURL: url, pin: pinCode)
                }
            }
        }
    }
}
