package com.alertaglobal.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

data class AlertFilterItem(
    val id: String,
    val name: String,
    val emoji: String,
    val color: Color
)

@Composable
fun AlertFiltersBar(
    selectedFilters: Set<String>,
    onFilterChange: (Set<String>) -> Unit
) {
    val filters = listOf(
        AlertFilterItem("sismos",      "Sismos",       "🔴", Color(0xFFFF4444)),
        AlertFilterItem("inundacion",  "Inundación",   "💧", Color(0xFF0099FF)),
        AlertFilterItem("volcan",      "Volcán",       "🌋", Color(0xFFFF6600)),
        AlertFilterItem("incendio",    "Incendio",     "🔥", Color(0xFFFF3300)),
        AlertFilterItem("lluvia",      "Lluvia",       "🌧️", Color(0xFF4499FF)),
        AlertFilterItem("temperatura", "Temperatura",  "🌡️", Color(0xFFFFAA00)),
        AlertFilterItem("uv",          "Rad. UV",      "☀️", Color(0xFFFFDD00)),
        AlertFilterItem("huracan",     "Huracán",      "🌀", Color(0xFF9933FF))
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF111111))
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Text(
            text = "Filtrar alertas:",
            color = Color.Gray,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(bottom = 6.dp)
        )

        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(filters) { filter ->
                val isSelected = filter.id in selectedFilters
                FilterChip(
                    selected = isSelected,
                    onClick = {
                        val updated = selectedFilters.toMutableSet()
                        if (isSelected) updated.remove(filter.id) else updated.add(filter.id)
                        onFilterChange(updated)
                    },
                    label = {
                        Text(
                            text = "${filter.emoji} ${filter.name}",
                            style = MaterialTheme.typography.labelSmall
                        )
                    },
                    leadingIcon = if (isSelected) {
                        { Icon(Icons.Filled.Check, null, tint = filter.color, modifier = Modifier.size(14.dp)) }
                    } else null,
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = filter.color.copy(alpha = 0.25f),
                        selectedLabelColor = Color.White,
                        containerColor = Color(0xFF222222),
                        labelColor = Color.Gray
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        selectedBorderColor = filter.color,
                        borderColor = Color.DarkGray
                    )
                )
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 6.dp),
            horizontalArrangement = Arrangement.End
        ) {
            TextButton(onClick = { onFilterChange(emptySet()) }) {
                Text("Limpiar", color = Color.Gray, style = MaterialTheme.typography.labelSmall)
            }
            Spacer(modifier = Modifier.width(8.dp))
            TextButton(onClick = { onFilterChange(filters.map { it.id }.toSet()) }) {
                Text("Todas", color = Color(0xFF00CC66), style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}
