// ============================================
// js/map-layers.js — Capas estilo MSN Weather
// Barra de capas ARRIBA del mapa
// ============================================

var OWM_KEY = '6fe6e0dcca264864dbd631bf620aad64';
var activeLayers = {};
var alertLayerMarkers = {};
var mapLayersInitialized = false;

var LAYER_DEFS = {
    temp:     { label: '🌡️', title: 'Temp',      owm: 'temp_new'           },
    rain:     { label: '💧', title: 'Lluvia',     owm: 'precipitation_new'  },
    wind:     { label: '💨', title: 'Viento',     owm: 'wind_new'           },
    clouds:   { label: '☁️', title: 'Nubes',      owm: 'clouds_new'         },
    pressure: { label: '📊', title: 'Presión',    owm: 'pressure_new'       },
    humidity: { label: '💦', title: 'Humedad',    owm: 'humidity_new'       },
    radar:    { label: '📡', title: 'Radar',      type: 'radar'             },
    satellite:{ label: '🛰️', title: 'Satélite',   type: 'satellite'         },
    sismos:   { label: '🔴', title: 'Sismos',     type: 'alert'             },
    volcanes: { label: '🌋', title: 'Volcanes',   type: 'alert'             },
    storm:    { label: '⛈️', title: 'Tormentas',  type: 'alert'             },
};

function createLayerPanel() {
    if (document.getElementById('mlPanel')) return;

    // Inyectar CSS
    var style = document.createElement('style');
    style.textContent = `
        #mlBar {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            background: rgba(10,10,20,0.88);
            border-bottom: 1px solid #333;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 2px;
            padding: 4px 8px;
            flex-wrap: nowrap;
            overflow-x: auto;
        }
        .ml-sep {
            width: 1px;
            height: 32px;
            background: #444;
            margin: 0 3px;
            flex-shrink: 0;
        }
        .ml-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-width: 40px;
            height: 44px;
            padding: 0 4px;
            border-radius: 6px;
            border: 1px solid transparent;
            background: transparent;
            color: #ccc;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.15s;
            flex-shrink: 0;
        }
        .ml-btn span {
            font-size: 8px;
            margin-top: 1px;
            color: #777;
            white-space: nowrap;
        }
        .ml-btn:hover {
            background: rgba(255,255,255,0.08);
            border-color: #555;
        }
        .ml-btn.active {
            background: rgba(255,102,102,0.2);
            border-color: #ff6666;
        }
        .ml-btn.active span { color: #ff9999; }
        #mlValuePop {
            position: fixed;
            background: rgba(0,0,0,0.88);
            color: #fff;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 9999;
            border: 1px solid #555;
            white-space: nowrap;
            pointer-events: none;
            display: none;
            line-height: 1.5;
        }
        /* Ajustar mapa para dejar espacio a la barra */
        #map { padding-top: 0 !important; }
    `;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.id = 'mlBar';

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
            bar.appendChild(btn);
        });
        if (gi < groups.length - 1) {
            var sep = document.createElement('div');
            sep.className = 'ml-sep';
            bar.appendChild(sep);
        }
    });

    // Insertar la barra DENTRO del div #map, arriba de todo
    var mapEl = document.getElementById('map');
    if (mapEl) {
        mapEl.style.position = 'relative';
        mapEl.insertBefore(bar, mapEl.firstChild);

        // Empujar el mapa Leaflet hacia abajo para que la barra no tape nada
        var mapPane = mapEl.querySelector('.leaflet-pane');
        if (mapPane) mapPane.style.marginTop = '53px';
    }

    // Popup de valor
    var pop = document.createElement('div');
    pop.id = 'mlValuePop';
    document.body.appendChild(pop);
}

// ========== TOGGLE CAPA ==========
window.toggleMapLayer = function(id) {
    if (!window.leafletMap) return;
    var def = LAYER_DEFS[id];
    var btn = document.getElementById('mlb-' + id);

    // Apagar si ya estaba activa
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

    var layer = null;

    if (def.owm) {
        layer = L.tileLayer(
            'https://tile.openweathermap.org/map/' + def.owm + '/{z}/{x}/{y}.png?appid=' + OWM_KEY,
            { opacity: 0.65, attribution: '© OpenWeatherMap', maxZoom: 20 }
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

    if (btn && layer) btn.classList.add('active');
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
        var color = a.priority >= 90 ? '#ff0000' : a.priority >= 70 ? '#ff6600' : '#ffaa00';
        var size  = a.priority >= 80 ? 16 : 10;
        var icon = L.divIcon({
            html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
                  'background:' + color + ';border:2px solid #fff;box-shadow:0 0 6px ' + color + ';"></div>',
            className: '', iconSize: [size+4, size+4], iconAnchor: [(size+4)/2, (size+4)/2]
        });
        var mag = a.magnitude ? ' — M' + a.magnitude.toFixed(1) : '';
        var popup = '<div style="min-width:160px;font-size:13px;">' +
            '<b>' + (a.icon||'⚠️') + ' ' + (a.title||a.type) + mag + '</b>' +
            '<hr style="border-color:#ddd;margin:4px 0">' +
            '<div>' + (a.description||'') + '</div>' +
            (a.distKm ? '<div style="color:#777;font-size:11px;margin-top:4px">📍 ' + a.distKm + ' km</div>' : '') +
            '<div style="color:#777;font-size:11px">📡 ' + (a.source||'') + '</div>' +
            '<div style="color:#777;font-size:11px">🕐 ' + (a.time||'') + '</div>' +
            (a.link ? '<br><a href="' + a.link + '" target="_blank" style="color:#4169E1;font-size:11px">Ver más →</a>' : '') +
            '</div>';
        L.marker([a.lat, a.lon], { icon: icon })
            .bindPopup(popup)
            .addTo(window.leafletMap);
        alertLayerMarkers[type].push(L.marker([a.lat, a.lon], { icon: icon }));
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

    fetch('https://api.openweathermap.org/data/2.5/weather?lat=' + lat + '&lon=' + lon +
          '&appid=' + OWM_KEY + '&units=metric&lang=es')
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (!d || !d.main) return;
            var lines = [];
            if (activeLayers['temp'])     lines.push('🌡️ ' + Math.round(d.main.temp) + '°C');
            if (activeLayers['rain'])     lines.push('💧 ' + ((d.rain && d.rain['1h']) || 0) + ' mm/h');
            if (activeLayers['wind'])     lines.push('💨 ' + Math.round((d.wind&&d.wind.speed||0)*3.6) + ' km/h');
            if (activeLayers['clouds'])   lines.push('☁️ ' + ((d.clouds&&d.clouds.all)||0) + '%');
            if (activeLayers['pressure']) lines.push('📊 ' + d.main.pressure + ' hPa');
            if (activeLayers['humidity']) lines.push('💦 ' + d.main.humidity + '%');
            if (!lines.length) return;

            var pop = document.getElementById('mlValuePop');
            if (!pop) return;
            var name = (d.name||'') + (d.sys&&d.sys.country ? ', '+d.sys.country : '');
            pop.innerHTML = '<b style="font-size:13px">' + name + '</b><br>' + lines.join('  ');
            pop.style.display = 'block';

            // Posicionar cerca del click pero arriba a la derecha
            var pt = window.leafletMap.latLngToContainerPoint(e.latlng);
            var mapEl = document.getElementById('map');
            var rect = mapEl.getBoundingClientRect();
            pop.style.left = Math.min(rect.left + pt.x + 10, window.innerWidth - 220) + 'px';
            pop.style.top  = Math.max(rect.top  + pt.y - 60, rect.top + 60) + 'px';

            setTimeout(function() { pop.style.display = 'none'; }, 4000);
        })
        .catch(function() {});
}

// ========== INICIALIZAR ==========
window.initMapLayers = function() {
    if (mapLayersInitialized || !window.leafletMap) return;
    createLayerPanel();
    window.leafletMap.on('click', onMapClick);
    mapLayersInitialized = true;
    console.log('✅ Capas del mapa inicializadas');
};

var _wait = setInterval(function() {
    if (window.leafletMap && window.mapInitialized) {
        clearInterval(_wait);
        setTimeout(window.initMapLayers, 300);
    }
}, 500);
