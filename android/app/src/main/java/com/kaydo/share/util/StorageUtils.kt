package com.kaydo.share.util

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream

object StorageUtils {

    private const val TAG = "KaydoStorage"

    /**
     * Enregistre un flux de fichier reçu dans le stockage public autorisé (Dossier Téléchargements / KaydoShare)
     * Compatible Android 10+ (API 29+) avec MediaStore Scoped Storage,
     * et versions antérieures avec Environment.DIRECTORY_DOWNLOADS.
     */
    fun saveReceivedFile(
        context: Context,
        inputStream: InputStream,
        fileName: String,
        mimeType: String = "application/octet-stream"
    ): File? {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val resolver = context.contentResolver
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                    put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                    put(MediaStore.MediaColumns.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/KaydoShare")
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }

                val collectionUri = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                val itemUri: Uri = resolver.insert(collectionUri, contentValues)
                    ?: throw IllegalStateException("Impossible de créer l'entrée MediaStore pour $fileName")

                resolver.openOutputStream(itemUri)?.use { out ->
                    copyStream(inputStream, out)
                }

                contentValues.clear()
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                resolver.update(itemUri, contentValues, null, null)

                // Obtenir le chemin de fichier réel ou miroir dans le cache pour vérification SHA-256
                val verifiedCacheFile = File(context.cacheDir, "verified_$fileName")
                resolver.openInputStream(itemUri)?.use { verifiedIn ->
                    FileOutputStream(verifiedCacheFile).use { verifiedOut ->
                        copyStream(verifiedIn, verifiedOut)
                    }
                }
                verifiedCacheFile
            } else {
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val kaydoDir = File(downloadsDir, "KaydoShare")
                if (!kaydoDir.exists()) {
                    kaydoDir.mkdirs()
                }

                val destinationFile = File(kaydoDir, fileName)
                FileOutputStream(destinationFile).use { out ->
                    copyStream(inputStream, out)
                }
                destinationFile
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erreur lors de la sauvegarde du fichier: ${e.message}", e)
            null
        }
    }

    /**
     * Copie un fichier existant vers le stockage public de destination
     */
    fun saveFileToPublicDownloads(context: Context, sourceFile: File, fileName: String): File? {
        return FileInputStream(sourceFile).use { input ->
            saveReceivedFile(context, input, fileName)
        }
    }

    private fun copyStream(from: InputStream, to: OutputStream) {
        val buffer = ByteArray(65536)
        var bytesRead: Int
        while (from.read(buffer).also { bytesRead = it } != -1) {
            to.write(buffer, 0, bytesRead)
        }
        to.flush()
    }
}
