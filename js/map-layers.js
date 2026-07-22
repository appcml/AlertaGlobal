// ============================================
// js/map-layers.js — Capas del mapa
// Barra horizontal con scroll
// ============================================

var OWM_KEY = '6fe6e0dcca264864dbd631bf620aad64';
var activeLayers = {};
var mapLayersInitialized = false;

var ALL_LAYERS = [
    // MAPAS BASE
    { id:'base_dark',  group:'BASE', label:'🌑', title:'Oscuro',    type:'base',
      url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr:'© CartoDB' },
    { id:'base_light', group:'BASE', label:'🌕', title:'Claro',     type:'base',
      url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr:'© OpenStreetMap' },
    { id:'base_sat',   group:'BASE', label:'🛰️',  title:'Satélite', type:'base',
      url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr:'© Esri' },
    { id:'base_topo',  group:'BASE', label:'⛰️', title:'Relieve',   type:'base',
      url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr:'© OpenTopoMap' },
    // METEOROLOGÍA
    { id:'temp',     group:'MET', label:'🌡️', title:'Temp',    type:'owm', owm:'temp_new',           opacity:0.70 },
    { id:'rain',     group:'MET', label:'🌧️', title:'Lluvia',  type:'owm', owm:'precipitation_new',  opacity:0.70 },
    { id:'wind',     group:'MET', label:'💨', title:'Viento',  type:'owm', owm:'wind_new',            opacity:0.65 },
    { id:'clouds',   group:'MET', label:'☁️', title:'Nubes',   type:'owm', owm:'clouds_new',          opacity:0.60 },
    { id:'pressure', group:'MET', label:'📊', title:'Presión', type:'owm', owm:'pressure_new',        opacity:0.60 },
    { id:'humidity', group:'MET', label:'💦', title:'Humedad', type:'owm', owm:'humidity_new',        opacity:0.65 },
    // SATÉLITE / RADAR
    { id:'radar',    group:'SAT', label:'📡', title:'Radar',   type:'rainviewer', rv:'radar'    },
    { id:'infrared', group:'SAT', label:'🔴', title:'Infra',   type:'rainviewer', rv:'infrared' },
    { id:'vapor',    group:'SAT', label:'💧', title:'Vapor',   type:'rainviewer', rv:'vapor'    },
];

var BASE_LAYER_OBJ = null;

function injectCSS() {
    if (document.getElementById('ml-css')) return;
    var s = document.createElement('style');
    s.id = 'ml-css';
    s.textContent = `
        #mlBar {
            position: absolute;
            top: 0; left: 0; right: 0;
            z-index: 1000;
            background: rgba(8,8,18,0.95);
            border-bottom: 1px solid #222;
            display: flex;
            align-items: center;
            overflow-x: scroll;
            overflow-y: hidden;
            scrollbar-width: thin;
            scrollbar-color: #333 transparent;
            -webkit-overflow-scrolling: touch;
            padding: 2px 4px;
            gap: 0;
        }
        #mlBar::-webkit-scrollbar { height: 3px; }
        #mlBar::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
        .ml-sep {
            width: 1px; height: 36px;
            background: #2a2a3a;
            margin: 0 3px;
            flex-shrink: 0;
        }
        .ml-group-lbl {
            font-size: 7px; color: #444;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 0 3px 0 4px;
            flex-shrink: 0;
            white-space: nowrap;
        }
        .ml-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-width: 40px;
            height: 50px;
            padding: 2px 3px 0;
            border-radius: 5px;
            border: 1px solid transparent;
            background: transparent;
            color: #bbb;
            cursor: pointer;
            font-size: 17px;
            flex-shrink: 0;
            transition: all 0.15s;
            position: relative;
        }
        .ml-btn span {
            font-size: 7px; color: #555;
            white-space: nowrap;
            margin-top: 1px;
            line-height: 1;
        }
        .ml-btn:hover  { background:rgba(255,255,255,0.07); border-color:#444; }
        .ml-btn:hover span { color:#999; }
        .ml-btn.on     { background:rgba(80,160,255,0.18); border-color:#4a9eff; }
        .ml-btn.on span { color:#7bbfff; }
        .ml-btn.base-on { background:rgba(60,220,100,0.15); border-color:#3dcc66; }
        .ml-btn.base-on span { color:#66dd99; }
        #mlValuePop {
            position: fixed;
            background: rgba(5,5,15,0.95);
            color: #fff;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 12px;
            z-index: 9999;
            border: 1px solid #333;
            pointer-events: none;
            display: none;
            line-height: 1.8;
            box-shadow: 0 4px 16px rgba(0,0,0,0.6);
            max-width: 230px;
        }
        #mlValuePop b { font-size:13px; display:block; border-bottom:1px solid #333; padding-bottom:4px; margin-bottom:4px; }
        @keyframes alertPulse {
            0%   { box-shadow: 0 0 0 0 rgba(255,50,50,0.8); }
            70%  { box-shadow: 0 0 0 10px rgba(255,50,50,0); }
            100% { box-shadow: 0 0 0 0 rgba(255,50,50,0); }
        }
    `;
    document.head.appendChild(s);
}

function createBar() {
    if (document.getElementById('mlBar')) return;
    var bar = document.createElement('div');
    bar.id = 'mlBar';

    var groups = ['BASE','MET','SAT'];
    var groupLabels = { BASE:'Base', MET:'Meteorología', SAT:'Satélite' };

    groups.forEach(function(g, gi) {
        var lbl = document.createElement('span');
        lbl.className = 'ml-group-lbl';
        lbl.textContent = groupLabels[g];
        bar.appendChild(lbl);

        ALL_LAYERS.filter(function(l){ return l.group===g; }).forEach(function(def) {
            var btn = document.createElement('button');
            btn.className = 'ml-btn' + (def.id==='base_dark' ? ' base-on' : '');
            btn.id = 'mlb-' + def.id;
            btn.title = def.title;
            btn.innerHTML = def.label + '<span>' + def.title + '</span>';
            btn.onclick = function(){ handleLayerClick(def.id); };
            bar.appendChild(btn);
        });

        if (gi < groups.length-1) {
            var sep = document.createElement('div');
            sep.className = 'ml-sep';
            bar.appendChild(sep);
        }
    });

    var mapEl = document.getElementById('map');
    if (mapEl) {
        mapEl.style.position = 'relative';
        mapEl.insertBefore(bar, mapEl.firstChild);
        setTimeout(function(){ if(window.leafletMap) window.leafletMap.invalidateSize(); }, 200);
    }

    // Popup de valor
    var pop = document.createElement('div');
    pop.id = 'mlValuePop';
    document.body.appendChild(pop);
}

function handleLayerClick(id) {
    var def = ALL_LAYERS.find(function(l){ return l.id===id; });
    if (!def) return;
    if (def.type === 'base') { switchBase(id); return; }
    if (activeLayers[id])   { removeLayer(id); return; }
    addLayer(def);
}

function switchBase(id) {
    if (!window.leafletMap) return;
    if (BASE_LAYER_OBJ) { window.leafletMap.removeLayer(BASE_LAYER_OBJ); BASE_LAYER_OBJ=null; }
    var def = ALL_LAYERS.find(function(l){ return l.id===id; });
    BASE_LAYER_OBJ = L.tileLayer(def.url, { attribution:def.attr, maxZoom:20 });
    BASE_LAYER_OBJ.addTo(window.leafletMap);
    BASE_LAYER_OBJ.bringToBack();
    ALL_LAYERS.filter(function(l){ return l.type==='base'; }).forEach(function(l){
        var b=document.getElementById('mlb-'+l.id);
        if(b) b.className='ml-btn'+(l.id===id?' base-on':'');
    });
}

function addLayer(def) {
    if (!window.leafletMap) return;
    var layer;
    if (def.type==='owm') {
        layer = L.tileLayer(
            'https://tile.openweathermap.org/map/'+def.owm+'/{z}/{x}/{y}.png?appid='+OWM_KEY,
            { opacity:def.opacity||0.65, attribution:'© OpenWeatherMap', maxZoom:20 }
        );
    } else if (def.type==='rainviewer') {
        var urls = {
            radar:    'https://tilecache.rainviewer.com/v2/radar/nowcast/{z}/{x}/{y}/2/1_1.png',
            infrared: 'https://tilecache.rainviewer.com/v2/satellite/infrared/{z}/{x}/{y}/0/1_1.png',
            vapor:    'https://tilecache.rainviewer.com/v2/satellite/vapor/{z}/{x}/{y}/0/1_1.png'
        };
        layer = L.tileLayer(urls[def.rv], { opacity:0.55, attribution:'© RainViewer', maxZoom:15 });
    }
    if (layer) {
        layer.addTo(window.leafletMap);
        activeLayers[def.id] = layer;
        var b=document.getElementById('mlb-'+def.id);
        if(b) b.classList.add('on');
    }
}

function removeLayer(id) {
    if (activeLayers[id]) {
        window.leafletMap.removeLayer(activeLayers[id]);
        delete activeLayers[id];
        var b=document.getElementById('mlb-'+id);
        if(b) b.classList.remove('on');
    }
}

// ========== CLICK EN MAPA → POPUP ==========
function onMapClick(e) {
    var hasOWM = Object.keys(activeLayers).some(function(id){
        var d=ALL_LAYERS.find(function(l){return l.id===id;});
        return d && d.type==='owm';
    });
    if (!hasOWM) return;

    var lat=e.latlng.lat.toFixed(4), lon=e.latlng.lng.toFixed(4);
    fetch('https://api.openweathermap.org/data/2.5/weather?lat='+lat+'&lon='+lon+'&appid='+OWM_KEY+'&units=metric&lang=es')
        .then(function(r){return r.json();})
        .then(function(d){
            if(!d||!d.main) return;
            var lines=[];
            if(activeLayers['temp'])     lines.push('🌡️ <b>'+Math.round(d.main.temp)+'°C</b> (sens. '+Math.round(d.main.feels_like)+'°C)');
            if(activeLayers['rain'])     lines.push('🌧️ <b>'+((d.rain&&d.rain['1h'])||0)+' mm/h</b>');
            if(activeLayers['wind'])     lines.push('💨 <b>'+Math.round((d.wind&&d.wind.speed||0)*3.6)+' km/h</b>'+(d.wind&&d.wind.gust?' ráf. '+Math.round(d.wind.gust*3.6):''));
            if(activeLayers['clouds'])   lines.push('☁️ <b>'+((d.clouds&&d.clouds.all)||0)+'%</b>');
            if(activeLayers['pressure']) lines.push('📊 <b>'+d.main.pressure+' hPa</b>');
            if(activeLayers['humidity']) lines.push('💦 <b>'+d.main.humidity+'%</b>');
            if(!lines.length) return;

            var pop=document.getElementById('mlValuePop');
            if(!pop) return;
            var city=d.name+(d.sys&&d.sys.country?', '+d.sys.country:'');
            pop.innerHTML='<b>'+city+'</b>'+lines.join('<br>');
            pop.style.display='block';

            var pt=window.leafletMap.latLngToContainerPoint(e.latlng);
            var rect=document.getElementById('map').getBoundingClientRect();
            var px=rect.left+pt.x+14, py=rect.top+pt.y-20;
            if(px+240>window.innerWidth) px=px-250;
            if(py<rect.top+60) py=rect.top+60;
            pop.style.left=px+'px'; pop.style.top=py+'px';
            setTimeout(function(){pop.style.display='none';},5000);
        }).catch(function(){});
}

// ========== INIT ==========
window.initMapLayers = function() {
    if (mapLayersInitialized||!window.leafletMap) return;
    injectCSS();
    createBar();
    window.leafletMap.on('click', onMapClick);
    mapLayersInitialized = true;
    console.log('✅ Capas del mapa inicializadas');
};

var _w = setInterval(function(){
    if (window.leafletMap && window.mapInitialized) {
        clearInterval(_w);
        setTimeout(window.initMapLayers, 400);
    }
}, 500);
