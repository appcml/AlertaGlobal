package com.alertaglobal.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.alertaglobal.MainActivity
import com.alertaglobal.R

/**
 * CellBroadcastReceiver — Intercepta alertas SAE de SENAPRED/SUBTEL
 *
 * Recibe mensajes Cell Broadcast directamente de las torres celulares
 * sin necesitar internet — igual que el sistema SAE oficial de Chile.
 *
 * Canales SAE Chile:
 * - 4370: ETWS (Earthquake and Tsunami Warning System)
 * - 4371: ETWS Tsunami
 * - 4372-4399: Alertas nacionales SENAPRED
 * - 50000: CMAS Presidential Alerts
 */
class CellBroadcastReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return

        // Extraer mensaje del Cell Broadcast
        val message = extractMessage(intent) ?: return

        android.util.Log.d("AlertaGlobal-SAE", "Cell Broadcast recibido: $message")

        // Crear notificación de máxima prioridad
        showEmergencyNotification(context, message)
    }

    private fun extractMessage(intent: Intent): String? {
        return try {
            // Android 8+: PDUs en formato nuevo
            val pdus = intent.getSerializableExtra("pdus") as? Array<*>
            if (pdus != null && pdus.isNotEmpty()) {
                // Extraer texto del PDU
                pdus.mapNotNull { it as? ByteArray }
                    .joinToString(" ") { String(it).trim() }
                    .takeIf { it.isNotBlank() }
            } else {
                // Fallback: mensaje directo
                intent.getStringExtra("message")
            }
        } catch (e: Exception) {
            android.util.Log.e("AlertaGlobal-SAE", "Error extrayendo mensaje: ${e.message}")
            null
        }
    }

    private fun showEmergencyNotification(context: Context, message: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Crear canal de emergencia (Android 8+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "SAE_EMERGENCIA",
                "Alertas SAE - SENAPRED",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Alertas de emergencia del Sistema SAE"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 1000)
                enableLights(true)
                lightColor = android.graphics.Color.RED
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            }
            nm.createNotificationChannel(channel)
        }

        val openApp = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(context, "SAE_EMERGENCIA")
            .setSmallIcon(R.drawable.ic_alert)
            .setContentTitle("🚨 ALERTA SAE - SENAPRED")
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)
            .setOngoing(true) // No se puede descartar
            .setVibrate(longArrayOf(0, 500, 200, 500, 200, 1000))
            .setContentIntent(openApp)
            .build()

        nm.notify(911, notification)

        // Vibrar el dispositivo
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = context.getSystemService(android.os.VibratorManager::class.java)
            vm?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? android.os.Vibrator
        }
        vibrator?.vibrate(
            android.os.VibrationEffect.createWaveform(
                longArrayOf(0, 500, 200, 500, 200, 1000), -1
            )
        )
    }
}
