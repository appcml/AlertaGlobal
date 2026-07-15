package com.alertaglobal.model

// Modelo para alertas de desastres
data class DisasterAlert(
    val id: String,
    val type: String,
    val title: String,
    val magnitude: Double,
    val location: String,
    val time: Long,
    val severity: String,
    val source: String
)

// Modelo para recomendaciones
data class Recommendation(
    val title: String,
    val description: String,
    val category: String,
    val color: String
)

// Respuesta de USGS
data class UsgsResponse(
    val features: List<EarthquakeFeature>
)

data class EarthquakeFeature(
    val id: String,
    val properties: EarthquakeProperties,
    val geometry: EarthquakeGeometry
)

data class EarthquakeProperties(
    val mag: Double,
    val place: String,
    val time: Long
)

data class EarthquakeGeometry(
    val coordinates: List<Double>
)

// Respuesta de OpenWeatherMap
data class WeatherResponse(
    val name: String,
    val main: MainWeather,
    val weather: List<WeatherCondition>,
    val wind: WindInfo
)

data class MainWeather(
    val temp: Double,
    val humidity: Int,
    val pressure: Int,
    val feels_like: Double
)

data class WeatherCondition(
    val main: String,
    val description: String,
    val icon: String
)

data class WindInfo(
    val speed: Double,
    val deg: Int
)
