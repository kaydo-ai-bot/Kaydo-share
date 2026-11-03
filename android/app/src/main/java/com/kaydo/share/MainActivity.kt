package com.kaydo.share

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.kaydo.share.transfer.KaydoNearbyManager

class MainActivity : ComponentActivity() {

    private lateinit var nearbyManager: KaydoNearbyManager

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.entries.all { it.value }
        if (!allGranted) {
            Toast.makeText(this, "Permissions requises pour le partage hors-ligne", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        nearbyManager = KaydoNearbyManager(this)
        checkAndRequestPermissions()

        setContent {
            KaydoShareScreen(
                nearbyManager = nearbyManager,
                onSendClicked = {
                    nearbyManager.startAdvertising("KAYDO-Android-${(100..999).random()}")
                },
                onReceiveClicked = {
                    nearbyManager.startDiscovery()
                }
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
}

@Composable
fun KaydoShareScreen(
    nearbyManager: KaydoNearbyManager,
    onSendClicked: () -> Unit,
    onReceiveClicked: () -> Unit
) {
    val peers by nearbyManager.discoveredPeers.collectAsState()
    val connectedEndpoint by nearbyManager.connectedEndpoint.collectAsState()
    val transferState by nearbyManager.transferProgress.collectAsState()

    var activeMode by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF07080F))
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Brand Header
        Spacer(modifier = Modifier.height(30.dp))
        Text(
            text = "KAYDO SHARE",
            fontSize = 28.sp,
            fontWeight = FontWeight.Black,
            color = Color(0xFF60A5FA)
        )
        Text(
            text = "Partage direct P2P 100% Hors-ligne (Android & iOS)",
            fontSize = 12.sp,
            color = Color(0xFF94A3B8)
        )

        Spacer(modifier = Modifier.height(40.dp))

        // Two Main Action Cards: ENVOYER & RECEVOIR
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // ENVOYER
            Card(
                modifier = Modifier
                    .weight(1f)
                    .height(140.dp)
                    .clickable {
                        activeMode = "send"
                        onSendClicked()
                    },
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A))
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(16.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("ENVOYER", color = Color(0xFF60A5FA), fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Mode Émetteur", color = Color(0xFF94A3B8), fontSize = 11.sp)
                }
            }

            // RECEVOIR
            Card(
                modifier = Modifier
                    .weight(1f)
                    .height(140.dp)
                    .clickable {
                        activeMode = "receive"
                        onReceiveClicked()
                    },
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A))
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(16.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("RECEVOIR", color = Color(0xFFA78BFA), fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Mode Radar", color = Color(0xFF94A3B8), fontSize = 11.sp)
                }
            }
        }

        Spacer(modifier = Modifier.height(30.dp))

        // Discovered Devices Section (Real, zero mock)
        Text(
            text = "APPAREILS DÉTECTÉS (${peers.size})",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF64748B),
            modifier = Modifier.align(Alignment.Start)
        )

        Spacer(modifier = Modifier.height(12.dp))

        if (peers.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp)
                    .background(Color(0xFF090D16), RoundedCornerShape(20.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (activeMode != null) "Recherche d'appareils réels à proximité..." else "Appuyez sur ENVOYER ou RECEVOIR pour démarrer.",
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
                            .background(Color(0xFF0F172A), RoundedCornerShape(16.dp))
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(peer.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text("ID: ${peer.id}", color = Color(0xFF64748B), fontSize = 11.sp)
                        }
                        Button(
                            onClick = { nearbyManager.connectToEndpoint(peer.id, "KAYDO-Android") },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                        ) {
                            Text("Connecter", fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        // Active Transfer Banner
        if (transferState.totalBytes > 0) {
            Spacer(modifier = Modifier.height(24.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Transfert en cours...", color = Color.White, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = transferState.progress / 100f,
                        modifier = Modifier.fillMaxWidth(),
                        color = Color(0xFF60A5FA)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("${transferState.progress}% transféré - SHA-256 actif", color = Color(0xFF94A3B8), fontSize = 11.sp)
                }
            }
        }
    }
}
