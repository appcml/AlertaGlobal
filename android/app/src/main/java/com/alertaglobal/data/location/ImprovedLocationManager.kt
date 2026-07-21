package com.alertaglobal.data.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import com.google.android.gms.location.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class ImprovedLocationManager(private val context: Context) {

    private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)

    private val _userLocation = MutableStateFlow<Location?>(null)
    val userLocation: StateFlow<Location?> = _userLocation

    private val _locationName = MutableStateFlow("Obteniendo ubicación...")
    val locationName: StateFlow<String> = _locationName

    private var locationCallback: LocationCallback? = null

    @SuppressLint("MissingPermission")
    fun startLocationUpdates() {
        // Prioridad: WiFi + Red móvil → GPS
        val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 10000)
            .setMinUpdateDistanceMeters(50f)
            .setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    _userLocation.value = location
                    _locationName.value = getSourceName(location)
                }
            }
        }

        fusedLocationClient.requestLocationUpdates(
            request,
            locationCallback!!,
            Looper.getMainLooper()
        )
    }

    @SuppressLint("MissingPermission")
    fun getLastKnownLocation(onSuccess: (Location) -> Unit, onError: (String) -> Unit) {
        fusedLocationClient.lastLocation
            .addOnSuccessListener { location ->
                if (location != null) {
                    _userLocation.value = location
                    onSuccess(location)
                } else {
                    onError("Ubicación no disponible")
                }
            }
            .addOnFailureListener { e ->
                onError("Error: ${e.message}")
            }
    }

    fun stopLocationUpdates() {
        locationCallback?.let {
            fusedLocationClient.removeLocationUpdates(it)
        }
    }

    fun distanceTo(lat: Double, lng: Double): Float {
        val current = _userLocation.value ?: return Float.MAX_VALUE
        val results = FloatArray(1)
        Location.distanceBetween(current.latitude, current.longitude, lat, lng, results)
        return results[0] / 1000f // en km
    }

    private fun getSourceName(location: Location): String {
        return when {
            location.accuracy < 50 -> "📡 Red WiFi + Antenas"
            location.accuracy < 200 -> "📶 Red Móvil"
            else -> "🛰️ GPS"
        }
    }
}
