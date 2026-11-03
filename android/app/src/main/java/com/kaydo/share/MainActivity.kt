package com.kaydo.share

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.kaydo.share.transfer.DiscoveredEndpoint
import com.kaydo.share.transfer.KaydoNearbyManager
import com.kaydo.share.transfer.PendingConnectionRequest
import com.kaydo.share.transfer.TransferHistoryItem
import com.kaydo.share.transfer.TransferState
import java.io.File
import java.io.FileOutputStream

class MainActivity : ComponentActivity() {

    private lateinit var nearbyManager: KaydoNearbyManager

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.entries.all { it.value }
        if (!allGranted) {
            Toast.makeText(
                this,
                "Certaines permissions sont requises pour le transfert hors-ligne direct",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        nearbyManager = KaydoNearbyManager(this)
        checkAndRequestPermissions()

        val deviceName = "KAYDO-${Build.MANUFACTURER.uppercase()}-${Build.MODEL.replace(" ", "-")}"

        setContent {
            KaydoShareScreen(
                nearbyManager = nearbyManager,
                localDeviceName = deviceName,
                onSelectFilesAndSend = { endpointId ->
                    // Launcher handled inside Composable
                },
                resolveUriToFile = { uri -> copyUriToCacheFile(this, uri) }
            )
        }
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.NEARBY_WIFI_DEVICES)
            permissions.add(Manifest.permission.READ_MEDIA_IMAGES)
            permissions.add(Manifest.permission.READ_MEDIA_VIDEO)
            permissions.add(Manifest.permission.READ_MEDIA_AUDIO)
        } else {
            permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            permissions.add(Manifest.permission.BLUETOOTH_SCAN)
            permissions.add(Manifest.permission.BLUETOOTH_ADVERTISE)
            permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
        }

        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        nearbyManager.stopAll()
    }

    companion object {
        fun copyUriToCacheFile(context: Context, uri: Uri): File? {
            return try {
                var fileName = "file_${System.currentTimeMillis()}"
                context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                    val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (nameIndex != -1 && cursor.moveToFirst()) {
                        fileName = cursor.getString(nameIndex)
                    }
                }

                val cacheFile = File(context.cacheDir, fileName)
                context.contentResolver.openInputStream(uri)?.use { input ->
                    FileOutputStream(cacheFile).use { output ->
                        val buffer = ByteArray(65536)
                        var read: Int
                        while (input.read(buffer).also { read = it } != -1) {
                            output.write(buffer, 0, read)
                        }
                        output.flush()
                    }
                }
                cacheFile
            } catch (e: Exception) {
                null
            }
        }
    }
}

@Composable
fun KaydoShareScreen(
    nearbyManager: KaydoNearbyManager,
    localDeviceName: String,
    onSelectFilesAndSend: (String) -> Unit,
    resolveUriToFile: (Uri) -> File?
) {
    val peers by nearbyManager.discoveredPeers.collectAsState()
    val connectedEndpoint by nearbyManager.connectedEndpoint.collectAsState()
    val pendingConnection by nearbyManager.pendingConnection.collectAsState()
    val transferState by nearbyManager.transferProgress.collectAsState()
    val history by nearbyManager.transferHistory.collectAsState()

    var activeMode by remember { mutableStateOf<String?>(null) }
    var selectedFilesToSend by remember { mutableStateOf<List<File>>(emptyList()) }

    // Véritable sélecteur de fichiers Android natif (Documents, Images, Vidéos, Audios, etc.)
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenMultipleDocuments()
    ) { uris ->
        if (uris.isNotEmpty()) {
            val resolved = uris.mapNotNull { resolveUriToFile(it) }
            selectedFilesToSend = resolved
            activeMode = "send"
            nearbyManager.startAdvertising(localDeviceName)

            // Si déjà connecté, envoyer immédiatement
            connectedEndpoint?.let { endpoint ->
                resolved.forEach { file ->
                    nearbyManager.sendFile(file, endpoint.id)
                }
            }
        }
    }

    // Dialogue d'accord explicite avec code de sécurité (PIN)
    pendingConnection?.let { pending ->
        AlertDialog(
            onDismissRequest = { nearbyManager.rejectConnection(pending.endpointId) },
            containerColor = Color(0xFF0F172A),
            title = {
                Text(
                    text = "Demande de connexion",
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(spacing = 10.dp) {
                    Text(
                        text = "L'appareil '${pending.endpointName}' souhaite établir une connexion directe.",
                        color = Color(0xFF94A3B8),
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Vérifiez que le code de sécurité affiché sur les deux téléphones est identique :",
                        color = Color(0xFFCBD5E1),
                        fontSize = 12.sp
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF1E293B), RoundedCornerShape(12.dp))
                            .padding(12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = pending.authDigits,
                            color = Color(0xFF60A5FA),
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 4.sp
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { nearbyManager.acceptConnection(pending.endpointId) },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                ) {
                    Text("Accepter")
                }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = { nearbyManager.rejectConnection(pending.endpointId) },
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFEF4444))
                ) {
                    Text("Refuser")
                }
            }
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF07080F))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(16.dp))

        // Branding
        Text(
            text = "KAYDO SHARE",
            fontSize = 26.sp,
            fontWeight = FontWeight.Black,
            color = Color(0xFF60A5FA)
        )
        Text(
            text = "Partage direct P2P 100% Hors-ligne",
            fontSize = 12.sp,
            color = Color(0xFF94A3B8)
        )
        Text(
            text = "Appareil local: $localDeviceName",
            fontSize = 11.sp,
            color = Color(0xFF64748B)
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Deux Grandes Actions : ENVOYER & RECEVOIR
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // ENVOYER : Ouvre le vrai sélecteur de fichiers
            Card(
                modifier = Modifier
                    .weight(1f)
                    .height(115.dp)
                    .clickable {
                        filePickerLauncher.launch(arrayOf("*/*"))
                    },
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A))
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(12.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("ENVOYER", color = Color(0xFF60A5FA), fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = if (selectedFilesToSend.isNotEmpty()) "${selectedFilesToSend.size} fichier(s) prêt(s)" else "Sélectionner fichiers",
                        color = Color(0xFF94A3B8),
                        fontSize = 11.sp
                    )
                }
            }

            // RECEVOIR : Active le mode découverte Nearby
            Card(
                modifier = Modifier
                    .weight(1f)
                    .height(115.dp)
                    .clickable {
                        activeMode = "receive"
                        nearbyManager.startDiscovery()
                    },
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A))
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(12.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("RECEVOIR", color = Color(0xFFA78BFA), fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Mode Radar", color = Color(0xFF94A3B8), fontSize = 11.sp)
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // État de connexion actuel
        connectedEndpoint?.let { connected ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("Connecté à", color = Color(0xFF94A3B8), fontSize = 11.sp)
                        Text(connected.name, color = Color(0xFF10B981), fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                    if (selectedFilesToSend.isNotEmpty()) {
                        Button(
                            onClick = {
                                selectedFilesToSend.forEach { file ->
                                    nearbyManager.sendFile(file, connected.id)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                        ) {
                            Text("Transférer (${selectedFilesToSend.size})", fontSize = 12.sp)
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        // Section Appareils Détectés
        Text(
            text = "APPAREILS DÉTECTÉS (${peers.size})",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF64748B),
            modifier = Modifier.align(Alignment.Start)
        )

        Spacer(modifier = Modifier.height(8.dp))

        if (peers.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(90.dp)
                    .background(Color(0xFF090D16), RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (activeMode != null) "Recherche d'appareils réels à proximité..." else "Appuyez sur ENVOYER ou RECEVOIR.",
                    color = Color(0xFF64748B),
                    fontSize = 12.sp
                )
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                peers.forEach { peer ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF0F172A), RoundedCornerShape(14.dp))
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = peer.name,
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text("Nearby Direct P2P", color = Color(0xFF64748B), fontSize = 11.sp)
                        }
                        Button(
                            onClick = { nearbyManager.requestConnection(peer, localDeviceName) },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                        ) {
                            Text("Connecter", fontSize = 11.sp)
                        }
                    }
                }
            }
        }

        // Carte Progression du Transfert
        if (transferState.totalBytes > 0 || transferState.error != null) {
            Spacer(modifier = Modifier.height(16.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF131B2E))
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = if (transferState.isComplete) "Transfert terminé !" else "Transfert en cours...",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )

                    if (transferState.fileName.isNotBlank()) {
                        Text(
                            text = transferState.fileName,
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    LinearProgressIndicator(
                        progress = transferState.progress / 100f,
                        modifier = Modifier.fillMaxWidth(),
                        color = if (transferState.isComplete) Color(0xFF10B981) else Color(0xFF60A5FA)
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("${transferState.progress}%", color = Color(0xFF94A3B8), fontSize = 11.sp)
                        if (transferState.speedMBs > 0.0) {
                            Text(
                                "%.2f Mo/s".format(transferState.speedMBs),
                                color = Color(0xFF60A5FA),
                                fontSize = 11.sp
                            )
                        }
                        if (transferState.isVerified) {
                            Text("SHA-256 Validé", color = Color(0xFF10B981), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    transferState.error?.let { err ->
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(err, color = Color(0xFFEF4444), fontSize = 11.sp)
                    }
                }
            }
        }

        // Historique des transferts
        if (history.isNotEmpty()) {
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "HISTORIQUE RÉCENT",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF64748B),
                modifier = Modifier.align(Alignment.Start)
            )
            Spacer(modifier = Modifier.height(6.dp))
            LazyColumn(
                modifier = Modifier.fillMaxWidth().weight(1f),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                items(history) { item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF0F172A), RoundedCornerShape(12.dp))
                            .padding(10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = item.fileName,
                                color = Color.White,
                                fontSize = 12.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = "${if (item.isReceived) "Reçu" else "Envoyé"} • ${item.fileSize / 1024} Ko",
                                color = Color(0xFF64748B),
                                fontSize = 10.sp
                            )
                        }
                        Text(
                            text = if (item.isSuccess) "SHA-256 OK" else "Échec",
                            color = if (item.isSuccess) Color(0xFF10B981) else Color(0xFFEF4444),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}
