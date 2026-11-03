package com.kaydo.share.transfer

import fi.iki.elonen.NanoHTTPD
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.MessageDigest

class KaydoHotspotServer(
    port: Int = 52222,
    private val filesToServe: Map<String, File>,
    private val downloadFolder: File,
    private val onFileReceived: (File, Boolean) -> Unit
) : NanoHTTPD(port) {

    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri
        val method = session.method

        if (method == Method.GET && uri.startsWith("/download/")) {
            val fileId = uri.removePrefix("/download/")
            val file = filesToServe[fileId]
            if (file != null && file.exists()) {
                val fis = FileInputStream(file)
                val response = newChunkedResponse(Response.Status.OK, "application/octet-stream", fis)
                response.addHeader("Content-Disposition", "attachment; filename=\"${file.name}\"")
                response.addHeader("X-KAYDO-SHA256", calculateSha256(file))
                return response
            }
            return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Fichier introuvable")
        }

        if (method == Method.POST && uri == "/upload") {
            try {
                val files = HashMap<String, String>()
                session.parseBody(files)
                val expectedHash = session.headers["x-kaydo-sha256"] ?: ""
                val fileName = session.headers["x-kaydo-filename"] ?: "received_${System.currentTimeMillis()}.bin"

                val tempFilePath = files["file"] ?: return newFixedLengthResponse(Response.Status.BAD_REQUEST, MIME_PLAINTEXT, "Fichier manquant")
                val tempFile = File(tempFilePath)

                val calculatedHash = calculateSha256(tempFile)
                val isValid = expectedHash.isEmpty() || calculatedHash.equals(expectedHash, ignoreCase = true)

                if (!isValid) {
                    tempFile.delete()
                    return newFixedLengthResponse(Response.Status.BAD_REQUEST, MIME_PLAINTEXT, "Échec de validation SHA-256. Fichier rejeté.")
                }

                val destFile = File(downloadFolder, fileName)
                tempFile.copyTo(destFile, overwrite = true)
                tempFile.delete()

                onFileReceived(destFile, true)
                return newFixedLengthResponse(Response.Status.OK, MIME_PLAINTEXT, "Fichier validé et reçu avec succès")
            } catch (e: Exception) {
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, e.message)
            }
        }

        return newFixedLengthResponse(
            Response.Status.OK,
            "text/html; charset=UTF-8",
            "<html><body style='background:#07080f;color:#fff;font-family:sans-serif;text-align:center;padding:50px;'>" +
                    "<h1>KAYDO SHARE Local Direct Hub</h1>" +
                    "<p>Serveur local hors-ligne sécurisé actif.</p></body></html>"
        )
    }

    private fun calculateSha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { fis ->
            val buffer = ByteArray(65536)
            var n: Int
            while (fis.read(buffer).also { n = it } != -1) {
                digest.update(buffer, 0, n)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
