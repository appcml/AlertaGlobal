// ============================================
// js/map-layers.js — Mapa Interactivo Alerta Global
// Capas meteorológicas + Satélite + Alertas
// ============================================

var OWM_KEY = '6fe6e0dcca264864dbd631bf620aad64';
var activeLayers = {};
var alertPins = [];
var mapLayersInitialized = false;
var currentBaseMap = 'dark';

// ========== MAPAS BASE ==========
var BASE_MAPS = {
    dark:  { label: '🌑', title: 'Oscuro',     url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '© CartoDB' },
    light: { label: '🌕', title: 'Claro',      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap' },
    sat:   { label: '🛰️', title: 'Satélite',   url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
    topo:  { label: '⛰️', title: 'Relieve',    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: '© OpenTopoMap' },
};

// ========== CAPAS METEOROLÓGICAS ==========
var MET_LAYERS = {
    temp:     { label: '🌡️', title: 'Temperatura',   owm: 'temp_new',          opacity: 0.7 },
    rain:     { label: '🌧️', title: 'Lluvia',         owm: 'precipitation_new', opacity: 0.7 },
    wind:     { label: '💨', title: 'Viento',         owm: 'wind_new',          opacity: 0.6 },
    clouds:   { label: '☁️', title: 'Nubes',          owm: 'clouds_new',        opacity: 0.6 },
    pressure: { label: '📊', title: 'Presión',        owm: 'pressure_new',      opacity: 0.6 },
    humidity: { label: '💦', title: 'Humedad',        owm: 'humidity_new',      opacity: 0.6 },
    aqi:      { label: '🌫️', title: 'Calidad Aire',  type: 'aqi'                             },
};

// ========== CAPAS SATÉLITE/RADAR ==========
var SAT_LAYERS = {
    radar:    { label: '📡', title: 'Radar',         type: 'radar'     },
    infrared: { label: '🔴', title: 'Infrarrojo',    type: 'infrared'  },
    vapor:    { label: '💧', title: 'Vapor Agua',    type: 'vapor'     },
};

function injectCSS() {
    var s = document.createElement('style');
    s.textContent = `
        #mlBar {
            position: absolute;
            top: 0; left: 0; right: 0;
            z-index: 1000;
            background: rgba(8,8,18,0.93);
            border-bottom: 1px solid #2a2a3a;
            display: flex;
            align-items: stretch;
            overflow-x: auto;
            scrollbar-width: none;
        }
        #mlBar::-webkit-scrollbar { display: none; }
        .ml-group {
            display: flex;
            align-items: center;
            padding: 0 4px;
            border-right: 1px solid #2a2a3a;
        }
        .ml-group:last-child { border-right: none; }
        .ml-group-label {
            font-size: 8px;
            color: #555;
            text-transform: uppercase;
            writing-mode: vertical-lr;
            transform: rotate(180deg);
            padding: 4px 2px;
            letter-spacing: 1px;
        }
        .ml-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-width: 38px;
            height: 48px;
            padding: 0 3px;
            border-radius: 5px;
            border: 1px solid transparent;
            background: transparent;
            color: #bbb;
            cursor: pointer;
            font-size: 15px;
            transition: all 0.15s;
            flex-shrink: 0;
            margin: 2px 1px;
        }
        .ml-btn span {
            font-size: 7px;
            margin-top: 1px;
            color: #555;
            white-space: nowrap;
            letter-spacing: 0.3px;
        }
        .ml-btn:hover {
            background: rgba(255,255,255,0.07);
            border-color: #444;
            color: #fff;
        }
        .ml-btn:hover span { color: #999; }
        .ml-btn.active {
            background: rgba(100,180,255,0.18);
            border-color: #4a9eff;
            color: #fff;
        }
        .ml-btn.active span { color: #7bbfff; }
        .ml-btn.base-active {
            background: rgba(100,255,150,0.15);
            border-color: #44cc77;
            color: #fff;
        }
        .ml-btn.base-active span { color: #66dd99; }
        #mlValuePop {
            position: fixed;
            background: rgba(5,5,15,0.93);
            color: #fff;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 12px;
            z-index: 9999;
            border: 1px solid #333;
            white-space: nowrap;
            pointer-events: none;
            display: none;
            line-height: 1.8;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        #mlValuePop .pop-title {
            font-weight: 700;
            font-size: 13px;
            border-bottom: 1px solid #333;
            padding-bottom: 4px;
            margin-bottom: 4px;
        }
        @keyframes alertPulse {
            0%   { box-shadow: 0 0 0 0 rgba(255,50,50,0.7); }
            70%  { box-shadow: 0 0 0 8px rgba(255,50,50,0); }
            100% { box-shadow: 0 0 0 0 rgba(255,50,50,0); }
        }
    `;
    document.head.appendChild(s);
}

function createBar() {
    if (document.getElementById('mlBar')) return;
    var bar = document.createElement('div');
    bar.id = 'mlBar';

    // GRUPO 1: Mapas base
    var g1 = document.createElement('div');
    g1.className = 'ml-group';
    g1.innerHTML = '<div class="ml-group-label">BASE</div>';
    Object.keys(BASE_MAPS).forEach(function(id) {
        var def = BASE_MAPS[id];
        var btn = document.createElement('button');
        btn.className = 'ml-btn' + (id === 'dark' ? ' base-active' : '');
        btn.id = 'mlb-' + id;
        btn.title = def.title;
        btn.innerHTML = def.label + '<span>' + def.title + '</span>';
        btn.onclick = function() { switchBaseMap(id); };
        g1.appendChild(btn);
    });
    bar.appendChild(g1);

    // GRUPO 2: Meteorología
    var g2 = document.createElement('div');
    g2.className = 'ml-group';
    g2.innerHTML = '<div class="ml-group-label">MET</div>';
    Object.keys(MET_LAYERS).forEach(function(id) {
        var def = MET_LAYERS[id];
        var btn = document.createElement('button');
        btn.className = 'ml-btn';
        btn.id = 'mlb-' + id;
        btn.title = def.title;
        btn.innerHTML = def.label + '<span>' + def.title + '</span>';
        btn.onclick = function() { toggleMetLayer(id); };
        g2.appendChild(btn);
    });
    bar.appendChild(g2);

    // GRUPO 3: Satélite/Radar
    var g3 = document.createElement('div');
    g3.className = 'ml-group';
    g3.innerHTML = '<div class="ml-group-label">SAT</div>';
    Object.keys(SAT_LAYERS).forEach(function(id) {
        var def = SAT_LAYERS[id];
        var btn = document.createElement('button');
        btn.className = 'ml-btn';
        btn.id = 'mlb-' + id;
        btn.title = def.title;
        btn.innerHTML = def.label + '<span>' + def.title + '</span>';
        btn.onclick = function() { toggleSatLayer(id); };
        g3.appendChild(btn);
    });
    bar.appendChild(g3);

    var mapEl = document.getElementById('map');
    if (mapEl) {
        mapEl.style.position = 'relative';
        mapEl.insertBefore(bar, mapEl.firstChild);
        // Dar espacio al mapa
        setTimeout(function() {
            var barH = bar.offsetHeight || 52;
            if (window.leafletMap) window.leafletMap.invalidateSize();
        }, 100);
    }
}

// ========== CAMBIAR MAPA BASE ==========
function switchBaseMap(id) {
    if (!window.leafletMap) return;
    // Quitar base actual
    window.leafletMap.eachLayer(function(layer) {
        if (layer._isBaseLayer) window.leafletMap.removeLayer(layer);
    });
    var def = BASE_MAPS[id];
    var layer = L.tileLayer(def.url, { attribution: def.attr, maxZoom: 20 });
    layer._isBaseLayer = true;
    layer.addTo(window.leafletMap);
    layer.bringToBack();
    currentBaseMap = id;
    // Actualizar botones
    Object.keys(BASE_MAPS).forEach(function(k) {
        var btn = document.getElementById('mlb-' + k);
        if (btn) btn.className = 'ml-btn' + (k === id ? ' base-active' : '');
    });
}

// ========== TOGGLE CAPA METEOROLÓGICA ==========
function toggleMetLayer(id) {
    if (!window.leafletMap) return;
    var def = MET_LAYERS[id];
    var btn = document.getElementById('mlb-' + id);

    if (activeLayers[id]) {
        window.leafletMap.removeLayer(activeLayers[id]);
        delete activeLayers[id];
        if (btn) btn.classList.remove('active');
        return;
    }

    var layer;
    if (def.owm) {
        layer = L.tileLayer(
            'https://tile.openweathermap.org/map/' + def.owm + '/{z}/{x}/{y}.png?appid=' + OWM_KEY,
            { opacity: def.opacity || 0.65, attribution: '© OpenWeatherMap', maxZoom: 20 }
        );
    } else if (def.type === 'aqi') {
        // Calidad del aire via OWM air_pollution
        layer = L.tileLayer(
            'https://tile.openweathermap.org/map/pressure_new/{z}/{x}/{y}.png?appid=' + OWM_KEY,
            { opacity: 0.5, attribution: '© OpenWeatherMap', maxZoom: 20 }
        );
    }
    if (layer) {
        layer.addTo(window.leafletMap);
        activeLayers[id] = layer;
        if (btn) btn.classList.add('active');
    }
}

// ========== TOGGLE CAPA SATÉLITE/RADAR ==========
function toggleSatLayer(id) {
    if (!window.leafletMap) return;
    var btn = document.getElementById('mlb-' + id);

    if (activeLayers[id]) {
        window.leafletMap.removeLayer(activeLayers[id]);
        delete activeLayers[id];
        if (btn) btn.classList.remove('active');
        return;
    }

    var layer;
    var def = SAT_LAYERS[id];
    if (def.type === 'radar') {
        layer = L.tileLayer(
            'https://tilecache.rainviewer.com/v2/radar/nowcast/{z}/{x}/{y}/2/1_1.png',
            { opacity: 0.55, attribution: '© RainViewer', maxZoom: 15 }
        );
    } else if (def.type === 'infrared') {
        layer = L.tileLayer(
            'https://tilecache.rainviewer.com/v2/satellite/infrared/{z}/{x}/{y}/0/1_1.png',
            { opacity: 0.6, attribution: '© RainViewer', maxZoom: 12 }
        );
    } else if (def.type === 'vapor') {
        layer = L.tileLayer(
            'https://tilecache.rainviewer.com/v2/satellite/vapor/{z}/{x}/{y}/0/1_1.png',
            { opacity: 0.6, attribution: '© RainViewer', maxZoom: 12 }
        );
    }
    if (layer) {
        layer.addTo(window.leafletMap);
        activeLayers[id] = layer;
        if (btn) btn.classList.add('active');
    }
}

// ========== PINS DE ALERTAS (SIEMPRE VISIBLES) ==========
function getAlertColor(alert) {
    var t = (alert.type || '').toUpperCase();
    if (t.includes('TSUNAMI'))    return { color: '#0000ff', emoji: '🌊' };
    if (t.includes('HURACÁN') || t.includes('CICLÓN')) return { color: '#9900ff', emoji: '🌀' };
    if (t.includes('VOLCÁN'))     return { color: '#ff6600', emoji: '🌋' };
    if (t.includes('SISMO'))      return { color: alert.magnitude >= 5 ? '#ff0000' : alert.magnitude >= 4 ? '#ff6600' : '#ffaa00', emoji: '🔴' };
    if (t.includes('INCENDIO'))   return { color: '#ff3300', emoji: '🔥' };
    if (t.includes('TORMENTA'))   return { color: '#ffcc00', emoji: '⛈️' };
    if (t.includes('INUNDACIÓN')) return { color: '#0088ff', emoji: '💧' };
    return { color: '#aaaaaa', emoji: '⚠️' };
}

function renderAlertPins(alerts) {
    if (!window.leafletMap) return;
    // Limpiar pins anteriores
    alertPins.forEach(function(m) { window.leafletMap.removeLayer(m); });
    alertPins = [];

    (alerts || []).forEach(function(a) {
        if (a.lat == null || a.lon == null) return;
        var ci    = getAlertColor(a);
        var mag   = a.magnitude;
        var size  = mag >= 6 ? 20 : mag >= 4 ? 14 : a.priority >= 80 ? 14 : 10;
        var pulse = a.priority >= 90 ? 'animation:alertPulse 1.2s infinite;' : '';

        var icon = L.divIcon({
            html: '<div style="' +
                'width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
                'background:' + ci.color + ';border:2px solid rgba(255,255,255,0.8);' +
                'box-shadow:0 0 6px ' + ci.color + ';' + pulse +
            '"></div>',
            className: '',
            iconSize:   [size + 4, size + 4],
            iconAnchor: [(size + 4) / 2, (size + 4) / 2]
        });

        var mag_str = mag ? ' M' + mag.toFixed(1) : '';
        var popup = '' +
            '<div style="min-width:170px;font-size:13px;">' +
            '<b>' + ci.emoji + ' ' + (a.title || a.type) + mag_str + '</b>' +
            '<hr style="border-color:#ddd;margin:5px 0;">' +
            (a.description ? '<div>' + a.description + '</div>' : '') +
            (a.distKm ? '<div style="color:#777;font-size:11px;margin-top:4px;">📍 ' + a.distKm + ' km</div>' : '') +
            '<div style="color:#777;font-size:11px;">📡 ' + (a.source || '') + '</div>' +
            '<div style="color:#777;font-size:11px;">🕐 ' + (a.time || '') + '</div>' +
            (a.link ? '<br><a href="' + a.link + '" target="_blank" style="color:#4a9eff;font-size:11px;">Ver más →</a>' : '') +
            '</div>';

        var marker = L.marker([a.lat, a.lon], { icon: icon }).bindPopup(popup);
        marker.addTo(window.leafletMap);
        alertPins.push(marker);
    });
}

// ========== CLICK EN MAPA → POPUP CON DATOS ==========
function onMapClick(e) {
    var hasActive = Object.keys(activeLayers).some(function(id) {
        return MET_LAYERS[id] && MET_LAYERS[id].owm;
    });
    if (!hasActive) return;

    var lat = e.latlng.lat.toFixed(4);
    var lon = e.latlng.lng.toFixed(4);

    fetch('https://api.openweathermap.org/data/2.5/weather?lat=' + lat +
          '&lon=' + lon + '&appid=' + OWM_KEY + '&units=metric&lang=es')
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (!d || !d.main) return;
            var lines = [];
            if (activeLayers['temp'])     lines.push('🌡️ Temperatura: <b>' + Math.round(d.main.temp) + '°C</b> (sensación ' + Math.round(d.main.feels_like) + '°C)');
            if (activeLayers['rain'])     lines.push('🌧️ Lluvia: <b>' + ((d.rain && d.rain['1h']) || 0) + ' mm/h</b>');
            if (activeLayers['wind'])     lines.push('💨 Viento: <b>' + Math.round((d.wind && d.wind.speed || 0) * 3.6) + ' km/h</b>' + (d.wind && d.wind.gust ? ' (ráfagas ' + Math.round(d.wind.gust * 3.6) + ')' : ''));
            if (activeLayers['clouds'])   lines.push('☁️ Nubes: <b>' + ((d.clouds && d.clouds.all) || 0) + '%</b>');
            if (activeLayers['pressure']) lines.push('📊 Presión: <b>' + d.main.pressure + ' hPa</b>');
            if (activeLayers['humidity']) lines.push('💦 Humedad: <b>' + d.main.humidity + '%</b>');
            if (!lines.length) return;

            var pop = document.getElementById('mlValuePop');
            if (!pop) return;
            var city = d.name ? d.name + (d.sys && d.sys.country ? ', ' + d.sys.country : '') : lat + ', ' + lon;
            pop.innerHTML = '<div class="pop-title">' + city + '</div>' + lines.join('<br>');
            pop.style.display = 'block';

            var pt   = window.leafletMap.latLngToContainerPoint(e.latlng);
            var rect = document.getElementById('map').getBoundingClientRect();
            var px   = rect.left + pt.x + 14;
            var py   = rect.top  + pt.y - 20;
            if (px + 220 > window.innerWidth)  px = px - 240;
            if (py < rect.top + 60)            py = rect.top + 60;
            pop.style.left = px + 'px';
            pop.style.top  = py + 'px';
            setTimeout(function() { pop.style.display = 'none'; }, 5000);
        })
        .catch(function() {});
}

// ========== POPUP FLOTANTE ==========
function createValuePopup() {
    if (document.getElementById('mlValuePop')) return;
    var pop = document.createElement('div');
    pop.id = 'mlValuePop';
    document.body.appendChild(pop);
}

// ========== INIT ==========
window.initMapLayers = function() {
    if (mapLayersInitialized || !window.leafletMap) return;
    injectCSS();
    createBar();
    createValuePopup();
    window.leafletMap.on('click', onMapClick);

    // Mostrar pins al cargar las alertas
    if (window.externalAlerts && window.externalAlerts.length) {
        renderAlertPins(window.externalAlerts);
    }

    // Escuchar actualizaciones de alertas
    var _orig = window.updateMapMarkers;
    window.updateMapMarkers = function(alerts) {
        if (_orig) _orig(alerts);
        renderAlertPins(alerts);
    };

    mapLayersInitialized = true;
    console.log('✅ Capas del mapa inicializadas');
};

// Exponer renderAlertPins para que app.js lo llame
window.renderAlertPins = renderAlertPins;

// Esperar mapa
var _wait = setInterval(function() {
    if (window.leafletMap && window.mapInitialized) {
        clearInterval(_wait);
        setTimeout(window.initMapLayers, 400);
    }
}, 500);
