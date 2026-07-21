// ============================================
// js/map-layers.js — Capas estilo MSN Weather
// ============================================

var OWM_KEY = '6fe6e0dcca264864dbd631bf620aad64';
var activeLayers = {};
var alertLayerMarkers = {};
var mapLayersInitialized = false;
var clickInfoPopup = null;

// ========== CAPAS DISPONIBLES ==========
var LAYER_DEFS = {
    temp:     { label: '🌡️', title: 'Temperatura',    owm: 'temp_new',          opacity: 0.7 },
    rain:     { label: '💧', title: 'Lluvia',          owm: 'precipitation_new', opacity: 0.7 },
    wind:     { label: '💨', title: 'Viento',          owm: 'wind_new',          opacity: 0.6 },
    clouds:   { label: '☁️', title: 'Nubosidad',       owm: 'clouds_new',        opacity: 0.6 },
    pressure: { label: '📊', title: 'Presión',         owm: 'pressure_new',      opacity: 0.6 },
    humidity: { label: '💦', title: 'Humedad',         owm: 'humidity_new',      opacity: 0.6 },
    radar:    { label: '📡', title: 'Radar',           type: 'radar'                          },
    satellite:{ label: '🛰️', title: 'Satélite',        type: 'satellite'                      },
    sismos:   { label: '🔴', title: 'Sismos',          type: 'alert'                          },
    volcanes: { label: '🌋', title: 'Volcanes',        type: 'alert'                          },
    storm:    { label: '⛈️', title: 'Tormentas',       type: 'alert'                          },
};

// ========== CREAR PANEL ESTILO MSN ==========
function createLayerPanel() {
    if (document.getElementById('mlPanel')) return;

    var style = document.createElement('style');
    style.textContent = `
        #mlPanel {
            position: absolute;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1000;
            background: rgba(15,15,25,0.92);
            border: 1px solid #333;
            border-radius: 10px;
            padding: 6px 8px;
            display: flex;
            gap: 4px;
            align-items: center;
            box-shadow: 0 2px 12px rgba(0,0,0,0.6);
            max-width: 95vw;
            flex-wrap: wrap;
            justify-content: center;
        }
        .ml-sep {
            width: 1px;
            height: 28px;
            background: #444;
            margin: 0 2px;
        }
        .ml-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            border-radius: 8px;
            border: 1px solid transparent;
            background: transparent;
            color: #ccc;
            cursor: pointer;
            font-size: 18px;
            transition: all 0.15s;
            position: relative;
        }
        .ml-btn span {
            font-size: 8px;
            margin-top: 2px;
            color: #888;
            white-space: nowrap;
            line-height: 1;
        }
        .ml-btn:hover {
            background: rgba(255,255,255,0.1);
            border-color: #555;
        }
        .ml-btn.active {
            background: rgba(255,102,102,0.25);
            border-color: #ff6666;
        }
        .ml-btn.active span { color: #ff9999; }
        #mlValuePop {
            position: absolute;
            background: rgba(0,0,0,0.85);
            color: #fff;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 12px;
            pointer-events: none;
            z-index: 2000;
            border: 1px solid #555;
            white-space: nowrap;
            display: none;
        }
    `;
    document.head.appendChild(style);

    // Panel de botones
    var panel = document.createElement('div');
    panel.id = 'mlPanel';

    var groups = [
        ['temp','rain','wind','clouds','pressure','humidity'],
        ['radar','satellite'],
        ['sismos','volcanes','storm']
    ];

    groups.forEach(function(group, gi) {
        group.forEach(function(id) {
            var def = LAYER_DEFS[id];
            var btn = document.createElement('button');
            btn.className = 'ml-btn';
            btn.id = 'mlb-' + id;
            btn.title = def.title;
            btn.innerHTML = def.label + '<span>' + def.title + '</span>';
            btn.onclick = function() { toggleMapLayer(id); };
            panel.appendChild(btn);
        });
        if (gi < groups.length - 1) {
            var sep = document.createElement('div');
            sep.className = 'ml-sep';
            panel.appendChild(sep);
        }
    });

    var mapEl = document.getElementById('map');
    if (mapEl) mapEl.appendChild(panel);

    // Popup de valor al hacer click en el mapa
    var valuePop = document.createElement('div');
    valuePop.id = 'mlValuePop';
    document.body.appendChild(valuePop);

    // Click en mapa → mostrar valor
    if (window.leafletMap) {
        window.leafletMap.on('click', function(e) { onMapClick(e); });
    }
}

// ========== TOGGLE CAPA ==========
window.toggleMapLayer = function(id) {
    if (!window.leafletMap) return;
    var def = LAYER_DEFS[id];
    var btn = document.getElementById('mlb-' + id);

    // Si ya está activa → apagar
    if (activeLayers[id]) {
        window.leafletMap.removeLayer(activeLayers[id]);
        delete activeLayers[id];
        if (btn) btn.classList.remove('active');
        return;
    }
    if (alertLayerMarkers[id]) {
        alertLayerMarkers[id].forEach(function(m) { window.leafletMap.removeLayer(m); });
        delete alertLayerMarkers[id];
        if (btn) btn.classList.remove('active');
        return;
    }

    // Activar capa
    var layer = null;

    if (def.owm) {
        layer = L.tileLayer(
            'https://tile.openweathermap.org/map/' + def.owm + '/{z}/{x}/{y}.png?appid=' + OWM_KEY,
            { opacity: def.opacity || 0.65, attribution: '© OpenWeatherMap', maxZoom: 20 }
        );
        layer.addTo(window.leafletMap);
        activeLayers[id] = layer;

    } else if (def.type === 'radar') {
        layer = L.tileLayer(
            'https://tilecache.rainviewer.com/v2/radar/nowcast/{z}/{x}/{y}/2/1_1.png',
            { opacity: 0.55, attribution: '© RainViewer', maxZoom: 15 }
        );
        layer.addTo(window.leafletMap);
        activeLayers[id] = layer;

    } else if (def.type === 'satellite') {
        layer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { opacity: 0.75, attribution: '© Esri', maxZoom: 19 }
        );
        layer.addTo(window.leafletMap);
        activeLayers[id] = layer;

    } else if (def.type === 'alert') {
        addAlertPins(id);
        if (btn) btn.classList.add('active');
        return;
    }

    if (btn) btn.classList.add('active');
};

// ========== PINS DE ALERTAS ==========
function addAlertPins(type) {
    var alerts = window.externalAlerts || [];
    var filtered = alerts.filter(function(a) {
        var t = (a.type || '').toUpperCase();
        if (type === 'sismos')   return t.includes('SISMO');
        if (type === 'volcanes') return t.includes('VOLCÁN') || t.includes('ERUPCION');
        if (type === 'storm')    return t.includes('TORMENTA') || t.includes('VIENTO') || t.includes('LLUVIA');
        return false;
    });

    alertLayerMarkers[type] = [];

    filtered.forEach(function(a) {
        if (a.lat == null || a.lon == null) return;

        var color  = a.priority >= 90 ? '#ff0000' : a.priority >= 70 ? '#ff6600' : '#ffaa00';
        var size   = a.priority >= 80 ? 16 : 10;
        var pulse  = a.priority >= 90 ? 'animation:pulse 1.2s infinite;' : '';

        var icon = L.divIcon({
            html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
                  'background:' + color + ';border:2px solid #fff;box-shadow:0 0 6px ' + color + ';' + pulse + '"></div>',
            className: '', iconSize: [size+4, size+4], iconAnchor: [(size+4)/2, (size+4)/2]
        });

        var mag = a.magnitude ? ' — M' + a.magnitude.toFixed(1) : '';
        var popup = '<div style="min-width:160px;">' +
            '<b>' + (a.icon||'⚠️') + ' ' + (a.title||a.type) + mag + '</b>' +
            '<hr style="border-color:#ddd;margin:4px 0">' +
            '<div style="font-size:12px">' + (a.description||'') + '</div>' +
            (a.distKm ? '<div style="font-size:11px;color:#777;margin-top:4px">📍 ' + a.distKm + ' km</div>' : '') +
            '<div style="font-size:11px;color:#777">📡 ' + (a.source||'') + '</div>' +
            '<div style="font-size:11px;color:#777">🕐 ' + (a.time||'') + '</div>' +
            (a.link ? '<a href="' + a.link + '" target="_blank" style="font-size:11px;color:#4169E1">Ver más →</a>' : '') +
            '</div>';

        var m = L.marker([a.lat, a.lon], { icon: icon }).bindPopup(popup);
        m.addTo(window.leafletMap);
        alertLayerMarkers[type].push(m);
    });
}

// ========== CLICK EN MAPA → VALOR ==========
function onMapClick(e) {
    var hasOWM = Object.keys(activeLayers).some(function(id) {
        return LAYER_DEFS[id] && LAYER_DEFS[id].owm;
    });
    if (!hasOWM) return;

    var lat = e.latlng.lat.toFixed(4);
    var lon = e.latlng.lng.toFixed(4);
    var activeOWM = Object.keys(activeLayers).filter(function(id) {
        return LAYER_DEFS[id] && LAYER_DEFS[id].owm;
    });
    if (!activeOWM.length) return;

    fetch('https://api.openweathermap.org/data/2.5/weather?lat=' + lat + '&lon=' + lon +
          '&appid=' + OWM_KEY + '&units=metric&lang=es')
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (!d.main) return;
            var lines = [];
            if (activeLayers['temp'])     lines.push('🌡️ Temp: ' + Math.round(d.main.temp) + '°C');
            if (activeLayers['rain'])     lines.push('💧 Lluvia: ' + (d.rain ? (d.rain['1h']||0) : 0) + ' mm/h');
            if (activeLayers['wind'])     lines.push('💨 Viento: ' + Math.round((d.wind||{}).speed * 3.6) + ' km/h');
            if (activeLayers['clouds'])   lines.push('☁️ Nubes: ' + (d.clouds||{}).all + '%');
            if (activeLayers['pressure']) lines.push('📊 Presión: ' + d.main.pressure + ' hPa');
            if (activeLayers['humidity']) lines.push('💦 Humedad: ' + d.main.humidity + '%');
            if (!lines.length) return;

            var pop = document.getElementById('mlValuePop');
            if (!pop) return;
            pop.innerHTML = '<b>' + (d.name||'') + '</b><br>' + lines.join('<br>');
            pop.style.display = 'block';

            var pt = window.leafletMap.latLngToContainerPoint(e.latlng);
            var mapEl = document.getElementById('map');
            var rect = mapEl.getBoundingClientRect();
            pop.style.left = (rect.left + pt.x + 12) + 'px';
            pop.style.top  = (rect.top  + pt.y - 10) + 'px';

            setTimeout(function() { pop.style.display = 'none'; }, 4000);
        })
        .catch(function() {});
}

// ========== INICIALIZAR ==========
window.initMapLayers = function() {
    if (mapLayersInitialized || !window.leafletMap) return;
    createLayerPanel();
    mapLayersInitialized = true;

    // Registrar click
    window.leafletMap.on('click', onMapClick);
    console.log('✅ Capas del mapa inicializadas');
};

// Esperar mapa
var _wait = setInterval(function() {
    if (window.leafletMap && window.mapInitialized) {
        clearInterval(_wait);
        window.initMapLayers();
    }
}, 500);
