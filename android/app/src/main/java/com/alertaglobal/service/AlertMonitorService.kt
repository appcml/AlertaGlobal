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
import kotlinx.coroutines.*
import java.net.URL
import org.json.JSONObject
class AlertMonitorService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var job: Job? = null
    companion object {
        fun start(ctx: Context) { ctx.startForegroundService(Intent(ctx, AlertMonitorService::class.java)) }
    }
    override fun onCreate() {
        super.onCreate()
        startForeground(9999, NotificationCompat.Builder(this, "notificaciones_generales")
            .setSmallIcon(R.drawable.ic_alert).setContentTitle("Alerta Global")
            .setContentText("Monitoreando alertas...").setPriority(NotificationCompat.PRIORITY_LOW).build())
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int { job = scope.launch { while (isActive) { checkAlerts(); delay(300000) } }; return START_STICKY }
    private suspend fun checkAlerts() {
        try {
            val json = URL("https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=5&minmagnitude=6.0&orderby=time").readText()
            val features = JSONObject(json).getJSONArray("features")
            for (i in 0 until features.length()) {
                val props = features.getJSONObject(i).getJSONObject("properties")
                val mag = props.getDouble("mag"); val place = props.getString("place")
                val n = NotificationCompat.Builder(this, "alertas_criticas")
                    .setSmallIcon(R.drawable.ic_alert).setContentTitle("🚨 SISMO M${mag}")
                    .setContentText(place).setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setContentIntent(PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE))
                    .setAutoCancel(true).build()
                (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(place.hashCode(), n)
            }
        } catch (_: Exception) {}
    }
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onDestroy() { job?.cancel(); scope.cancel(); super.onDestroy() }
}
