package com.alertaglobal.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.alertaglobal.databinding.ItemAlertBinding
import com.alertaglobal.model.DisasterAlert
import java.text.SimpleDateFormat
import java.util.*

class AlertAdapter : ListAdapter<DisasterAlert, AlertAdapter.AlertViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): AlertViewHolder {
        val binding = ItemAlertBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return AlertViewHolder(binding)
    }

    override fun onBindViewHolder(holder: AlertViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class AlertViewHolder(private val binding: ItemAlertBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(alert: DisasterAlert) {
            binding.apply {
                tvAlertType.text = alert.type
                tvAlertTitle.text = alert.title
                tvAlertLocation.text = "\uD83D\uDCCD ${alert.location}"
                tvAlertMagnitude.text = "Magnitud: ${alert.magnitude}"
                tvAlertSeverity.text = alert.severity
                tvAlertSource.text = "Fuente: ${alert.source}"
                tvAlertTime.text = formatTime(alert.time)

                // Color según severidad
                val color = when (alert.severity) {
                    "CRÍTICO" -> "#F44336"
                    "ALTO" -> "#FF9800"
                    else -> "#FFC107"
                }
                cardAlert.setCardBackgroundColor(android.graphics.Color.parseColor(color + "20"))
                tvAlertSeverity.setTextColor(android.graphics.Color.parseColor(color))
            }
        }

        private fun formatTime(timestamp: Long): String {
            val sdf = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
            return sdf.format(Date(timestamp))
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<DisasterAlert>() {
        override fun areItemsTheSame(oldItem: DisasterAlert, newItem: DisasterAlert) =
            oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: DisasterAlert, newItem: DisasterAlert) =
            oldItem == newItem
    }
}
