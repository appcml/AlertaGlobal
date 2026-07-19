package com.alertaglobal.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.alertaglobal.MainActivity
import com.alertaglobal.R
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.URL

class AlertMonitorService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var job: Job? = null
    private val seenAlerts = mutableSetOf<String>()

    companion object {
        const val CHANNEL_GENERAL = "alertas_monitor"
        const val CHANNEL_CRITICAL = "alertas_criticas"
        const val CHECK_INTERVAL_MS = 120_000L // 2 minutos

        fun start(ctx: Context) {
            val intent = Intent(ctx, AlertMonitorService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        startForeground(9999, buildMonitorNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        job = scope.launch {
            while (isActive) {
                try {
                    checkEarthquakes()
                    checkVolcanoes()
                } catch (e: Exception) {
                    android.util.Log.e("AlertaGlobal", "Monitor error: ${e.message}")
                }
                delay(CHECK_INTERVAL_MS)
            }
        }
        return START_STICKY
    }

    private suspend fun checkEarthquakes() {
        val url = "https://earthquake.usgs.gov/fdsnws/event/1/query" +
            "?format=geojson&limit=10&minmagnitude=5.0&orderby=time"
        val json = URL(url).readText()
        val features = JSONObject(json).getJSONArray("features")

        for (i in 0 until features.length()) {
            val feature = features.getJSONObject(i)
            val props = feature.getJSONObject("properties")
            val id = feature.getString("id")
            if (seenAlerts.contains(id)) continue
            seenAlerts.add(id)

            val mag = props.getDouble("mag")
            val place = props.getString("place")
            val time = props.getLong("time")
            val ageMin = (System.currentTimeMillis() - time) / 60000

            // Solo notificar si es reciente (< 30 min)
            if (ageMin > 30) continue

            val title = when {
                mag >= 7.0 -> "🚨 TERREMOTO MAYOR M$mag"
                mag >= 6.0 -> "⚠️ Sismo Fuerte M$mag"
                else -> "🌍 Sismo M$mag"
            }
            val priority = if (mag >= 7.0) NotificationCompat.PRIORITY_MAX
                          else NotificationCompat.PRIORITY_HIGH
            val channel = if (mag >= 6.0) CHANNEL_CRITICAL else CHANNEL_GENERAL

            showNotification(id.hashCode(), title, place, channel, priority)
        }
    }

    private suspend fun checkVolcanoes() {
        // GDACS para volcanes y otros desastres
        try {
            val url = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH" +
                "?eventlist=VO,TC,FL&alertlevel=orange;red"
            val json = URL(url).readText()
            val data = JSONObject(json)
            val features = data.optJSONArray("features") ?: return

            for (i in 0 until features.length()) {
                val f = features.getJSONObject(i)
                val props = f.optJSONObject("properties") ?: continue
                val id = "gdacs_${props.optString("eventid", i.toString())}"
                if (seenAlerts.contains(id)) continue
                seenAlerts.add(id)

                val type = props.optString("eventtype", "")
                val name = props.optString("name", "Evento")
                val level = props.optString("alertlevel", "")

                val emoji = when(type) {
                    "VO" -> "🌋"; "TC" -> "🌀"; "FL" -> "🌊"; else -> "⚠️"
                }
                val typeName = when(type) {
                    "VO" -> "VOLCÁN"; "TC" -> "CICLÓN"; "FL" -> "INUNDACIÓN"; else -> "ALERTA"
                }
                showNotification(
                    id.hashCode(),
                    "$emoji $typeName - Alerta $level",
                    name, CHANNEL_CRITICAL, NotificationCompat.PRIORITY_HIGH
                )
            }
        } catch (_: Exception) {}
    }

    private fun showNotification(id: Int, title: String, text: String,
                                  channel: String, priority: Int) {
        val openApp = PendingIntent.getActivity(
            this, id,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, channel)
            .setSmallIcon(R.drawable.ic_alert)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(priority)
            .setAutoCancel(true)
            .setContentIntent(openApp)
            .build()

        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(id, notification)
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            nm.createNotificationChannel(NotificationChannel(
                CHANNEL_GENERAL, "Monitor AlertaGlobal",
                NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Servicio de monitoreo en background" })

            nm.createNotificationChannel(NotificationChannel(
                CHANNEL_CRITICAL, "Alertas Críticas",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Sismos, volcanes, tsunamis y emergencias"
                enableVibration(true)
                enableLights(true)
                lightColor = android.graphics.Color.RED
            })
        }
    }

    private fun buildMonitorNotification() = NotificationCompat.Builder(this, CHANNEL_GENERAL)
        .setSmallIcon(R.drawable.ic_alert)
        .setContentTitle("🌍 Alerta Global")
        .setContentText("Monitoreando alertas en tiempo real...")
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setOngoing(true)
        .build()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        job?.cancel()
        scope.cancel()
        super.onDestroy()
    }
}
