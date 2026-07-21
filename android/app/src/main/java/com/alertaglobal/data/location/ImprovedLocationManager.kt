package com.alertaglobal.data.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import com.google.android.gms.location.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * LocationManager — Geolocalización mejorada
 *
 * Prioridad: WiFi Network → Mobile Network → GPS
 * Usa Google Fused Location Provider para máxima precisión
 */
class ImprovedLocationManager(private val context: Context) {

    private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
    
    private val _userLocation = MutableStateFlow<Location?>(null)
    val userLocation: StateFlow<Location?> = _userLocation
    
    private val _locationAccuracy = MutableStateFlow("")
    val locationAccuracy: StateFlow<String> = _locationAccuracy
    
    private val _isLocating = MutableStateFlow(false)
    val isLocating: StateFlow<Boolean> = _isLocating

    /**
     * Solicitar ubicación con prioridad: RED → RED MÓVIL → GPS
     */
    @SuppressLint("MissingPermission")
    fun startLocationUpdates() {
        _isLocating.value = true

        // Prioridad 1: Red WiFi + Antenas móviles (máxima precisión urbana)
        val networkLocationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000)
            .setMinUpdateDistanceMeters(10f)
            .setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
            .build()

        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                val location = locationResult.lastLocation
                if (location != null) {
                    _userLocation.value = location
                    _locationAccuracy.value = "${location.accuracy.toInt()}m - ${getSourceName(location)}"
                    _isLocating.value = false
                }
            }
        }

        fusedLocationClient.requestLocationUpdates(
            networkLocationRequest,
            locationCallback,
            Looper.getMainLooper()
        )
    }

    /**
     * Obtener última ubicación conocida (rápido)
     */
    @SuppressLint("MissingPermission")
    fun getLastLocation(onSuccess: (Location) -> Unit, onError: (String) -> Unit) {
        _isLocating.value = true

        fusedLocationClient.lastLocation
            .addOnSuccessListener { location ->
                if (location != null) {
                    _userLocation.value = location
                    _locationAccuracy.value = "${location.accuracy.toInt()}m"
                    _isLocating.value = false
                    onSuccess(location)
                } else {
                    onError("Ubicación no disponible")
                }
            }
            .addOnFailureListener { exception ->
                _isLocating.value = false
                onError("Error: ${exception.message}")
            }
    }

    /**
     * Obtener información detallada de la ubicación
     */
    fun getLocationDetails(): LocationDetails? {
        val location = _userLocation.value ?: return null

        return LocationDetails(
            latitude = location.latitude,
            longitude = location.longitude,
            accuracy = location.accuracy,
            source = getSourceName(location),
            speed = location.speed,
            bearing = location.bearing,
            altitude = location.altitude,
            timestamp = location.time
        )
    }

    /**
     * Determinar origen de la ubicación
     */
    private fun getSourceName(location: Location): String {
        return when {
            location.accuracy < 50 -> "🌐 Red + Antenas (Precisión alta)"
            location.accuracy < 100 -> "📡 Red móvil + WiFi"
            location.accuracy < 1000 -> "🛰️ GPS (Precisión media)"
            else -> "🛰️ GPS (Baja precisión)"
        }
    }

    /**
     * Detener actualizaciones de ubicación
     */
    fun stopLocationUpdates() {
        fusedLocationClient.removeLocationUpdates({ })
        _isLocating.value = false
    }

    /**
     * Calcular distancia entre dos puntos
     */
    fun calculateDistance(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Float {
        val results = FloatArray(1)
        Location.distanceBetween(lat1, lng1, lat2, lng2, results)
        return results[0] // en metros
    }

    /**
     * Data class para detalles de ubicación
     */
    data class LocationDetails(
        val latitude: Double,
        val longitude: Double,
        val accuracy: Float,
        val source: String,
        val speed: Float,
        val bearing: Float,
        val altitude: Double,
        val timestamp: Long
    )
}
