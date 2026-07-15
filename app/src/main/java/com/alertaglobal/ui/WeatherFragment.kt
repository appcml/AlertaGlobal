package com.alertaglobal.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.alertaglobal.data.api.RetrofitClient
import com.alertaglobal.databinding.FragmentWeatherBinding
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import kotlinx.coroutines.launch

class WeatherFragment : Fragment() {

    private var _binding: FragmentWeatherBinding? = null
    private val binding get() = _binding!!
    private lateinit var fusedLocationClient: FusedLocationProviderClient

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentWeatherBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireActivity())
        getCurrentLocation()
    }

    private fun getCurrentLocation() {
        if (ContextCompat.checkSelfPermission(
                requireContext(),
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            fusedLocationClient.lastLocation.addOnSuccessListener { location ->
                location?.let {
                    loadWeather(it.latitude, it.longitude)
                }
            }
        }
    }

    private fun loadWeather(lat: Double, lon: Double) {
        binding.progressBar.visibility = View.VISIBLE

        lifecycleScope.launch {
            try {
                // REEMPLAZA "TU_API_KEY" con tu API Key de OpenWeatherMap
                val weather = RetrofitClient.weatherApi.getCurrentWeather(
                    lat = lat,
                    lon = lon,
                    apiKey = "TU_API_KEY",
                    units = "metric",
                    lang = "es"
                )

                binding.apply {
                    tvCity.text = weather.name
                    tvTemperature.text = "${weather.main.temp.toInt()}°C"
                    tvDescription.text = weather.weather.firstOrNull()?.description?.replaceFirstChar { it.uppercase() } ?: ""
                    tvHumidity.text = "Humedad: ${weather.main.humidity}%"
                    tvWind.text = "Viento: ${weather.wind.speed} m/s"
                    tvPressure.text = "Presión: ${weather.main.pressure} hPa"

                    val temp = weather.main.temp
                    val recommendation = when {
                        temp > 35 -> "\uD83D\uDD25 ¡Extremadamente caluroso! Evita salir entre 11:00 y 16:00. Usa protector solar SPF 50+."
                        temp > 30 -> "☀\uFE0F Día muy caluroso. Mantente hidratado y busca sombra."
                        temp > 25 -> "\uD83C\uDF24\uFE0F Día caluroso. Usa protector solar y gafas de sol."
                        temp < 10 -> "❄\uFE0F Día frío. Abrígate bien y evita la exposición prolongada."
                        temp < 0 -> "\uD83E\uDD76 ¡Congelante! Riesgo de hipotermia. Sal solo si es necesario."
                        else -> "\uD83C\uDF08 Condiciones agradables. Disfruta tu día."
                    }
                    tvRecommendation.text = recommendation

                    progressBar.visibility = View.GONE
                }

            } catch (e: Exception) {
                binding.progressBar.visibility = View.GONE
                binding.tvError.text = "Error: ${e.message}"
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
