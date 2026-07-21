// ============================================
// js/AlertFiltering_FIX.js — Filtrado inteligente por zoom
// ============================================

function updateMapMarkersSmartZoom(allAlerts, userLocation) {
    if (!mapInitialized || !leafletMap || !allAlerts) return;

    mapMarkers.forEach(function(m) { leafletMap.removeLayer(m); });
    mapMarkers = [];

    if (userLocation && userLocation.lat) {
        if (userMarker) {
            userMarker.setLatLng([userLocation.lat, userLocation.lon]);
        } else {
            userMarker = L.marker([userLocation.lat, userLocation.lon], { icon: createUserIcon() })
                .addTo(leafletMap).bindPopup('<b>📍 Tu ubicación</b><br>' + (userLocation.name || ''));
        }
        leafletMap.setView([userLocation.lat, userLocation.lon], leafletMap.getZoom() || 6, { animate: true });
    }

    var currentZoom = leafletMap.getZoom();
    var radiusKm = getUserRadiusKm();
    var filteredAlerts = [];

    if (currentZoom <= 6) {
        filteredAlerts = allAlerts.filter(function(a) {
            return (a.priority >= 80)
                || (a.magnitude && a.magnitude >= 5)
                || (a.type && (a.type.includes('VOLCÁN') || a.type.includes('ERUPCIÓN') || a.type.includes('TSUNAMI')));
        });
    } else if (currentZoom <= 10) {
        if (userLocation && userLocation.lat) {
            filteredAlerts = allAlerts.filter(function(a) {
                var isNearby = isWithinRadius(a.lat, a.lon, userLocation.lat, userLocation.lon, radiusKm);
                var isImportant = (a.priority >= 70) || (a.magnitude && a.magnitude >= 4.5);
                return isNearby || isImportant;
            });
        } else {
            filteredAlerts = allAlerts.filter(function(a) {
                return (a.priority >= 70) || (a.magnitude && a.magnitude >= 4.5);
            });
        }
    } else {
        if (userLocation && userLocation.lat) {
            filteredAlerts = allAlerts.filter(function(a) {
                return isWithinRadius(a.lat, a.lon, userLocation.lat, userLocation.lon, radiusKm);
            });
        } else {
            filteredAlerts = allAlerts;
        }
    }

    filteredAlerts.forEach(function(a) {
        if (a.lat == null || a.lon == null) return;
        var color = a.color || '#FF9500';
        var distStr = a.distKm != null ? '<br><small>📏 ' + a.distKm + ' km de ti</small>' : '';
        var timeStr = a.time ? '<br><small>🕐 ' + formatTime(a.time) + '</small>' : '';
        var popup = '<div style="min-width:200px;font-family:sans-serif">'
            + '<div style="color:' + color + ';font-weight:700;font-size:13px">' + (a.icon || '') + ' ' + (a.type || '') + '</div>'
            + '<div style="font-weight:600;font-size:13px;margin:4px 0">' + a.title + '</div>'
            + (a.description ? '<div style="font-size:11px;color:#888;margin-bottom:4px">' + a.description.substring(0, 150) + '</div>' : '')
            + '<div style="font-size:11px;color:#666">📡 ' + a.source + distStr + timeStr + '</div>'
            + (a.link ? '<br><a href="' + a.link + '" target="_blank" style="font-size:11px;color:#0A84FF">Ver más →</a>' : '')
            + '</div>';
        var marker = L.marker([a.lat, a.lon], { icon: getMapIcon(a) })
            .addTo(leafletMap)
            .bindPopup(popup, { maxWidth: 250 });
        mapMarkers.push(marker);
    });

    var indicator = document.getElementById('filterIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'filterIndicator';
        indicator.style.cssText = 'position:fixed;bottom:70px;right:10px;background:rgba(0,0,0,0.8);color:#0f0;'
            + 'padding:8px 12px;border-radius:8px;font-size:11px;z-index:1000;border:1px solid #0f0;font-family:monospace;pointer-events:none;';
        document.body.appendChild(indicator);
    }
    var zoomLabel = currentZoom <= 6 ? 'GLOBAL' : currentZoom <= 10 ? 'REGIONAL' : 'DETALLE';
    indicator.innerHTML = '🔍 ' + zoomLabel + ': ' + filteredAlerts.length + '/' + allAlerts.length + ' alertas';
}

function setupMapZoomListener() {
    if (!leafletMap) return;
    leafletMap.on('zoomend', function() {
        updateMapMarkersSmartZoom(externalAlerts, getActiveLocation());
    });
}

function startMapAutoRefreshFixed() {
    if (typeof mapRefreshInterval !== 'undefined' && mapRefreshInterval) clearInterval(mapRefreshInterval);
    mapRefreshInterval = setInterval(function() {
        if (mapInitialized && leafletMap && externalAlerts) {
            updateMapMarkersSmartZoom(externalAlerts, getActiveLocation());
        }
    }, 120000);
}
