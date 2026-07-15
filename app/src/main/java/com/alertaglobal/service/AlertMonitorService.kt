package com.alertaglobal.service

import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.alertaglobal.MainActivity
import com.alertaglobal.R
import com.alertaglobal.data.api.RetrofitClient
import kotlinx.coroutines.*

class AlertMonitorService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var monitoringJob: Job? = null

    companion object {
        private const val NOTIFICATION_ID = 9999
        private const val CHECK_INTERVAL = 5 * 60 * 1000L // 5 minutos

        fun start(context: Context) {
            val intent = Intent(context, AlertMonitorService::class.java)
            context.startForegroundService(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, createForegroundNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startMonitoring()
        return START_STICKY
    }

    private fun startMonitoring() {
        monitoringJob = serviceScope.launch {
            while (isActive) {
                checkForNewAlerts()
                delay(CHECK_INTERVAL)
            }
        }
    }

    private suspend fun checkForNewAlerts() {
        try {
            val earthquakes = RetrofitClient.usgsApi.getRecentEarthquakes()
            val critical = earthquakes.features.filter { it.properties.mag >= 6.0 }

            critical.forEach { eq ->
                sendAlertNotification(
                    "\uD83D\uDEA8 SISMO CRÍTICO",
                    "Magnitud ${eq.properties.mag} en ${eq.properties.place}",
                    eq.id.hashCode()
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun sendAlertNotification(title: String, message: String, notificationId: Int) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, "alertas_criticas")
            .setSmallIcon(R.drawable.ic_alert)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, notification)
    }

    private fun createForegroundNotification() = NotificationCompat.Builder(this, "notificaciones_generales")
        .setSmallIcon(R.drawable.ic_alert)
        .setContentTitle("Alerta Global")
        .setContentText("Monitoreando alertas en tiempo real...")
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        monitoringJob?.cancel()
        serviceScope.cancel()
        super.onDestroy()
    }
}
