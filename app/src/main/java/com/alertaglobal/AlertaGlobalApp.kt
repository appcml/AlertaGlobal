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

        // Inicializar AdMob
        MobileAds.initialize(this)

        // Crear canales de notificación
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channels = listOf(
                NotificationChannel(
                    CHANNEL_ALERTS_ID,
                    "Alertas de Desastres",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Alertas críticas de sismos, tsunamis, incendios"
                    enableVibration(true)
                    enableLights(true)
                },
                NotificationChannel(
                    CHANNEL_WEATHER_ID,
                    "Alertas Meteorológicas",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Alertas de clima severo"
                },
                NotificationChannel(
                    CHANNEL_GENERAL_ID,
                    "Notificaciones Generales",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Recomendaciones y actualizaciones"
                }
            )

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannels(channels)
        }
    }
}
