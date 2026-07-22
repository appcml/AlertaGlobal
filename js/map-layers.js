// ============================================
// js/map-layers.js v5 — Capas con colores vivos
// ============================================

var OWM_KEY = '6fe6e0dcca264864dbd631bf620aad64';
var activeLayers = {};
var currentBaseLayer = null;
var mapLayersInitialized = false;

// ── MAPAS BASE ──
var BASE = {
    dark:  { e:'🌑', t:'Oscuro',   url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', a:'© CartoDB' },
    light: { e:'🌕', t:'Claro',    url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', a:'© OSM' },
    sat:   { e:'🛰️',  t:'Satélite', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', a:'© Esri' },
    topo:  { e:'⛰️', t:'Relieve',  url:'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', a:'© OSM' },
};

// ── CAPAS METEOROLÓGICAS ──
// Usa OWM con opacidad alta + colorscale fuerte
var MET = {
    temp:     { e:'🌡️', t:'Temp',      owm:'temp_new',          op:0.9,  legend:'°C',  colors:'#0000ff,#00ffff,#00ff00,#ffff00,#ff6600,#ff0000' },
    rain:     { e:'🌧️', t:'Lluvia',    owm:'precipitation_new', op:0.9,  legend:'mm'  },
    wind:     { e:'💨', t:'Viento',    owm:'wind_new',          op:0.85, legend:'m/s' },
    clouds:   { e:'☁️', t:'Nubes',     owm:'clouds_new',        op:0.80, legend:'%'   },
    pressure: { e:'📊', t:'Presión',   owm:'pressure_new',      op:0.80, legend:'hPa' },
    humidity: { e:'💦', t:'Humedad',   owm:'humidity_new',      op:0.85, legend:'%'   },
    snow:     { e:'❄️', t:'Nieve/Frío',owm:'snow',              op:0.85, legend:'mm'  },
};

// ── CAPAS SATÉLITE/RADAR ──
var SAT = {
    radar:    { e:'📡', t:'Radar',    url:'https://tilecache.rainviewer.com/v2/radar/nowcast/{z}/{x}/{y}/2/1_1.png', op:0.65 },
    sat2:     { e:'🌍', t:'Esri',     url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', op:0.80 },
    topo2:    { e:'🗻', t:'Topo',     url:'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', op:0.90 },
};

// ── LEYENDAS DE COLOR ──
var LEGENDS = {
    temp:     { title:'Temperatura', stops:[ ['#0000aa',-40],['#0044ff',-20],['#00aaff',-10],['#00ffff',0],['#44ff44',10],['#ffff00',20],['#ff8800',30],['#ff0000',40] ], unit:'°C' },
    rain:     { title:'Lluvia', stops:[ ['#ffffff',0],['#aaddff',1],['#4499ff',5],['#0044ff',10],['#6600ff',25],['#ff00ff',50] ], unit:'mm/h' },
    wind:     { title:'Viento', stops:[ ['#ffffff',0],['#aaffaa',5],['#ffff00',10],['#ff8800',20],['#ff4400',30],['#aa0000',50] ], unit:'km/h' },
    humidity: { title:'Humedad', stops:[ ['#ffeecc',0],['#ffcc44',20],['#88dd44',40],['#00aaff',60],['#0044ff',80],['#0000aa',100] ], unit:'%' },
    pressure: { title:'Presión', stops:[ ['#ff8800',970],['#ffff00',990],['#aaffaa',1010],['#0088ff',1030],['#0000ff',1050] ], unit:'hPa' },
    snow:     { title:'Nieve/Frío', stops:[ ['#ffffff',0],['#ccddff',1],['#aaccff',5],['#6699ff',10],['#3366ff',20],['#0000ff',30] ], unit:'cm' },
};

function injectCSS() {
    if (document.getElementById('ml-css')) return;
    var s = document.createElement('style');
    s.id = 'ml-css';
    s.textContent = `
        #mlBar {
            position:absolute; top:0; left:0; right:0;
            z-index:1001;
            background:rgba(5,5,15,.95);
            border-bottom:1px solid #1a1a2a;
            display:flex; align-items:center;
            overflow-x:auto; overflow-y:hidden;
            scrollbar-width:thin; scrollbar-color:#333 transparent;
            padding:2px 6px; gap:1px;
            -webkit-overflow-scrolling:touch;
        }
        #mlBar::-webkit-scrollbar { height:3px; }
        #mlBar::-webkit-scrollbar-thumb { background:#444; }
        .ml-sep { width:1px; height:36px; background:#222; margin:0 4px; flex-shrink:0; }
        .ml-lbl { font-size:7px; color:#333; text-transform:uppercase; padding:0 3px; flex-shrink:0; letter-spacing:.5px; }
        .ml-btn {
            display:flex; flex-direction:column; align-items:center; justify-content:center;
            min-width:38px; height:48px; padding:1px 2px 0;
            border-radius:5px; border:1px solid transparent;
            background:transparent; color:#999; cursor:pointer;
            font-size:15px; flex-shrink:0; transition:all .12s;
        }
        .ml-btn span { font-size:7px; color:#444; white-space:nowrap; margin-top:1px; line-height:1; }
        .ml-btn:hover { background:rgba(255,255,255,.06); border-color:#333; color:#ddd; }
        .ml-btn:hover span { color:#999; }
        .ml-btn.on-b { background:rgba(60,220,100,.14); border-color:#3dcc66; }
        .ml-btn.on-b span { color:#5ddd88; }
        .ml-btn.on-m { background:rgba(80,160,255,.18); border-color:#4a9eff; }
        .ml-btn.on-m span { color:#7bbfff; }
        .ml-btn.on-s { background:rgba(180,100,255,.18); border-color:#c07fff; }
        .ml-btn.on-s span { color:#d4a0ff; }
        #mlLegend {
            position:absolute; bottom:30px; right:10px; z-index:1002;
            background:rgba(5,5,15,.9); border:1px solid #333;
            border-radius:8px; padding:8px 12px; font-size:11px; color:#ccc;
            display:none; min-width:140px;
        }
        #mlLegend .leg-title { font-weight:700; font-size:12px; color:#fff; margin-bottom:6px; }
        #mlLegend .leg-bar { height:12px; border-radius:3px; margin-bottom:4px; }
        #mlLegend .leg-labels { display:flex; justify-content:space-between; font-size:9px; color:#999; }
        #mlPop {
            position:fixed; background:rgba(4,4,14,.96); color:#fff;
            padding:8px 12px; border-radius:8px; font-size:12px;
            z-index:9999; border:1px solid #2a2a3a; pointer-events:none;
            display:none; line-height:1.8; box-shadow:0 4px 18px rgba(0,0,0,.7); max-width:220px;
        }
        #mlPop .pt { font-size:13px; font-weight:700; border-bottom:1px solid #333; padding-bottom:3px; margin-bottom:4px; }
    `;
    document.head.appendChild(s);
}

function sep() { var d=document.createElement('div'); d.className='ml-sep'; return d; }
function lbl(t) { var s=document.createElement('span'); s.className='ml-lbl'; s.textContent=t; return s; }

function mkBtn(id, emoji, title, cls, cb) {
    var b=document.createElement('button');
    b.className='ml-btn'+(cls?' '+cls:'');
    b.id='mlb-'+id; b.title=title;
    b.innerHTML=emoji+'<span>'+title+'</span>';
    b.onclick=cb; return b;
}

function createBar() {
    if (document.getElementById('mlBar')) return;
    var bar=document.createElement('div'); bar.id='mlBar';

    // BASE
    bar.appendChild(lbl('Base'));
    Object.keys(BASE).forEach(function(id) {
        var d=BASE[id];
        bar.appendChild(mkBtn(id,d.e,d.t,id==='dark'?'on-b':'',function(){ switchBase(id); }));
    });
    bar.appendChild(sep());

    // MET
    bar.appendChild(lbl('Met'));
    Object.keys(MET).forEach(function(id) {
        var d=MET[id];
        bar.appendChild(mkBtn(id,d.e,d.t,'',function(){ toggleMet(id); }));
    });
    bar.appendChild(sep());

    // SAT
    bar.appendChild(lbl('Sat'));
    Object.keys(SAT).forEach(function(id) {
        var d=SAT[id];
        bar.appendChild(mkBtn(id,d.e,d.t,'',function(){ toggleSat(id); }));
    });

    var mapEl=document.getElementById('map');
    if (mapEl) { mapEl.style.position='relative'; mapEl.insertBefore(bar,mapEl.firstChild); }

    // Leyenda
    var leg=document.createElement('div'); leg.id='mlLegend';
    if (mapEl) mapEl.appendChild(leg);

    // Popup valor
    var pop=document.createElement('div'); pop.id='mlPop';
    document.body.appendChild(pop);

    setTimeout(function(){ if(window.leafletMap) window.leafletMap.invalidateSize(); }, 300);
}

// ── MAPA BASE ──
function switchBase(id) {
    if (!window.leafletMap) return;
    if (currentBaseLayer) window.leafletMap.removeLayer(currentBaseLayer);
    window.leafletMap.eachLayer(function(l){ if(l._isBase) window.leafletMap.removeLayer(l); });
    var d=BASE[id];
    currentBaseLayer=L.tileLayer(d.url,{attribution:d.a,maxZoom:20,zIndex:1});
    currentBaseLayer._isBase=true;
    currentBaseLayer.addTo(window.leafletMap).bringToBack();
    Object.keys(BASE).forEach(function(k){
        var b=document.getElementById('mlb-'+k);
        if(b) b.className='ml-btn'+(k===id?' on-b':'');
    });
}

// ── CAPA MET ──
function toggleMet(id) {
    if (!window.leafletMap) return;
    var btn=document.getElementById('mlb-'+id);
    if (activeLayers[id]) {
        window.leafletMap.removeLayer(activeLayers[id]); delete activeLayers[id];
        if(btn) btn.className='ml-btn';
        updateLegend();
        return;
    }
    var d=MET[id];
    // Usar OWM tiles con opacidad alta
    var layer=L.tileLayer(
        'https://tile.openweathermap.org/map/'+d.owm+'/{z}/{x}/{y}.png?appid='+OWM_KEY,
        { opacity:d.op, attribution:'© OpenWeatherMap', maxZoom:20, zIndex:5 }
    );
    layer.addTo(window.leafletMap);
    activeLayers[id]=layer;
    if(btn) btn.className='ml-btn on-m';
    updateLegend(id);
}

// ── CAPA SAT ──
function toggleSat(id) {
    if (!window.leafletMap) return;
    var btn=document.getElementById('mlb-'+id);
    if (activeLayers[id]) {
        window.leafletMap.removeLayer(activeLayers[id]); delete activeLayers[id];
        if(btn) btn.className='ml-btn';
        return;
    }
    var d=SAT[id];
    var layer=L.tileLayer(d.url,{opacity:d.op,attribution:'© RainViewer/Esri',maxZoom:20,minZoom:1,zIndex:4});
    layer.addTo(window.leafletMap);
    activeLayers[id]=layer;
    if(btn) btn.className='ml-btn on-s';
}

// ── LEYENDA ──
function updateLegend(activeId) {
    var leg=document.getElementById('mlLegend');
    if (!leg) return;
    if (!activeId || !LEGENDS[activeId]) { leg.style.display='none'; return; }
    var L2=LEGENDS[activeId];
    var gradient=L2.stops.map(function(s){ return s[0]; }).join(',');
    var labels=L2.stops.filter(function(_,i){ return i%2===0||i===L2.stops.length-1; }).map(function(s){ return s[1]+L2.unit; }).join('</span><span>');
    leg.style.display='block';
    leg.innerHTML='<div class="leg-title">'+L2.title+'</div>'+
        '<div class="leg-bar" style="background:linear-gradient(to right,'+gradient+')"></div>'+
        '<div class="leg-labels"><span>'+labels+'</span></div>';
}

// ── CLICK EN MAPA ──
function onMapClick(e) {
    var hasMet=Object.keys(activeLayers).some(function(id){ return MET[id]; });
    if (!hasMet) return;
    var lat=e.latlng.lat.toFixed(4), lon=e.latlng.lng.toFixed(4);
    fetch('https://api.openweathermap.org/data/2.5/weather?lat='+lat+'&lon='+lon+'&appid='+OWM_KEY+'&units=metric&lang=es')
        .then(function(r){return r.json();})
        .then(function(d) {
            if (!d||!d.main) return;
            var lines=[];
            if(activeLayers['temp'])     lines.push('🌡️ <b>'+Math.round(d.main.temp)+'°C</b> (sens. '+Math.round(d.main.feels_like)+'°C)');
            if(activeLayers['rain'])     lines.push('🌧️ <b>'+((d.rain&&d.rain['1h'])||0)+' mm/h</b>');
            if(activeLayers['wind'])     lines.push('💨 <b>'+Math.round((d.wind&&d.wind.speed||0)*3.6)+' km/h</b>'+(d.wind&&d.wind.gust?' ráf.'+Math.round(d.wind.gust*3.6):''));
            if(activeLayers['clouds'])   lines.push('☁️ <b>'+((d.clouds&&d.clouds.all)||0)+'%</b>');
            if(activeLayers['pressure']) lines.push('📊 <b>'+d.main.pressure+' hPa</b>');
            if(activeLayers['humidity']) lines.push('💦 <b>'+d.main.humidity+'%</b>');
            if(activeLayers['snow'])     lines.push('❄️ <b>'+((d.snow&&d.snow['1h'])||0)+' mm/h</b> ('+Math.round(d.main.temp)+'°C)');
            if(!lines.length) return;
            var pop=document.getElementById('mlPop'); if(!pop) return;
            var city=d.name+(d.sys&&d.sys.country?', '+d.sys.country:'');
            pop.innerHTML='<div class="pt">'+city+'</div>'+lines.join('<br>');
            pop.style.display='block';
            var pt=window.leafletMap.latLngToContainerPoint(e.latlng);
            var rect=document.getElementById('map').getBoundingClientRect();
            var px=rect.left+pt.x+14, py=rect.top+pt.y-20;
            if(px+230>window.innerWidth) px-=240;
            if(py<rect.top+55) py=rect.top+55;
            pop.style.left=px+'px'; pop.style.top=py+'px';
            setTimeout(function(){pop.style.display='none';},5000);
        }).catch(function(){});
}

// ── INIT ──
window.initMapLayers=function() {
    if (mapLayersInitialized||!window.leafletMap) return;
    injectCSS(); createBar();
    // Capturar base existente
    window.leafletMap.eachLayer(function(layer) {
        if (layer instanceof L.TileLayer) { layer._isBase=true; currentBaseLayer=layer; }
    });
    window.leafletMap.on('click',onMapClick);
    mapLayersInitialized=true;
    console.log('✅ Capas v5 inicializadas');
};

var _w=setInterval(function() {
    if (window.leafletMap&&window.mapInitialized) {
        clearInterval(_w); setTimeout(window.initMapLayers,500);
    }
},500);
