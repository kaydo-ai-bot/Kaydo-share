package com.kaydo.share.transfer

import android.content.Context
import android.os.SystemClock
import android.util.Log
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import com.kaydo.share.protocol.FileManifest
import com.kaydo.share.protocol.KaydoMessageType
import com.kaydo.share.protocol.KaydoProtocol
import com.kaydo.share.util.StorageUtils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File
import java.io.FileInputStream
import java.util.UUID

data class DiscoveredEndpoint(
    val id: String,
    val name: String,
    val serviceId: String
)

data class PendingConnectionRequest(
    val endpointId: String,
    val endpointName: String,
    val authDigits: String
)

data class TransferHistoryItem(
    val id: String,
    val fileName: String,
    val fileSize: Long,
    val timestamp: Long,
    val isReceived: Boolean,
    val sha256: String,
    val isSuccess: Boolean
)

data class TransferState(
    val fileName: String = "",
    val totalBytes: Long = 0,
    val bytesTransferred: Long = 0,
    val speedMBs: Double = 0.0,
    val progress: Int = 0,
    val isComplete: Boolean = false,
    val error: String? = null,
    val isVerified: Boolean = false
)

class KaydoNearbyManager(private val context: Context) {

    private val TAG = "KaydoNearbyManager"
    private val SERVICE_ID = "com.kaydo.share.service"
    private val client = Nearby.getConnectionsClient(context)

    private val _discoveredPeers = MutableStateFlow<List<DiscoveredEndpoint>>(emptyList())
    val discoveredPeers: StateFlow<List<DiscoveredEndpoint>> = _discoveredPeers.asStateFlow()

    private val _connectedEndpoint = MutableStateFlow<DiscoveredEndpoint?>(null)
    val connectedEndpoint: StateFlow<DiscoveredEndpoint?> = _connectedEndpoint.asStateFlow()

    private val _pendingConnection = MutableStateFlow<PendingConnectionRequest?>(null)
    val pendingConnection: StateFlow<PendingConnectionRequest?> = _pendingConnection.asStateFlow()

    private val _transferProgress = MutableStateFlow(TransferState())
    val transferProgress: StateFlow<TransferState> = _transferProgress.asStateFlow()

    private val _transferHistory = MutableStateFlow<List<TransferHistoryItem>>(emptyList())
    val transferHistory: StateFlow<List<TransferHistoryItem>> = _transferHistory.asStateFlow()

    // Tracking for manifests and incoming files
    private val incomingManifests = mutableMapOf<String, FileManifest>()
    private val incomingPayloads = mutableMapOf<Long, Payload>()
    private val outgoingManifests = mutableMapOf<Long, FileManifest>()

    // Speed calculation
    private var lastBytesSample: Long = 0
    private var lastTimeSample: Long = 0

    fun startAdvertising(localDeviceName: String) {
        val advertisingOptions = AdvertisingOptions.Builder()
            .setStrategy(Strategy.P2P_STAR)
            .build()

        client.startAdvertising(
            localDeviceName,
            SERVICE_ID,
            connectionLifecycleCallback,
            advertisingOptions
        ).addOnSuccessListener {
            Log.d(TAG, "Émission Nearby démarrée sous le nom: $localDeviceName")
        }.addOnFailureListener { e ->
            Log.e(TAG, "Échec démarrage émission", e)
            _transferProgress.value = TransferState(error = "Impossible de démarrer l'émission: ${e.message}")
        }
    }

    fun startDiscovery() {
        val discoveryOptions = DiscoveryOptions.Builder()
            .setStrategy(Strategy.P2P_STAR)
            .build()

        _discoveredPeers.value = emptyList()

        client.startDiscovery(
            SERVICE_ID,
            endpointDiscoveryCallback,
            discoveryOptions
        ).addOnSuccessListener {
            Log.d(TAG, "Recherche Nearby démarrée")
        }.addOnFailureListener { e ->
            Log.e(TAG, "Échec démarrage recherche", e)
            _transferProgress.value = TransferState(error = "Impossible de lancer le radar: ${e.message}")
        }
    }

    fun requestConnection(endpoint: DiscoveredEndpoint, localDeviceName: String) {
        client.requestConnection(
            localDeviceName,
            endpoint.id,
            connectionLifecycleCallback
        ).addOnSuccessListener {
            Log.d(TAG, "Demande de connexion envoyée à ${endpoint.name}")
        }.addOnFailureListener { e ->
            Log.e(TAG, "Échec demande de connexion", e)
            _transferProgress.value = TransferState(error = "Erreur de connexion: ${e.message}")
        }
    }

    /**
     * L'utilisateur accepte explicitement la demande de connexion
     */
    fun acceptConnection(endpointId: String) {
        client.acceptConnection(endpointId, payloadCallback)
            .addOnSuccessListener {
                Log.d(TAG, "Connexion acceptée par l'utilisateur pour $endpointId")
                _pendingConnection.value = null
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Erreur lors de l'acceptation", e)
                _pendingConnection.value = null
            }
    }

    /**
     * L'utilisateur refuse la connexion
     */
    fun rejectConnection(endpointId: String) {
        client.rejectConnection(endpointId)
        _pendingConnection.value = null
    }

    /**
     * Envoi d'un fichier réel avec pré-manifeste et calcul SHA-256
     */
    fun sendFile(file: File, endpointId: String) {
        if (!file.exists() || file.length() == 0L) {
            _transferProgress.value = TransferState(error = "Fichier sélectionné introuvable ou vide")
            return
        }

        try {
            // 1. Calcul SHA-256 du fichier réel
            val fileHash = KaydoProtocol.calculateFileSha256(file)
            val fileId = UUID.randomUUID().toString()

            val manifest = FileManifest(
                fileId = fileId,
                fileName = file.name,
                fileSize = file.length(),
                mimeType = "application/octet-stream",
                expectedSha256 = fileHash,
                totalChunks = 1,
                chunkSize = file.length().toInt()
            )

            // 2. Envoi du manifeste sous forme de Payload.Type.BYTES
            val manifestBytes = KaydoProtocol.encodeManifestFrame(manifest)
            val manifestPayload = Payload.fromBytes(manifestBytes)
            client.sendPayload(endpointId, manifestPayload)

            // 3. Envoi du fichier réel sous forme de Payload.Type.FILE
            val filePayload = Payload.fromFile(file)
            outgoingManifests[filePayload.id] = manifest

            lastBytesSample = 0
            lastTimeSample = SystemClock.elapsedRealtime()

            _transferProgress.value = TransferState(
                fileName = file.name,
                totalBytes = file.length(),
                bytesTransferred = 0,
                progress = 0,
                isComplete = false
            )

            client.sendPayload(endpointId, filePayload).addOnSuccessListener {
                Log.d(TAG, "Envoi du fichier initié avec ID payload: ${filePayload.id}")
            }.addOnFailureListener { e ->
                Log.e(TAG, "Échec de l'envoi du fichier", e)
                _transferProgress.value = TransferState(error = "Échec d'envoi: ${e.message}")
            }

        } catch (e: Exception) {
            Log.e(TAG, "Erreur préparation transfert", e)
            _transferProgress.value = TransferState(error = "Erreur lecture fichier: ${e.message}")
        }
    }

    fun stopAll() {
        client.stopAdvertising()
        client.stopDiscovery()
        client.stopAllEndpoints()
        _discoveredPeers.value = emptyList()
        _connectedEndpoint.value = null
        _pendingConnection.value = null
        incomingManifests.clear()
        incomingPayloads.clear()
        outgoingManifests.clear()
    }

    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            // Pas d'acceptation automatique ! On demande l'accord explicite avec le code PIN
            val realRemoteName = if (info.endpointName.isNotBlank()) info.endpointName else "Appareil Inconnu"
            val pin = info.authenticationDigits ?: "0000"

            Log.d(TAG, "Demande entrante de '$realRemoteName' ($endpointId) avec PIN: $pin")
            _pendingConnection.value = PendingConnectionRequest(
                endpointId = endpointId,
                endpointName = realRemoteName,
                authDigits = pin
            )
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            if (result.status.isSuccess) {
                val peerName = _pendingConnection.value?.endpointName ?: "Appareil distant"
                _connectedEndpoint.value = DiscoveredEndpoint(endpointId, peerName, SERVICE_ID)
                _pendingConnection.value = null
                Log.d(TAG, "Connecté avec succès à $endpointId ($peerName)")
            } else {
                Log.w(TAG, "Connexion échouée ou refusée avec $endpointId")
                _connectedEndpoint.value = null
                _pendingConnection.value = null
            }
        }

        override fun onDisconnected(endpointId: String) {
            Log.d(TAG, "Déconnexion de $endpointId")
            if (_connectedEndpoint.value?.id == endpointId) {
                _connectedEndpoint.value = null
            }
        }
    }

    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            val peerName = if (info.endpointName.isNotBlank()) info.endpointName else "Appareil Inconnu"
            val endpoint = DiscoveredEndpoint(endpointId, peerName, info.serviceId)

            val current = _discoveredPeers.value.toMutableList()
            if (!current.any { it.id == endpointId }) {
                current.add(endpoint)
                _discoveredPeers.value = current
                Log.d(TAG, "Appareil détecté: $peerName ($endpointId)")
            }
        }

        override fun onEndpointLost(endpointId: String) {
            val current = _discoveredPeers.value.toMutableList()
            current.removeAll { it.id == endpointId }
            _discoveredPeers.value = current
            Log.d(TAG, "Appareil perdu: $endpointId")
        }
    }

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            when (payload.type) {
                Payload.Type.BYTES -> {
                    val bytes = payload.asBytes() ?: return
                    try {
                        val manifest = KaydoProtocol.decodeManifestFrame(bytes)
                        incomingManifests[endpointId] = manifest
                        Log.d(TAG, "Manifeste reçu pour fichier: ${manifest.fileName} (${manifest.fileSize} octets)")
                        _transferProgress.value = TransferState(
                            fileName = manifest.fileName,
                            totalBytes = manifest.fileSize,
                            bytesTransferred = 0,
                            progress = 0
                        )
                    } catch (e: Exception) {
                        Log.w(TAG, "Trame BYTES non-manifeste ou autre type de contrôle", e)
                    }
                }
                Payload.Type.FILE -> {
                    incomingPayloads[payload.id] = payload
                    Log.d(TAG, "Payload.Type.FILE entrant ID: ${payload.id}")
                }
                Payload.Type.STREAM -> {
                    Log.d(TAG, "Payload.Type.STREAM entrant")
                }
            }
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
            val total = update.totalBytes
            val transferred = update.bytesTransferred
            val now = SystemClock.elapsedRealtime()

            // Calcul de la vitesse réelle en Mo/s
            var speedMBs = 0.0
            if (lastTimeSample > 0 && now > lastTimeSample) {
                val deltaSec = (now - lastTimeSample) / 1000.0
                val deltaBytes = transferred - lastBytesSample
                if (deltaSec > 0 && deltaBytes > 0) {
                    speedMBs = (deltaBytes / deltaSec) / (1024.0 * 1024.0)
                }
            }
            lastBytesSample = transferred
            lastTimeSample = now

            val progress = if (total > 0) ((transferred * 100) / total).toInt().coerceIn(0, 100) else 0

            when (update.status) {
                PayloadTransferUpdate.Status.IN_PROGRESS -> {
                    _transferProgress.value = _transferProgress.value.copy(
                        totalBytes = total,
                        bytesTransferred = transferred,
                        speedMBs = speedMBs,
                        progress = progress,
                        isComplete = false
                    )
                }

                PayloadTransferUpdate.Status.SUCCESS -> {
                    val incomingPayload = incomingPayloads[update.payloadId]
                    if (incomingPayload != null && incomingPayload.type == Payload.Type.FILE) {
                        handleReceivedFilePayload(endpointId, incomingPayload, total)
                    } else {
                        // Envoi réussi côté émetteur
                        val manifest = outgoingManifests[update.payloadId]
                        if (manifest != null) {
                            addHistory(manifest.fileName, total, isReceived = false, manifest.expectedSha256, isSuccess = true)
                        }
                        _transferProgress.value = _transferProgress.value.copy(
                            bytesTransferred = total,
                            progress = 100,
                            isComplete = true,
                            isVerified = true
                        )
                    }
                }

                PayloadTransferUpdate.Status.FAILURE,
                PayloadTransferUpdate.Status.CANCELED -> {
                    Log.e(TAG, "Échec ou annulation du transfert payload ${update.payloadId}")
                    incomingPayloads.remove(update.payloadId)
                    _transferProgress.value = TransferState(
                        error = "Transfert interrompu ou annulé.",
                        isComplete = false
                    )
                }
            }
        }
    }

    private fun handleReceivedFilePayload(endpointId: String, payload: Payload, totalBytes: Long) {
        val manifest = incomingManifests[endpointId]
        val fileName = manifest?.fileName ?: "kaydo_share_${System.currentTimeMillis()}.bin"
        val expectedSha = manifest?.expectedSha256

        val filePayload = payload.asFile()
        if (filePayload == null) {
            _transferProgress.value = TransferState(error = "Payload de fichier manquant")
            return
        }

        try {
            val sourceFile = filePayload.asJavaFile()
            val inputStream = if (sourceFile != null && sourceFile.exists()) {
                FileInputStream(sourceFile)
            } else {
                val uri = filePayload.asUri()
                if (uri != null) {
                    context.contentResolver.openInputStream(uri)
                } else null
            }

            if (inputStream == null) {
                _transferProgress.value = TransferState(error = "Impossible d'accéder au flux du fichier reçu")
                return
            }

            // 1. Sauvegarde dans le stockage autorisé (Downloads/KaydoShare)
            val savedFile = StorageUtils.saveReceivedFile(context, inputStream, fileName)
            if (savedFile == null || !savedFile.exists()) {
                _transferProgress.value = TransferState(error = "Erreur lors de la sauvegarde dans le stockage local")
                return
            }

            // 2. VÉRIFICATION STRICTE SHA-256
            val actualSha256 = KaydoProtocol.calculateFileSha256(savedFile)

            if (expectedSha != null && !actualSha256.equals(expectedSha, ignoreCase = true)) {
                // CORRUPTION : Suppression immédiate du fichier corrompu
                savedFile.delete()
                Log.e(TAG, "ALERTE SÉCURITÉ: SHA-256 non conforme. Attendu: $expectedSha, Reçu: $actualSha256")
                addHistory(fileName, totalBytes, isReceived = true, actualSha256, isSuccess = false)
                _transferProgress.value = TransferState(
                    fileName = fileName,
                    error = "Échec de vérification SHA-256. Fichier altéré ou corrompu: supprimé par sécurité.",
                    isComplete = false,
                    isVerified = false
                )
                return
            }

            // SUCCÈS : Intégrité cryptographique confirmée
            Log.d(TAG, "Fichier reçu et validé avec succès: ${savedFile.absolutePath} (SHA-256: $actualSha256)")
            addHistory(fileName, totalBytes, isReceived = true, actualSha256, isSuccess = true)

            _transferProgress.value = TransferState(
                fileName = fileName,
                totalBytes = totalBytes,
                bytesTransferred = totalBytes,
                progress = 100,
                isComplete = true,
                isVerified = true
            )

        } catch (e: Exception) {
            Log.e(TAG, "Erreur lors du traitement final du fichier reçu", e)
            _transferProgress.value = TransferState(error = "Erreur finale: ${e.message}")
        } finally {
            incomingPayloads.remove(payload.id)
            incomingManifests.remove(endpointId)
        }
    }

    private fun addHistory(name: String, size: Long, isReceived: Boolean, sha: String, isSuccess: Boolean) {
        val item = TransferHistoryItem(
            id = UUID.randomUUID().toString(),
            fileName = name,
            fileSize = size,
            timestamp = System.currentTimeMillis(),
            isReceived = isReceived,
            sha256 = sha,
            isSuccess = isSuccess
        )
        val current = _transferHistory.value.toMutableList()
        current.add(0, item)
        _transferHistory.value = current
    }
}
