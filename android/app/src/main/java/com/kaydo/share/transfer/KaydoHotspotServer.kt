package com.kaydo.share.transfer

import android.content.Context
import android.util.Log
import com.kaydo.share.protocol.KaydoProtocol
import com.kaydo.share.util.StorageUtils
import fi.iki.elonen.NanoHTTPD
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.UUID

class KaydoHotspotServer(
    private val context: Context,
    port: Int = 52222,
    private val pinCode: String = "4829",
    private val filesToServe: Map<String, File>,
    private val onFileReceived: (File, Boolean) -> Unit
) : NanoHTTPD(port) {

    private val TAG = "KaydoHotspotServer"

    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri
        val method = session.method
        val headers = session.headers

        // Vérification de sécurité PIN pour toutes les opérations de transfert
        val clientPin = headers["x-kaydo-pin"] ?: session.parms["pin"] ?: ""
        val isPinValid = clientPin == pinCode

        // En-têtes CORS pour réseau local ad-hoc
        fun applyCors(response: Response): Response {
            response.addHeader("Access-Control-Allow-Origin", "*")
            response.addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            response.addHeader("Access-Control-Allow-Headers", "Content-Type, X-KAYDO-PIN, X-KAYDO-FILENAME, X-KAYDO-SHA256")
            return response
        }

        if (method == Method.OPTIONS) {
            return applyCors(newFixedLengthResponse(Response.Status.OK, MIME_PLAINTEXT, ""))
        }

        // Endpoint de vérification / Handshake local
        if (uri == "/api/handshake") {
            val responseObj = JSONObject()
            if (isPinValid) {
                responseObj.put("status", "authenticated")
                responseObj.put("serverName", "KAYDO-Direct-Hub")
                responseObj.put("version", "1.0")
                return applyCors(newFixedLengthResponse(Response.Status.OK, "application/json", responseObj.toString()))
            } else {
                responseObj.put("status", "unauthorized")
                responseObj.put("error", "Code PIN de sécurité invalide")
                return applyCors(newFixedLengthResponse(Response.Status.UNAUTHORIZED, "application/json", responseObj.toString()))
            }
        }

        // Liste des fichiers proposés au téléchargement
        if (uri == "/api/files") {
            if (!isPinValid) {
                return applyCors(newFixedLengthResponse(Response.Status.UNAUTHORIZED, MIME_PLAINTEXT, "Code PIN requis"))
            }

            val array = JSONArray()
            filesToServe.forEach { (id, file) ->
                if (file.exists()) {
                    val item = JSONObject()
                    item.put("id", id)
                    item.put("name", file.name)
                    item.put("size", file.length())
                    item.put("sha256", KaydoProtocol.calculateFileSha256(file))
                    array.put(item)
                }
            }
            return applyCors(newFixedLengthResponse(Response.Status.OK, "application/json", array.toString()))
        }

        // Téléchargement direct d'un fichier
        if (method == Method.GET && uri.startsWith("/api/download/")) {
            if (!isPinValid) {
                return applyCors(newFixedLengthResponse(Response.Status.UNAUTHORIZED, MIME_PLAINTEXT, "Code PIN requis"))
            }

            val fileId = uri.removePrefix("/api/download/")
            val file = filesToServe[fileId]
            if (file != null && file.exists()) {
                val sha = KaydoProtocol.calculateFileSha256(file)
                val fis = FileInputStream(file)
                val response = newChunkedResponse(Response.Status.OK, "application/octet-stream", fis)
                response.addHeader("Content-Disposition", "attachment; filename=\"${file.name}\"")
                response.addHeader("X-KAYDO-SHA256", sha)
                return applyCors(response)
            }
            return applyCors(newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Fichier non trouvé"))
        }

        // Dépôt / Réception de fichier depuis un autre appareil (ex: iPhone)
        if (method == Method.POST && uri == "/api/upload") {
            if (!isPinValid) {
                return applyCors(newFixedLengthResponse(Response.Status.UNAUTHORIZED, MIME_PLAINTEXT, "Code PIN de sécurité invalide"))
            }

            return try {
                val files = HashMap<String, String>()
                session.parseBody(files)

                val expectedSha = headers["x-kaydo-sha256"]?.lowercase() ?: ""
                val originalFileName = headers["x-kaydo-filename"] ?: "kaydo_ios_${System.currentTimeMillis()}.bin"

                val tempFilePath = files["file"]
                    ?: return applyCors(newFixedLengthResponse(Response.Status.BAD_REQUEST, MIME_PLAINTEXT, "Aucune donnée de fichier"))

                val tempFile = File(tempFilePath)
                if (!tempFile.exists() || tempFile.length() == 0L) {
                    return applyCors(newFixedLengthResponse(Response.Status.BAD_REQUEST, MIME_PLAINTEXT, "Fichier reçu vide"))
                }

                // VÉRIFICATION STRICTE DE L'INTÉGRITÉ SHA-256
                val actualSha = KaydoProtocol.calculateFileSha256(tempFile)
                if (expectedSha.isNotEmpty() && !actualSha.equals(expectedSha, ignoreCase = true)) {
                    tempFile.delete()
                    Log.e(TAG, "Rejet du fichier téléversé: SHA-256 invalide. Attendu: $expectedSha, Reçu: $actualSha")
                    return applyCors(newFixedLengthResponse(Response.Status.BAD_REQUEST, MIME_PLAINTEXT, "Erreur de validation cryptographique SHA-256: fichier rejeté."))
                }

                // Enregistrement dans le dossier Téléchargements public
                val savedFile = StorageUtils.saveReceivedFile(context, FileInputStream(tempFile), originalFileName)
                tempFile.delete()

                if (savedFile != null && savedFile.exists()) {
                    onFileReceived(savedFile, true)
                    val resultJson = JSONObject()
                    resultJson.put("status", "success")
                    resultJson.put("fileName", originalFileName)
                    resultJson.put("sha256", actualSha)
                    applyCors(newFixedLengthResponse(Response.Status.OK, "application/json", resultJson.toString()))
                } else {
                    applyCors(newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, "Erreur d'écriture sur le stockage"))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Erreur upload", e)
                applyCors(newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, "Erreur interne: ${e.message}"))
            }
        }

        // Page Web de secours locale accessible par navigateur depuis n'importe quel appareil connecté au hotspot
        val html = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>KAYDO SHARE Local</title>
                <style>
                    body { background: #07080F; color: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 30px; }
                    .card { background: #0F172A; border: 1px solid #1E293B; border-radius: 20px; padding: 24px; max-width: 450px; margin: 0 auto; }
                    h1 { color: #60A5FA; font-size: 24px; margin-bottom: 8px; }
                    .badge { background: #1E293B; color: #94A3B8; padding: 6px 12px; border-radius: 12px; font-size: 12px; display: inline-block; margin-bottom: 20px; }
                    .pin { font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #A78BFA; background: #131B2E; padding: 12px; border-radius: 12px; margin: 16px 0; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>KAYDO SHARE</h1>
                    <div class="badge">Point d'accès P2P 100% Hors-Ligne</div>
                    <p style="color:#94A3B8;font-size:13px;">Code de sécurité pour appairer l'appareil distant :</p>
                    <div class="pin">$pinCode</div>
                    <p style="color:#64748B;font-size:11px;">Aucune connexion Internet n'est requise ni utilisée.</p>
                </div>
            </body>
            </html>
        """.trimIndent()

        return applyCors(newFixedLengthResponse(Response.Status.OK, "text/html; charset=UTF-8", html))
    }
}
