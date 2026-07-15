package com.alertaglobal.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.alertaglobal.adapter.AlertAdapter
import com.alertaglobal.data.api.RetrofitClient
import com.alertaglobal.databinding.FragmentAlertsBinding
import com.alertaglobal.model.DisasterAlert
import kotlinx.coroutines.launch

class AlertsFragment : Fragment() {

    private var _binding: FragmentAlertsBinding? = null
    private val binding get() = _binding!!
    private lateinit var alertAdapter: AlertAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentAlertsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        loadAlerts()
    }

    private fun setupRecyclerView() {
        alertAdapter = AlertAdapter()
        binding.recyclerAlerts.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = alertAdapter
        }
    }

    private fun loadAlerts() {
        binding.progressBar.visibility = View.VISIBLE

        lifecycleScope.launch {
            try {
                val earthquakes = RetrofitClient.usgsApi.getRecentEarthquakes()
                val alerts = earthquakes.features.map { feature ->
                    DisasterAlert(
                        id = feature.id,
                        type = "SISMO",
                        title = feature.properties.place,
                        magnitude = feature.properties.mag,
                        location = "${feature.geometry.coordinates[1]}, ${feature.geometry.coordinates[0]}",
                        time = feature.properties.time,
                        severity = when {
                            feature.properties.mag >= 7.0 -> "CRÍTICO"
                            feature.properties.mag >= 5.0 -> "ALTO"
                            else -> "MEDIO"
                        },
                        source = "USGS"
                    )
                }

                alertAdapter.submitList(alerts.sortedByDescending { it.time })
                binding.progressBar.visibility = View.GONE

            } catch (e: Exception) {
                binding.progressBar.visibility = View.GONE
                binding.tvError.visibility = View.VISIBLE
                binding.tvError.text = "Error cargando alertas: ${e.message}"
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
