package com.kaydo.share.transfer

import android.content.Context
import android.util.Log
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import com.kaydo.share.protocol.KaydoProtocol
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File
import java.io.InputStream

data class DiscoveredEndpoint(
    val id: String,
    val name: String,
    val serviceId: String
)

data class TransferState(
    val fileName: String = "",
    val totalBytes: Long = 0,
    val bytesTransferred: Long = 0,
    val speedMBs: Double = 0.0,
    val progress: Int = 0,
    val isComplete: Boolean = false,
    val error: String? = null
)

class KaydoNearbyManager(private val context: Context) {

    private val SERVICE_ID = "com.kaydo.share.service"
    private val client = Nearby.getConnectionsClient(context)

    val discoveredPeers = MutableStateFlow<List<DiscoveredEndpoint>>(emptyList())
    val transferProgress = MutableStateFlow(TransferState())
    val connectedEndpoint = MutableStateFlow<DiscoveredEndpoint?>(null)

    private val incomingFiles = mutableMapOf<Long, File>()

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
            Log.d("KaydoNearby", "Advertising démarré avec succès")
        }.addOnFailureListener { e ->
            Log.e("KaydoNearby", "Échec de démarrage de l'advertising", e)
        }
    }

    fun startDiscovery() {
        val discoveryOptions = DiscoveryOptions.Builder()
            .setStrategy(Strategy.P2P_STAR)
            .build()

        client.startDiscovery(
            SERVICE_ID,
            endpointDiscoveryCallback,
            discoveryOptions
        ).addOnSuccessListener {
            Log.d("KaydoNearby", "Découverte démarrée avec succès")
        }.addOnFailureListener { e ->
            Log.e("KaydoNearby", "Échec de démarrage de la découverte", e)
        }
    }

    fun connectToEndpoint(endpointId: String, localDeviceName: String) {
        client.requestConnection(
            localDeviceName,
            endpointId,
            connectionLifecycleCallback
        )
    }

    fun sendFile(file: File, endpointId: String) {
        val payload = Payload.fromFile(file)
        client.sendPayload(endpointId, payload)
    }

    fun stopAll() {
        client.stopAdvertising()
        client.stopDiscovery()
        client.stopAllEndpoints()
        discoveredPeers.value = emptyList()
        connectedEndpoint.value = null
    }

    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            // Auto accept or show PIN to user
            client.acceptConnection(endpointId, payloadCallback)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            if (result.status.isSuccess) {
                connectedEndpoint.value = DiscoveredEndpoint(endpointId, "Appareil distant", SERVICE_ID)
            } else {
                connectedEndpoint.value = null
            }
        }

        override fun onDisconnected(endpointId: String) {
            connectedEndpoint.value = null
        }
    }

    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            val endpoint = DiscoveredEndpoint(endpointId, info.endpointName, info.serviceId)
            val current = discoveredPeers.value.toMutableList()
            if (!current.any { it.id == endpointId }) {
                current.add(endpoint)
                discoveredPeers.value = current
            }
        }

        override fun onEndpointLost(endpointId: String) {
            val current = discoveredPeers.value.toMutableList()
            current.removeAll { it.id == endpointId }
            discoveredPeers.value = current
        }
    }

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            if (payload.type == Payload.Type.FILE) {
                payload.asFile()?.let { filePayload ->
                    // File incoming
                }
            }
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
            val total = update.totalBytes
            val transferred = update.bytesTransferred
            val progress = if (total > 0) ((transferred * 100) / total).toInt() else 0

            transferProgress.value = TransferState(
                totalBytes = total,
                bytesTransferred = transferred,
                progress = progress,
                isComplete = update.status == PayloadTransferUpdate.Status.SUCCESS
            )
        }
    }
}
