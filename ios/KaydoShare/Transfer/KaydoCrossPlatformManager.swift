import Foundation
import Combine

public struct CrossPlatformFile: Identifiable, Decodable {
    public let id: String
    public let name: String
    public let size: Int64
    public let sha256: String
}

public class KaydoCrossPlatformManager: ObservableObject {

    @Published public var availableRemoteFiles: [CrossPlatformFile] = []
    @Published public var isConnecting: Bool = false
    @Published public var transferProgress: Double = 0.0
    @Published public var currentSpeedMBs: Double = 0.0
    @Published public var isConnected: Bool = false
    @Published public var errorMessage: String?
    @Published public var successMessage: String?

    public init() {}

    /**
     * Appairage local avec le point d'accès direct de l'autre appareil (Android ou autre)
     */
    public func connectToHost(hostAddress: String, port: Int = 52222, pin: String) {
        guard let url = URL(string: "http://\(hostAddress):\(port)/api/handshake") else {
            errorMessage = "Adresse IP ou URL invalide"
            return
        }

        isConnecting = true
        errorMessage = nil

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue(pin, forHTTPHeaderField: "X-KAYDO-PIN")
        request.timeoutInterval = 8

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.isConnecting = false
                if let error = error {
                    self?.errorMessage = "Impossible de joindre l'appareil distant : \(error.localizedDescription)"
                    self?.isConnected = false
                    return
                }

                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                    self?.isConnected = true
                    self?.fetchAvailableFiles(hostAddress: hostAddress, port: port, pin: pin)
                } else {
                    self?.errorMessage = "Code PIN incorrect ou connexion refusée"
                    self?.isConnected = false
                }
            }
        }.resume()
    }

    /**
     * Récupère la liste des fichiers partagés par l'hôte distant
     */
    public func fetchAvailableFiles(hostAddress: String, port: Int = 52222, pin: String) {
        guard let url = URL(string: "http://\(hostAddress):\(port)/api/files") else { return }

        var request = URLRequest(url: url)
        request.setValue(pin, forHTTPHeaderField: "X-KAYDO-PIN")

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let data = data, error == nil else { return }
            do {
                let files = try JSONDecoder().decode([CrossPlatformFile].self, from: data)
                DispatchQueue.main.async {
                    self?.availableRemoteFiles = files
                }
            } catch {
                DispatchQueue.main.async {
                    self?.errorMessage = "Erreur lecture fichiers : \(error.localizedDescription)"
                }
            }
        }.resume()
    }

    /**
     * Téléchargement direct d'un fichier avec validation cryptographique SHA-256
     */
    public func downloadFile(
        hostAddress: String,
        port: Int = 52222,
        file: CrossPlatformFile,
        pin: String
    ) {
        guard let url = URL(string: "http://\(hostAddress):\(port)/api/download/\(file.id)") else { return }

        var request = URLRequest(url: url)
        request.setValue(pin, forHTTPHeaderField: "X-KAYDO-PIN")

        self.transferProgress = 0.0
        self.errorMessage = nil

        let task = URLSession.shared.downloadTask(with: request) { [weak self] tempURL, response, error in
            if let error = error {
                DispatchQueue.main.async {
                    self?.errorMessage = "Erreur téléchargement : \(error.localizedDescription)"
                }
                return
            }

            guard let tempURL = tempURL else { return }

            let fileManager = FileManager.default
            let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let dest = docs.appendingPathComponent(file.name)

            do {
                if fileManager.fileExists(atPath: dest.path) {
                    try fileManager.removeItem(at: dest)
                }
                try fileManager.moveItem(at: tempURL, to: dest)

                // VÉRIFICATION STRICTE DU SHA-256
                let actualSha = try KaydoProtocol.calculateFileSha256(at: dest)
                if !actualSha.caseInsensitiveCompare(file.sha256).rawValue == 0 {
                    try? fileManager.removeItem(at: dest)
                    DispatchQueue.main.async {
                        self?.errorMessage = "Corruption détectée ! Le hash SHA-256 ne correspond pas. Fichier supprimé."
                    }
                    return
                }

                DispatchQueue.main.async {
                    self?.transferProgress = 1.0
                    self?.successMessage = "Fichier '\(file.name)' reçu et validé avec succès (SHA-256 OK)"
                }
            } catch {
                DispatchQueue.main.async {
                    self?.errorMessage = "Erreur enregistrement : \(error.localizedDescription)"
                }
            }
        }
        task.resume()
    }

    /**
     * Téléversement direct depuis l'iPhone vers le serveur Android local
     */
    public func uploadFile(
        hostAddress: String,
        port: Int = 52222,
        fileURL: URL,
        pin: String
    ) {
        guard let url = URL(string: "http://\(hostAddress):\(port)/api/upload") else { return }

        let isAccessing = fileURL.startAccessingSecurityScopedResource()
        defer {
            if isAccessing { fileURL.stopAccessingSecurityScopedResource() }
        }

        do {
            let fileData = try Data(contentsOf: fileURL)
            let sha256 = try KaydoProtocol.calculateFileSha256(at: fileURL)
            let fileName = fileURL.lastPathComponent

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue(pin, forHTTPHeaderField: "X-KAYDO-PIN")
            request.setValue(fileName, forHTTPHeaderField: "X-KAYDO-FILENAME")
            request.setValue(sha256, forHTTPHeaderField: "X-KAYDO-SHA256")

            let boundary = "Boundary-\(UUID().uuidString)"
            request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

            var body = Data()
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: application/octet-stream\r\n\r\n".data(using: .utf8)!)
            body.append(fileData)
            body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

            request.httpBody = body

            URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
                DispatchQueue.main.async {
                    if let error = error {
                        self?.errorMessage = "Échec du téléversement : \(error.localizedDescription)"
                    } else if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                        self?.successMessage = "Fichier '\(fileName)' transféré et validé par l'appareil distant"
                    } else {
                        self?.errorMessage = "Erreur de rejet par l'appareil distant"
                    }
                }
            }.resume()

        } catch {
            errorMessage = "Erreur de lecture du fichier : \(error.localizedDescription)"
        }
    }
}
