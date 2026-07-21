package com.alertaglobal.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Filtros de Alertas — Selección múltiple
 *
 * Permite activar/desactivar diferentes tipos de alertas simultáneamente
 * en el mapa
 */

data class AlertType(
    val id: String,
    val name: String,
    val emoji: String,
    val color: Color,
    val isActive: Boolean = true
)

@Composable
fun AlertFiltersUI(
    selectedFilters: MutableState<Set<String>>,
    onFilterChange: (Set<String>) -> Unit
) {
    val filterOptions = listOf(
        AlertType("sismos", "Sismos", "🔴", Color(0xFFFF4444)),
        AlertType("inundaciones", "Inundaciones", "💧", Color(0xFF0099FF)),
        AlertType("volcanes", "Volcanes", "🌋", Color(0xFFFFAA00)),
        AlertType("incendios", "Incendios", "🔥", Color(0xFFFF6600)),
        AlertType("lluvia", "Lluvia", "🌧️", Color(0xFF4499FF)),
        AlertType("temperatura", "Temperatura", "🌡️", Color(0xFFFF0000)),
        AlertType("radiacion_uv", "Radiación UV", "☀️", Color(0xFFFFDD00)),
        AlertType("otros", "Otros", "⚠️", Color(0xFF999999))
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF1A1A1A), RoundedCornerShape(12.dp))
            .padding(12.dp)
    ) {
        // Título
        Text(
            "Filtrar Alertas",
            style = MaterialTheme.typography.titleSmall,
            color = Color.White,
            modifier = Modifier.paddingFromBaseline(top = 16.dp, bottom = 12.dp)
        )

        // Grid de filtros
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(filterOptions) { filter ->
                FilterChip(
                    selected = filter.id in selectedFilters.value,
                    onClick = {
                        val newFilters = selectedFilters.value.toMutableSet()
                        if (filter.id in newFilters) {
                            newFilters.remove(filter.id)
                        } else {
                            newFilters.add(filter.id)
                        }
                        onFilterChange(newFilters)
                        selectedFilters.value = newFilters
                    },
                    label = {
                        Text(
                            text = "${filter.emoji} ${filter.name}",
                            color = if (filter.id in selectedFilters.value) Color.White else Color.Gray
                        )
                    },
                    leadingIcon = if (filter.id in selectedFilters.value) {
                        {
                            Icon(
                                Icons.Filled.Check,
                                contentDescription = null,
                                tint = filter.color,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    } else null,
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = filter.color.copy(alpha = 0.3f),
                        selectedLabelColor = Color.White,
                        containerColor = Color(0xFF2A2A2A),
                        labelColor = Color.Gray
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        selectedBorderColor = filter.color,
                        borderColor = Color.Gray.copy(alpha = 0.3f)
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Botones de acción
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            Button(
                onClick = {
                    onFilterChange(emptySet())
                    selectedFilters.value = emptySet()
                },
                modifier = Modifier
                    .weight(1f)
                    .height(36.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF4A4A4A)
                )
            ) {
                Text("Limpiar", fontSize = MaterialTheme.typography.labelSmall.fontSize)
            }

            Spacer(modifier = Modifier.width(8.dp))

            Button(
                onClick = {
                    val allIds = filterOptions.map { it.id }.toSet()
                    onFilterChange(allIds)
                    selectedFilters.value = allIds
                },
                modifier = Modifier
                    .weight(1f)
                    .height(36.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF00AA66)
                )
            ) {
                Text("Todas", fontSize = MaterialTheme.typography.labelSmall.fontSize)
            }
        }
    }
}

/**
 * Indicador de filtros activos (para mostrar en la esquina del mapa)
 */
@Composable
fun FilterIndicator(activeFilters: Set<String>) {
    if (activeFilters.isNotEmpty()) {
        Surface(
            modifier = Modifier
                .background(Color(0xFF00AA66), RoundedCornerShape(8.dp))
                .padding(8.dp),
            color = Color.Transparent
        ) {
            Text(
                text = "Filtros: ${activeFilters.size}",
                color = Color.White,
                style = MaterialTheme.typography.labelSmall
            )
        }
    }
}

/**
 * Función para colorear marcadores según tipo
 */
fun getAlertColor(alertType: String): Color {
    return when (alertType) {
        "sismos" -> Color(0xFFFF4444)
        "inundaciones" -> Color(0xFF0099FF)
        "volcanes" -> Color(0xFFFFAA00)
        "incendios" -> Color(0xFFFF6600)
        "lluvia" -> Color(0xFF4499FF)
        "temperatura" -> Color(0xFFFF0000)
        "radiacion_uv" -> Color(0xFFFFDD00)
        else -> Color.Gray
    }
}

/**
 * Función para obtener emoji según tipo
 */
fun getAlertEmoji(alertType: String): String {
    return when (alertType) {
        "sismos" -> "🔴"
        "inundaciones" -> "💧"
        "volcanes" -> "🌋"
        "incendios" -> "🔥"
        "lluvia" -> "🌧️"
        "temperatura" -> "🌡️"
        "radiacion_uv" -> "☀️"
        else -> "⚠️"
    }
}
