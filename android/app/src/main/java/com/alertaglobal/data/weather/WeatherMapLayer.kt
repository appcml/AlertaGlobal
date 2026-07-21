package com.alertaglobal.data.weather

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URL

data class WeatherData(
    val latitude: Double,
    val longitude: Double,
    val temperature: Double,
    val precipitation: Double,
    val windSpeed: Double,
    val uvIndex: Double,
    val description: String
)

class WeatherMapLayer {

    // Open-Meteo API — GRATUITA, sin API key
    private val BASE_URL = "https://api.open-meteo.com/v1/forecast"

    suspend fun getWeatherData(latitude: Double, longitude: Double): WeatherData? {
        return withContext(Dispatchers.IO) {
            try {
                val url = "$BASE_URL?latitude=$latitude&longitude=$longitude" +
                        "&current=temperature_2m,precipitation,wind_speed_10m,uv_index,weather_code" +
                        "&timezone=auto"

                val response = URL(url).readText()
                val json = JSONObject(response)
                val current = json.getJSONObject("current")

                WeatherData(
                    latitude = latitude,
                    longitude = longitude,
                    temperature = current.getDouble("temperature_2m"),
                    precipitation = current.getDouble("precipitation"),
                    windSpeed = current.getDouble("wind_speed_10m"),
                    uvIndex = current.getDouble("uv_index"),
                    description = getWeatherDescription(current.getInt("weather_code"))
                )
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }

    fun getRainfallSeverity(mm: Double): String = when {
        mm == 0.0 -> "Sin lluvia"
        mm < 2.5  -> "Lluvia leve"
        mm < 10.0 -> "Lluvia moderada"
        mm < 50.0 -> "Lluvia fuerte"
        else      -> "Lluvia torrencial ⚠️"
    }

    fun getUVSeverity(uv: Double): String = when {
        uv < 3  -> "Bajo"
        uv < 6  -> "Moderado"
        uv < 8  -> "Alto"
        uv < 11 -> "Muy alto ⚠️"
        else    -> "Extremo 🚨"
    }

    fun getTemperatureColor(celsius: Double): String = when {
        celsius < 0   -> "#B3E5FC"
        celsius < 10  -> "#4FC3F7"
        celsius < 20  -> "#81C784"
        celsius < 30  -> "#FDD835"
        celsius < 35  -> "#FB8C00"
        else          -> "#D32F2F"
    }

    private fun getWeatherDescription(code: Int): String = when (code) {
        0           -> "Despejado ☀️"
        1, 2        -> "Parcialmente nublado 🌤️"
        3           -> "Nublado ☁️"
        45, 48      -> "Niebla 🌫️"
        51, 53, 55  -> "Llovizna 🌦️"
        61, 63, 65  -> "Lluvia 🌧️"
        71, 73, 75  -> "Nieve ❄️"
        80, 81, 82  -> "Chubascos 🌨️"
        95, 96, 99  -> "Tormenta eléctrica ⛈️"
        else        -> "Variable"
    }
}
