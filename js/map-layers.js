// ============================================
// js/map-layers.js — Capas interactivas del mapa
// Meteorología, Satélite, Alertas con pins
// ============================================

var OWM_KEY = '6fe6e0dcca264864dbd631bf620aad64';
var activeLayers = {};
var layerControl = null;
var mapLayersInitialized = false;

// ========== DEFINICIÓN DE CAPAS ==========
var CAPAS = {
    // METEOROLOGÍA (OpenWeatherMap tiles)
    temperatura:    { label: '🌡️ Temperatura',       owm: 'temp_new',         color: '#FF6B35' },
    lluvia:         { label: '🌧️ Lluvia',             owm: 'precipitation_new', color: '#4169E1' },
    nubes:          { label: '☁️ Nubosidad',          owm: 'clouds_new',        color: '#87CEEB' },
    viento:         { label: '💨 Viento',             owm: 'wind_new',          color: '#00CED1' },
    presion:        { label: '📊 Presión',            owm: 'pressure_new',      color: '#9B59B6' },

    // SATÉLITE (RainViewer)
    radar:          { label: '📡 Radar Lluvia',       type: 'radar' },
    satelite:       { label: '🛰️ Satélite',          type: 'satellite' },
};

// ========== CREAR CAPA OWM ==========
function createOWMLayer(layerName) {
    return L.tileLayer(
        'https://tile.openweathermap.org/map/' + layerName + '/{z}/{x}/{y}.png?appid=' + OWM_KEY,
        { opacity: 0.6, attribution: '© OpenWeatherMap', maxZoom: 20 }
    );
}

// ========== CREAR CAPA RADAR (RainViewer) ==========
function createRadarLayer() {
    // RainViewer es gratuito y sin CORS
    return L.tileLayer(
        'https://tilecache.rainviewer.com/v2/radar/nowcast/{z}/{x}/{y}/2/1_1.png',
        { opacity: 0.5, attribution: '© RainViewer', maxZoom: 15 }
    );
}

// ========== PANEL DE CAPAS ==========
function createLayerPanel() {
    var existing = document.getElementById('mapLayerPanel');
    if (existing) return;

    var panel = document.createElement('div');
    panel.id = 'mapLayerPanel';
    panel.style.cssText = [
        'position:absolute',
        'top:10px',
        'right:10px',
        'z-index:1000',
        'background:rgba(0,0,0,0.85)',
        'border:1px solid #444',
        'border-radius:8px',
        'padding:8px',
        'min-width:170px',
        'font-size:12px',
        'color:#fff',
        'box-shadow:0 2px 8px rgba(0,0,0,0.5)'
    ].join(';');

    panel.innerHTML = [
        '<div style="font-weight:700;margin-bottom:8px;color:#ff6666;font-size:13px;">🗺️ Capas</div>',

        '<div style="color:#aaa;font-size:10px;margin-bottom:4px;text-transform:uppercase;">Meteorología</div>',
        btn('temperatura', '🌡️ Temperatura'),
        btn('lluvia',      '🌧️ Lluvia'),
        btn('nubes',       '☁️ Nubosidad'),
        btn('viento',      '💨 Viento'),
        btn('presion',     '📊 Presión'),

        '<div style="color:#aaa;font-size:10px;margin:8px 0 4px;text-transform:uppercase;">Satélite / Radar</div>',
        btn('radar',       '📡 Radar Lluvia'),
        btn('satelite',    '🛰️ Satélite'),

        '<div style="color:#aaa;font-size:10px;margin:8px 0 4px;text-transform:uppercase;">Alertas</div>',
        btn('sismos',      '🔴 Sismos'),
        btn('volcanes',    '🌋 Volcanes'),
        btn('tormentas',   '⛈️ Tormentas'),

        '<div style="margin-top:8px;border-top:1px solid #444;padding-top:6px;">',
        '<button onclick="clearAllLayers()" style="width:100%;padding:4px;background:#333;border:1px solid #555;color:#ccc;border-radius:4px;cursor:pointer;font-size:11px;">✕ Limpiar capas</button>',
        '</div>'
    ].join('');

    function btn(id, label) {
        return '<div id="layer-btn-' + id + '" onclick="toggleLayer(\'' + id + '\')" style="' +
            'padding:5px 8px;margin:2px 0;border-radius:4px;cursor:pointer;' +
            'border:1px solid #444;background:#222;transition:all 0.2s;' +
            'display:flex;align-items:center;gap:6px;' +
        '">' + label + '</div>';
    }

    // Agregar al contenedor del mapa
    var mapEl = document.getElementById('map');
    if (mapEl) {
        mapEl.style.position = 'relative';
        mapEl.appendChild(panel);
    }
}

// ========== TOGGLE CAPA ==========
window.toggleLayer = function(id) {
    if (!window.leafletMap) return;

    var btnEl = document.getElementById('layer-btn-' + id);

    if (activeLayers[id]) {
        // Apagar
        window.leafletMap.removeLayer(activeLayers[id]);
        delete activeLayers[id];
        if (btnEl) {
            btnEl.style.background = '#222';
            btnEl.style.borderColor = '#444';
            btnEl.style.color = '#fff';
        }
        return;
    }

    // Encender
    var layer = null;

    if (id === 'temperatura') layer = createOWMLayer('temp_new');
    else if (id === 'lluvia')  layer = createOWMLayer('precipitation_new');
    else if (id === 'nubes')   layer = createOWMLayer('clouds_new');
    else if (id === 'viento')  layer = createOWMLayer('wind_new');
    else if (id === 'presion') layer = createOWMLayer('pressure_new');
    else if (id === 'radar')   layer = createRadarLayer();
    else if (id === 'satelite') layer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { opacity: 0.7, attribution: '© Esri', maxZoom: 19 }
    );
    else if (id === 'sismos')    { toggleAlertLayer('sismos');   return; }
    else if (id === 'volcanes')  { toggleAlertLayer('volcanes'); return; }
    else if (id === 'tormentas') { toggleAlertLayer('tormentas'); return; }

    if (layer) {
        layer.addTo(window.leafletMap);
        activeLayers[id] = layer;
        if (btnEl) {
            btnEl.style.background = '#ff6666';
            btnEl.style.borderColor = '#ff4444';
            btnEl.style.color = '#000';
        }
    }
};

// ========== CAPAS DE ALERTAS EN MAPA ==========
var alertLayerMarkers = {};

window.toggleAlertLayer = function(type) {
    if (!window.leafletMap) return;
    var btnEl = document.getElementById('layer-btn-' + type);

    if (alertLayerMarkers[type]) {
        alertLayerMarkers[type].forEach(function(m) { window.leafletMap.removeLayer(m); });
        delete alertLayerMarkers[type];
        if (btnEl) { btnEl.style.background = '#222'; btnEl.style.borderColor = '#444'; btnEl.style.color = '#fff'; }
        return;
    }

    var alerts = window.externalAlerts || [];
    var filtered = alerts.filter(function(a) {
        var t = (a.type || '').toUpperCase();
        if (type === 'sismos')    return t.includes('SISMO');
        if (type === 'volcanes')  return t.includes('VOLCÁN') || t.includes('ERUPCIÓN');
        if (type === 'tormentas') return t.includes('TORMENTA') || t.includes('VIENTO') || t.includes('LLUVIA');
        return false;
    });

    alertLayerMarkers[type] = [];

    filtered.forEach(function(a) {
        if (a.lat == null || a.lon == null) return;

        var color = a.priority >= 90 ? '#ff0000' :
                    a.priority >= 70 ? '#ff6600' :
                    a.priority >= 50 ? '#ffaa00' : '#44aa44';

        var icon = L.divIcon({
            html: '<div style="' +
                'background:' + color + ';' +
                'width:' + (a.priority >= 80 ? 18 : 12) + 'px;' +
                'height:' + (a.priority >= 80 ? 18 : 12) + 'px;' +
                'border-radius:50%;' +
                'border:2px solid #fff;' +
                'box-shadow:0 0 6px ' + color + ';' +
                (a.priority >= 90 ? 'animation:pulse 1.5s infinite;' : '') +
            '"></div>',
            className: '',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        var marker = L.marker([a.lat, a.lon], { icon: icon });

        var popupContent = [
            '<div style="min-width:180px;font-family:sans-serif;">',
            '<b style="font-size:14px;">' + (a.icon || '⚠️') + ' ' + (a.title || a.type) + '</b>',
            '<hr style="border:1px solid #ddd;margin:6px 0;">',
            '<div>' + (a.description || '') + '</div>',
            a.magnitude ? '<div>📏 <b>M' + a.magnitude.toFixed(1) + '</b></div>' : '',
            a.distKm    ? '<div>📍 ' + a.distKm + ' km de distancia</div>' : '',
            '<div style="font-size:11px;color:#888;margin-top:4px;">📡 ' + (a.source || '') + '</div>',
            '<div style="font-size:11px;color:#888;">🕐 ' + (a.time || '') + '</div>',
            a.link ? '<div style="margin-top:6px;"><a href="' + a.link + '" target="_blank" style="color:#4169E1;">Ver más →</a></div>' : '',
            '</div>'
        ].join('');

        marker.bindPopup(popupContent);
        marker.addTo(window.leafletMap);
        alertLayerMarkers[type].push(marker);
    });

    if (btnEl) {
        btnEl.style.background = '#ff6666';
        btnEl.style.borderColor = '#ff4444';
        btnEl.style.color = '#000';
    }
};

// ========== LIMPIAR TODAS LAS CAPAS ==========
window.clearAllLayers = function() {
    Object.keys(activeLayers).forEach(function(id) {
        if (window.leafletMap) window.leafletMap.removeLayer(activeLayers[id]);
        var btnEl = document.getElementById('layer-btn-' + id);
        if (btnEl) { btnEl.style.background = '#222'; btnEl.style.borderColor = '#444'; btnEl.style.color = '#fff'; }
    });
    activeLayers = {};

    Object.keys(alertLayerMarkers).forEach(function(type) {
        alertLayerMarkers[type].forEach(function(m) { window.leafletMap.removeLayer(m); });
        var btnEl = document.getElementById('layer-btn-' + type);
        if (btnEl) { btnEl.style.background = '#222'; btnEl.style.borderColor = '#444'; btnEl.style.color = '#fff'; }
    });
    alertLayerMarkers = {};
};

// ========== INICIALIZAR (se llama cuando el mapa está listo) ==========
window.initMapLayers = function() {
    if (mapLayersInitialized || !window.leafletMap) return;
    createLayerPanel();
    mapLayersInitialized = true;
    console.log('✅ Capas del mapa inicializadas');
};

// Esperar a que el mapa esté listo
var _mapLayerWait = setInterval(function() {
    if (window.leafletMap && window.mapInitialized) {
        clearInterval(_mapLayerWait);
        window.initMapLayers();
    }
}, 500);
