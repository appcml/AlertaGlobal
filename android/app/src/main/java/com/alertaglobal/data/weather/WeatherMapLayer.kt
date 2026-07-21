package com.alertaglobal.data.weather

import android.content.Context
import com.alertaglobal.data.api.RetrofitClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * WeatherMapLayer — Capas de datos meteorológicos
 *
 * Integra datos de:
 * - Open-Meteo (libre, sin API key)
 * - WeatherAPI (lluvia, temperatura, UV)
 * - NASA FIRMS (incendios activos)
 */

data class WeatherData(
    val latitude: Double,
    val longitude: Double,
    val temperature: Double,
    val precipitation: Double,
    val windSpeed: Double,
    val uvIndex: Double,
    val weatherCode: Int,
    val timestamp: Long = System.currentTimeMillis()
)

data class RainfallAlert(
    val latitude: Double,
    val longitude: Double,
    val precipitation: Double, // mm
    val severity: String // baja, media, alta
)

data class TemperatureAlert(
    val latitude: Double,
    val longitude: Double,
    val temperature: Double,
    val severity: String // baja (-10°C), normal (10-30°C), alta (>30°C)
)

data class UVAlert(
    val latitude: Double,
    val longitude: Double,
    val uvIndex: Double,
    val severity: String // bajo, moderado, alto, muy alto, extremo
)

/**
 * API de Open-Meteo (LIBRE - sin API key)
 */
interface OpenMeteoApi {
    @GET("forecast")
    suspend fun getWeatherData(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("current") current: String = "temperature_2m,relative_humidity_2m,precipitation,weather_code,uv_index,wind_speed_10m",
        @Query("timezone") timezone: String = "auto"
    ): OpenMeteoResponse
}

data class OpenMeteoResponse(
    val latitude: Double,
    val longitude: Double,
    val current: CurrentWeather
)

data class CurrentWeather(
    val temperature_2m: Double,
    val relative_humidity_2m: Int,
    val precipitation: Double,
    val weather_code: Int,
    val uv_index: Double,
    val wind_speed_10m: Double
)

/**
 * Manager de datos meteorológicos
 */
class WeatherMapManager(private val context: Context) {

    private val weatherApi = RetrofitClient.createService(
        "https://api.open-meteo.com/v1/",
        OpenMeteoApi::class.java
    )

    /**
     * Obtener datos de clima para una ubicación
     */
    suspend fun getWeatherData(latitude: Double, longitude: Double): WeatherData? {
        return withContext(Dispatchers.IO) {
            try {
                val response = weatherApi.getWeatherData(latitude, longitude)
                WeatherData(
                    latitude = response.latitude,
                    longitude = response.longitude,
                    temperature = response.current.temperature_2m,
                    precipitation = response.current.precipitation,
                    windSpeed = response.current.wind_speed_10m,
                    uvIndex = response.current.uv_index,
                    weatherCode = response.current.weather_code
                )
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }

    /**
     * Determinar severidad de lluvia (mm/hora)
     */
    fun getRainfallSeverity(mm: Double): String {
        return when {
            mm < 1.0 -> "baja"
            mm < 5.0 -> "media"
            else -> "alta"
        }
    }

    /**
     * Determinar severidad de temperatura
     */
    fun getTemperatureSeverity(celsius: Double): String {
        return when {
            celsius < -10 -> "baja"
            celsius in -10.0..30.0 -> "normal"
            else -> "alta"
        }
    }

    /**
     * Determinar severidad de radiación UV
     */
    fun getUVSeverity(uvIndex: Double): String {
        return when {
            uvIndex < 3 -> "bajo"
            uvIndex < 6 -> "moderado"
            uvIndex < 8 -> "alto"
            uvIndex < 11 -> "muy alto"
            else -> "extremo"
        }
    }

    /**
     * Obtener descripción del código de clima WMO
     */
    fun getWeatherDescription(code: Int): String {
        return when (code) {
            0 -> "Despejado"
            1, 2 -> "Mostly Clear"
            3 -> "Nublado"
            45, 48 -> "Niebla"
            51, 53, 55 -> "Llovizna"
            61, 63, 65 -> "Lluvia"
            71, 73, 75 -> "Nieve"
            77 -> "Nieve granulada"
            80, 81, 82 -> "Lluvia fuerte"
            85, 86 -> "Aguanieve fuerte"
            95, 96, 99 -> "Tormenta"
            else -> "Desconocido"
        }
    }

    /**
     * Crear lista de alertas meteorológicas para mostrar en mapa
     */
    suspend fun generateWeatherAlerts(
        latitude: Double,
        longitude: Double
    ): WeatherAlerts {
        val weather = getWeatherData(latitude, longitude) ?: return WeatherAlerts(emptyList(), emptyList(), emptyList())

        val rainfallAlerts = if (weather.precipitation > 0) {
            listOf(
                RainfallAlert(
                    latitude, longitude,
                    weather.precipitation,
                    getRainfallSeverity(weather.precipitation)
                )
            )
        } else emptyList()

        val tempAlerts = listOf(
            TemperatureAlert(
                latitude, longitude,
                weather.temperature,
                getTemperatureSeverity(weather.temperature)
            )
        )

        val uvAlerts = if (weather.uvIndex > 0) {
            listOf(
                UVAlert(
                    latitude, longitude,
                    weather.uvIndex,
                    getUVSeverity(weather.uvIndex)
                )
            )
        } else emptyList()

        return WeatherAlerts(rainfallAlerts, tempAlerts, uvAlerts)
    }

    data class WeatherAlerts(
        val rainfall: List<RainfallAlert>,
        val temperature: List<TemperatureAlert>,
        val uvIndex: List<UVAlert>
    )
}

/**
 * Colores para visualización en mapa
 */
object WeatherColors {
    // Lluvia (mm/hora)
    fun getRainfallColor(mm: Double): String {
        return when {
            mm == 0.0 -> "#00000000" // Transparente
            mm < 1.0 -> "#90CAF9" // Azul claro
            mm < 5.0 -> "#42A5F5" // Azul
            mm < 10.0 -> "#1E88E5" // Azul oscuro
            else -> "#0D47A1" // Azul muy oscuro
        }
    }

    // Temperatura (°C)
    fun getTemperatureColor(celsius: Double): String {
        return when {
            celsius < 0 -> "#B3E5FC" // Azul claro
            celsius in 0.0..10.0 -> "#4FC3F7" // Azul
            celsius in 10.0..20.0 -> "#81C784" // Verde
            celsius in 20.0..30.0 -> "#FDD835" // Amarillo
            celsius in 30.0..35.0 -> "#FB8C00" // Naranja
            else -> "#D32F2F" // Rojo
        }
    }

    // Radiación UV
    fun getUVColor(uvIndex: Double): String {
        return when {
            uvIndex < 3 -> "#4CAF50" // Verde
            uvIndex < 6 -> "#FDD835" // Amarillo
            uvIndex < 8 -> "#FF6F00" // Naranja
            uvIndex < 11 -> "#D32F2F" // Rojo
            else -> "#7B1FA2" // Púrpura
        }
    }
}
