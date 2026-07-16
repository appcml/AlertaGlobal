package com.alertaglobal
import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.google.android.gms.ads.MobileAds
class AlertaGlobalApp : Application() {
    companion object {
        const val CHANNEL_ALERTS_ID = "alertas_criticas"
        const val CHANNEL_WEATHER_ID = "alertas_clima"
        const val CHANNEL_GENERAL_ID = "notificaciones_generales"
    }
    override fun onCreate() {
        super.onCreate()
        MobileAds.initialize(this)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannels(listOf(
                NotificationChannel(CHANNEL_ALERTS_ID, "Alertas de Desastres", NotificationManager.IMPORTANCE_HIGH).apply { enableVibration(true); enableLights(true) },
                NotificationChannel(CHANNEL_WEATHER_ID, "Alertas Meteorológicas", NotificationManager.IMPORTANCE_DEFAULT),
                NotificationChannel(CHANNEL_GENERAL_ID, "Notificaciones Generales", NotificationManager.IMPORTANCE_LOW)
            ))
        }
    }
}
