// ============================================
// js/map-layers.js — Capas del mapa v4
// ============================================

var OWM_KEY = '6fe6e0dcca264864dbd631bf620aad64';
var activeLayers = {};
var currentBaseLayer = null;
var mapLayersInitialized = false;

// Tiles que funcionan sin restricciones
var BASE_TILES = {
    dark:  { label:'🌑', title:'Oscuro',   url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',     attr:'© CartoDB' },
    light: { label:'🌕', title:'Claro',    url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                attr:'© OSM' },
    sat:   { label:'🛰️',  title:'Satélite', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr:'© Esri' },
    topo:  { label:'⛰️', title:'Relieve',  url:'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',            attr:'© OSM France' },
};

var MET_TILES = {
    temp:     { label:'🌡️', title:'Temp',    owm:'temp_new',           op:0.85 },
    rain:     { label:'🌧️', title:'Lluvia',  owm:'precipitation_new',  op:0.85 },
    wind:     { label:'💨', title:'Viento',  owm:'wind_new',            op:0.80 },
    clouds:   { label:'☁️', title:'Nubes',   owm:'clouds_new',          op:0.75 },
    pressure: { label:'📊', title:'Presión', owm:'pressure_new',        op:0.75 },
    humidity: { label:'💦', title:'Humedad', owm:'humidity_new',        op:0.80 },
};

// Solo radar funciona bien en RainViewer sin restricción de zoom
var SAT_TILES = {
    radar: { label:'📡', title:'Radar', url:'https://tilecache.rainviewer.com/v2/radar/nowcast/{z}/{x}/{y}/2/1_1.png', op:0.55, maxZ:20 },
    sat2:  { label:'🌍', title:'Esri',  url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', op:0.75, maxZ:20 },
};

function injectCSS() {
    if (document.getElementById('ml-css')) return;
    var s = document.createElement('style');
    s.id = 'ml-css';
    s.textContent = `
        #mlBar {
            position: absolute;
            top: 0; left: 0; right: 0;
            z-index: 1001;
            background: rgba(6,6,16,0.96);
            border-bottom: 1px solid #1e1e2e;
            display: flex;
            align-items: center;
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: thin;
            scrollbar-color: #333 transparent;
            padding: 2px 6px;
            gap: 1px;
            -webkit-overflow-scrolling: touch;
        }
        #mlBar::-webkit-scrollbar { height: 3px; }
        #mlBar::-webkit-scrollbar-thumb { background: #444; }
        .ml-sep { width:1px; height:34px; background:#222; margin:0 4px; flex-shrink:0; }
        .ml-lbl { font-size:7px; color:#3a3a5a; text-transform:uppercase; padding:0 4px; flex-shrink:0; letter-spacing:.5px; }
        .ml-btn {
            display:flex; flex-direction:column; align-items:center; justify-content:center;
            min-width:38px; height:48px; padding:1px 2px 0;
            border-radius:5px; border:1px solid transparent;
            background:transparent; color:#aaa; cursor:pointer;
            font-size:16px; flex-shrink:0; transition:all .12s;
        }
        .ml-btn span { font-size:7px; color:#444; white-space:nowrap; margin-top:1px; line-height:1; }
        .ml-btn:hover { background:rgba(255,255,255,.07); border-color:#333; color:#ddd; }
        .ml-btn:hover span { color:#888; }
        .ml-btn.on-base { background:rgba(60,220,100,.15); border-color:#3dcc66; }
        .ml-btn.on-base span { color:#5ddd88; }
        .ml-btn.on-met  { background:rgba(80,160,255,.18); border-color:#4a9eff; }
        .ml-btn.on-met span { color:#7bbfff; }
        .ml-btn.on-sat  { background:rgba(180,100,255,.18); border-color:#c07fff; }
        .ml-btn.on-sat span { color:#d4a0ff; }
        #mlPop {
            position:fixed; background:rgba(4,4,14,.96); color:#fff;
            padding:8px 12px; border-radius:8px; font-size:12px;
            z-index:9999; border:1px solid #2a2a3a; pointer-events:none;
            display:none; line-height:1.8; box-shadow:0 4px 18px rgba(0,0,0,.7);
            max-width:220px;
        }
        #mlPop .pt { font-size:13px; font-weight:700; border-bottom:1px solid #333; padding-bottom:3px; margin-bottom:4px; }
    `;
    document.head.appendChild(s);
}

function mkBtn(id, emoji, title, cls, onclick) {
    var b = document.createElement('button');
    b.className = 'ml-btn ' + (cls||'');
    b.id = 'mlb-' + id;
    b.title = title;
    b.innerHTML = emoji + '<span>' + title + '</span>';
    b.onclick = onclick;
    return b;
}

function sep() { var d=document.createElement('div'); d.className='ml-sep'; return d; }
function lbl(t) { var s=document.createElement('span'); s.className='ml-lbl'; s.textContent=t; return s; }

function createBar() {
    if (document.getElementById('mlBar')) return;
    var bar = document.createElement('div');
    bar.id = 'mlBar';

    // BASE
    bar.appendChild(lbl('Base'));
    Object.keys(BASE_TILES).forEach(function(id) {
        var d = BASE_TILES[id];
        bar.appendChild(mkBtn(id, d.label, d.title, id==='dark'?'on-base':'', function(){ switchBase(this.id.replace('mlb-',''));}.bind({id:'mlb-'+id})));
    });

    bar.appendChild(sep());

    // MET
    bar.appendChild(lbl('Met'));
    Object.keys(MET_TILES).forEach(function(id) {
        var d = MET_TILES[id];
        bar.appendChild(mkBtn(id, d.label, d.title, '', function(){ toggleMet(this.id.replace('mlb-',''));}.bind({id:'mlb-'+id})));
    });

    bar.appendChild(sep());

    // SAT
    bar.appendChild(lbl('Sat'));
    Object.keys(SAT_TILES).forEach(function(id) {
        var d = SAT_TILES[id];
        bar.appendChild(mkBtn(id, d.label, d.title, '', function(){ toggleSat(this.id.replace('mlb-',''));}.bind({id:'mlb-'+id})));
    });

    var mapEl = document.getElementById('map');
    if (mapEl) {
        mapEl.style.position = 'relative';
        mapEl.insertBefore(bar, mapEl.firstChild);
        setTimeout(function(){ if(window.leafletMap) window.leafletMap.invalidateSize(); }, 300);
    }

    var pop = document.createElement('div');
    pop.id = 'mlPop';
    document.body.appendChild(pop);
}

// ========== CAMBIAR MAPA BASE ==========
function switchBase(id) {
    if (!window.leafletMap) return;

    // Quitar base actual
    if (currentBaseLayer) {
        window.leafletMap.removeLayer(currentBaseLayer);
        currentBaseLayer = null;
    }

    // También quitar cualquier TileLayer existente que sea base
    window.leafletMap.eachLayer(function(layer) {
        if (layer instanceof L.TileLayer && layer._isBase) {
            window.leafletMap.removeLayer(layer);
        }
    });

    var d = BASE_TILES[id];
    currentBaseLayer = L.tileLayer(d.url, { attribution: d.attr, maxZoom: 20, zIndex: 1 });
    currentBaseLayer._isBase = true;
    currentBaseLayer.addTo(window.leafletMap);
    currentBaseLayer.bringToBack();

    // Actualizar botones
    Object.keys(BASE_TILES).forEach(function(k) {
        var b = document.getElementById('mlb-' + k);
        if (b) b.className = 'ml-btn' + (k === id ? ' on-base' : '');
    });
}

// ========== CAPAS METEOROLÓGICAS ==========
function toggleMet(id) {
    if (!window.leafletMap) return;
    var b = document.getElementById('mlb-' + id);
    if (activeLayers[id]) {
        window.leafletMap.removeLayer(activeLayers[id]);
        delete activeLayers[id];
        if (b) b.className = 'ml-btn';
        return;
    }
    var d = MET_TILES[id];
    var layer = L.tileLayer(
        'https://tile.openweathermap.org/map/' + d.owm + '/{z}/{x}/{y}.png?appid=' + OWM_KEY,
        { opacity: d.op, attribution: '© OpenWeatherMap', maxZoom: 20, zIndex: 5 }
    );
    layer.addTo(window.leafletMap);
    activeLayers[id] = layer;
    if (b) b.className = 'ml-btn on-met';
}

// ========== CAPAS SATÉLITE ==========
function toggleSat(id) {
    if (!window.leafletMap) return;
    var b = document.getElementById('mlb-' + id);
    if (activeLayers[id]) {
        window.leafletMap.removeLayer(activeLayers[id]);
        delete activeLayers[id];
        if (b) b.className = 'ml-btn';
        return;
    }
    var d = SAT_TILES[id];
    var layer = L.tileLayer(d.url, {
        opacity: d.op, attribution: '© RainViewer / Esri',
        maxZoom: d.maxZ || 20, minZoom: 2, zIndex: 4
    });
    layer.addTo(window.leafletMap);
    activeLayers[id] = layer;
    if (b) b.className = 'ml-btn on-sat';
}

// ========== CLICK → DATOS EN EL PUNTO ==========
function onMapClick(e) {
    var hasMet = Object.keys(activeLayers).some(function(id){ return MET_TILES[id]; });
    if (!hasMet) return;

    var lat = e.latlng.lat.toFixed(4), lon = e.latlng.lng.toFixed(4);
    fetch('https://api.openweathermap.org/data/2.5/weather?lat='+lat+'&lon='+lon+
          '&appid='+OWM_KEY+'&units=metric&lang=es')
        .then(function(r){ return r.json(); })
        .then(function(d) {
            if (!d || !d.main) return;
            var lines = [];
            if (activeLayers['temp'])     lines.push('🌡️ <b>'+Math.round(d.main.temp)+'°C</b> (sens. '+Math.round(d.main.feels_like)+'°C)');
            if (activeLayers['rain'])     lines.push('🌧️ <b>'+((d.rain&&d.rain['1h'])||0)+' mm/h</b>');
            if (activeLayers['wind'])     lines.push('💨 <b>'+Math.round((d.wind&&d.wind.speed||0)*3.6)+' km/h</b>'+(d.wind&&d.wind.gust?' ráf.'+Math.round(d.wind.gust*3.6):''));
            if (activeLayers['clouds'])   lines.push('☁️ <b>'+((d.clouds&&d.clouds.all)||0)+'%</b>');
            if (activeLayers['pressure']) lines.push('📊 <b>'+d.main.pressure+' hPa</b>');
            if (activeLayers['humidity']) lines.push('💦 <b>'+d.main.humidity+'%</b>');
            if (!lines.length) return;

            var pop = document.getElementById('mlPop');
            if (!pop) return;
            var city = d.name + (d.sys&&d.sys.country ? ', '+d.sys.country : '');
            pop.innerHTML = '<div class="pt">'+city+'</div>' + lines.join('<br>');
            pop.style.display = 'block';

            var pt = window.leafletMap.latLngToContainerPoint(e.latlng);
            var rect = document.getElementById('map').getBoundingClientRect();
            var px = rect.left + pt.x + 14;
            var py = rect.top  + pt.y - 20;
            if (px + 230 > window.innerWidth) px -= 240;
            if (py < rect.top + 55) py = rect.top + 55;
            pop.style.left = px + 'px';
            pop.style.top  = py + 'px';
            setTimeout(function(){ pop.style.display='none'; }, 5000);
        }).catch(function(){});
}

// ========== INIT ==========
window.initMapLayers = function() {
    if (mapLayersInitialized || !window.leafletMap) return;
    injectCSS();
    createBar();

    // Capturar la capa base que puso app.js al init
    window.leafletMap.eachLayer(function(layer) {
        if (layer instanceof L.TileLayer) {
            layer._isBase = true;
            currentBaseLayer = layer;
        }
    });

    window.leafletMap.on('click', onMapClick);
    mapLayersInitialized = true;
    console.log('✅ Capas del mapa v4 inicializadas');
};

var _w = setInterval(function() {
    if (window.leafletMap && window.mapInitialized) {
        clearInterval(_w);
        setTimeout(window.initMapLayers, 500);
    }
}, 500);
