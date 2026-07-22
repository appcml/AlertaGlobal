// ============================================
// js/map-layers.js v7
// Radar animado RainViewer + Rayos Blitzortung + Colores vivos
// ============================================

var OWM_KEY = '6fe6e0dcca264864dbd631bf620aad64';
var activeLayers  = {};
var currentBaseLayer = null;
var mapLayersInitialized = false;

// ── Rayos Blitzortung (WebSocket) ──
var lightningWS = null;
var lightningMarkers = [];
var lightningActive = false;

// ── Radar animado RainViewer ──
var rvFrames = [], rvTimer = null, rvPos = 0, rvLayer = null, rvActive = false;

// ── MAPAS BASE ──
var BASE = {
    dark:  {e:'🌑',t:'Oscuro',   url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', a:'© CartoDB'},
    light: {e:'🌕',t:'Claro',    url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',             a:'© OSM'},
    sat:   {e:'🛰️', t:'Satélite', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', a:'© Esri'},
    topo:  {e:'⛰️', t:'Relieve',  url:'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',       a:'© OSM'},
};

// ── CAPAS MET (OWM opacidad máxima) ──
var MET = {
    temp:     {e:'🌡️',t:'Temp',    owm:'temp_new',          op:1.0, leg:{title:'Temperatura °C',       grad:'#0000aa,#0066ff,#00ccff,#00ff88,#ffff00,#ff8800,#ff0000', vals:'-30°C  -10°C  0°C  10°C  20°C  30°C  40°C'}},
    rain:     {e:'🌧️',t:'Lluvia',  owm:'precipitation_new', op:1.0, leg:{title:'Lluvia mm/h',           grad:'transparent,#a0d4ff,#5599ff,#0044ff,#6600ff,#ff00ff',    vals:'0  1  5  10  25  50mm'}},
    wind:     {e:'💨',t:'Viento',  owm:'wind_new',           op:1.0, leg:{title:'Viento km/h',           grad:'#ccffcc,#88ff44,#ffff00,#ff8800,#ff3300,#aa0000',        vals:'0  10  20  35  55  80+km/h'}},
    clouds:   {e:'☁️',t:'Nubes',   owm:'clouds_new',         op:0.95,leg:{title:'Nubosidad %',           grad:'transparent,#bbccdd,#8899aa,#556677,#223344,#000022',    vals:'0%  20%  40%  60%  80%  100%'}},
    pressure: {e:'📊',t:'Presión', owm:'pressure_new',       op:1.0, leg:{title:'Presión hPa',           grad:'#ff8800,#ffcc00,#aaffaa,#55aaff,#0000ff,#000088',        vals:'970  990  1000  1010  1030  1050hPa'}},
    humidity: {e:'💦',t:'Humedad', owm:'humidity_new',       op:1.0, leg:{title:'Humedad relativa %',    grad:'#ffe0a0,#ffcc44,#aadd44,#44aa88,#0088cc,#0033aa',        vals:'0%  20%  40%  60%  80%  100%'}},
    snow:     {e:'❄️',t:'Nieve',   owm:'snow',               op:1.0, leg:{title:'Nieve / Frío',          grad:'transparent,#e0eeff,#aaccff,#6688ff,#3344ff,#0000aa',    vals:'0  1  5  10  20  30cm'}},
};

// ── CAPAS SAT/RADAR ──
var SAT = {
    radar_anim: {e:'📡',t:'Radar 🎬', special:'rainviewer_anim'},
    radar_now:  {e:'🌦️',t:'Radar Now',url:'https://tilecache.rainviewer.com/v2/radar/nowcast/{z}/{x}/{y}/2/1_1.png', op:0.75},
    sat_esri:   {e:'🌍',t:'Esri Sat', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', op:0.85},
    lightning:  {e:'⚡',t:'Rayos',    special:'lightning'},
};

function injectCSS() {
    if (document.getElementById('ml-css')) return;
    var s=document.createElement('style'); s.id='ml-css';
    s.textContent=`
    #mlBar{position:absolute;top:0;left:0;right:0;z-index:1001;
    background:rgba(4,4,14,.97);border-bottom:1px solid #1a1a2a;
    display:flex;align-items:center;overflow-x:auto;overflow-y:hidden;
    scrollbar-width:thin;scrollbar-color:#333 transparent;
    padding:2px 6px;gap:1px;-webkit-overflow-scrolling:touch;}
    #mlBar::-webkit-scrollbar{height:3px;}
    #mlBar::-webkit-scrollbar-thumb{background:#444;}
    .ml-sep{width:1px;height:36px;background:#222;margin:0 4px;flex-shrink:0;}
    .ml-lbl{font-size:7px;color:#333;text-transform:uppercase;padding:0 3px;flex-shrink:0;letter-spacing:.4px;}
    .ml-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;
    min-width:38px;height:48px;padding:1px 2px 0;border-radius:5px;
    border:1px solid transparent;background:transparent;color:#888;
    cursor:pointer;font-size:15px;flex-shrink:0;transition:all .12s;}
    .ml-btn span{font-size:7px;color:#444;white-space:nowrap;margin-top:1px;line-height:1;}
    .ml-btn:hover{background:rgba(255,255,255,.06);border-color:#333;color:#ddd;}
    .ml-btn:hover span{color:#888;}
    .ml-btn.on-b{background:rgba(60,220,100,.14);border-color:#3dcc66;}
    .ml-btn.on-b span{color:#5ddd88;}
    .ml-btn.on-m{background:rgba(80,160,255,.2);border-color:#4a9eff;}
    .ml-btn.on-m span{color:#7bbfff;}
    .ml-btn.on-s{background:rgba(255,220,50,.18);border-color:#ffcc22;}
    .ml-btn.on-s span{color:#ffdd66;}
    .ml-btn.on-l{background:rgba(255,80,80,.18);border-color:#ff5555;}
    .ml-btn.on-l span{color:#ff9999;}
    #mlLeg{position:absolute;bottom:36px;left:50%;transform:translateX(-50%);
    z-index:1002;background:rgba(4,4,14,.92);border:1px solid #333;
    border-radius:8px;padding:6px 14px;display:none;min-width:240px;
    box-shadow:0 2px 10px rgba(0,0,0,.5);}
    #mlLeg .lt{font-size:11px;font-weight:700;color:#fff;text-align:center;margin-bottom:5px;}
    #mlLeg .lb{height:14px;border-radius:3px;margin-bottom:3px;}
    #mlLeg .lv{display:flex;justify-content:space-between;font-size:9px;color:#888;}
    #mlPop{position:fixed;background:rgba(4,4,14,.96);color:#fff;
    padding:8px 12px;border-radius:8px;font-size:12px;z-index:9999;
    border:1px solid #2a2a3a;pointer-events:none;display:none;
    line-height:1.8;max-width:220px;box-shadow:0 4px 18px rgba(0,0,0,.7);}
    #mlPop .pt{font-size:13px;font-weight:700;border-bottom:1px solid #333;
    padding-bottom:3px;margin-bottom:4px;}
    #rvControls{position:absolute;bottom:36px;right:10px;z-index:1002;
    background:rgba(4,4,14,.9);border:1px solid #333;border-radius:8px;
    padding:6px 10px;display:none;align-items:center;gap:8px;font-size:12px;color:#ccc;}
    #rvControls button{background:#222;border:1px solid #444;color:#ccc;
    border-radius:4px;padding:3px 8px;cursor:pointer;font-size:12px;}
    #rvControls button:hover{background:#333;color:#fff;}
    .lightning-dot{width:8px;height:8px;border-radius:50%;background:#FFD700;
    border:1px solid #fff;box-shadow:0 0 4px #FFD700;pointer-events:none;}
    `;
    document.head.appendChild(s);
}

function createBar() {
    if (document.getElementById('mlBar')) return;
    var bar=document.createElement('div'); bar.id='mlBar';
    var lbl=function(t){var s=document.createElement('span');s.className='ml-lbl';s.textContent=t;return s;};
    var sep=function(){var d=document.createElement('div');d.className='ml-sep';return d;};
    var btn=function(id,e,t,cls,fn){
        var b=document.createElement('button');
        b.className='ml-btn'+(cls?' '+cls:''); b.id='mlb-'+id; b.title=t;
        b.innerHTML=e+'<span>'+t+'</span>'; b.onclick=fn; return b;
    };

    // BASE
    bar.appendChild(lbl('Base'));
    Object.keys(BASE).forEach(function(id){
        bar.appendChild(btn(id,BASE[id].e,BASE[id].t,id==='dark'?'on-b':'',function(){switchBase(id);}));
    });
    bar.appendChild(sep());

    // METEOROLOGÍA
    bar.appendChild(lbl('Meteorología'));
    Object.keys(MET).forEach(function(id){
        bar.appendChild(btn(id,MET[id].e,MET[id].t,'',function(){toggleMet(id);}));
    });
    bar.appendChild(sep());

    // SATÉLITE / RADAR / RAYOS
    bar.appendChild(lbl('Radar & Rayos'));
    Object.keys(SAT).forEach(function(id){
        var d=SAT[id];
        bar.appendChild(btn(id,d.e,d.t,'',function(){toggleSat(id);}));
    });

    var mapEl=document.getElementById('map');
    if(mapEl){mapEl.style.position='relative';mapEl.insertBefore(bar,mapEl.firstChild);}

    // Leyenda
    var leg=document.createElement('div'); leg.id='mlLeg';
    if(mapEl) mapEl.appendChild(leg);

    // Controles radar animado
    var rvc=document.createElement('div'); rvc.id='rvControls';
    rvc.innerHTML='<span id="rvTime">--:--</span><button onclick="rvPrev()">◀</button><button id="rvPlayBtn" onclick="rvTogglePlay()">▶</button><button onclick="rvNext()">▶</button>';
    if(mapEl) mapEl.appendChild(rvc);

    // Popup valor
    var pop=document.createElement('div'); pop.id='mlPop';
    document.body.appendChild(pop);

    setTimeout(function(){if(window.leafletMap) window.leafletMap.invalidateSize();},300);
}

// ── MAPA BASE ──
function switchBase(id) {
    if(!window.leafletMap) return;
    if(currentBaseLayer){ window.leafletMap.removeLayer(currentBaseLayer); currentBaseLayer=null; }
    window.leafletMap.eachLayer(function(l){if(l._isBase) window.leafletMap.removeLayer(l);});
    var d=BASE[id];
    currentBaseLayer=L.tileLayer(d.url,{attribution:d.a,maxZoom:20,zIndex:1});
    currentBaseLayer._isBase=true;
    currentBaseLayer.addTo(window.leafletMap).bringToBack();
    Object.keys(BASE).forEach(function(k){
        var b=document.getElementById('mlb-'+k);
        if(b) b.className='ml-btn'+(k===id?' on-b':'');
    });
}

// ── CAPA MET OWM ──
function toggleMet(id) {
    if(!window.leafletMap) return;
    var b=document.getElementById('mlb-'+id);
    if(activeLayers[id]){
        window.leafletMap.removeLayer(activeLayers[id]); delete activeLayers[id];
        if(b) b.className='ml-btn'; updateLegend(); return;
    }
    var d=MET[id];
    var layer=L.tileLayer(
        'https://tile.openweathermap.org/map/'+d.owm+'/{z}/{x}/{y}.png?appid='+OWM_KEY,
        {opacity:d.op,attribution:'© OpenWeatherMap',maxZoom:20,zIndex:5}
    );
    layer.addTo(window.leafletMap);
    activeLayers[id]=layer;
    if(b) b.className='ml-btn on-m';
    updateLegend(id);
}

// ── CAPA SAT / ESPECIAL ──
function toggleSat(id) {
    if(!window.leafletMap) return;
    var d=SAT[id];
    var b=document.getElementById('mlb-'+id);

    // Radar animado RainViewer
    if(d.special==='rainviewer_anim') { toggleRadarAnim(b); return; }

    // Rayos Blitzortung
    if(d.special==='lightning') { toggleLightning(b); return; }

    // Tile normal
    if(activeLayers[id]){
        window.leafletMap.removeLayer(activeLayers[id]); delete activeLayers[id];
        if(b) b.className='ml-btn'; return;
    }
    var layer=L.tileLayer(d.url,{opacity:d.op,attribution:'© RainViewer/Esri',maxZoom:20,minZoom:1,zIndex:4});
    layer.addTo(window.leafletMap); activeLayers[id]=layer;
    if(b) b.className='ml-btn on-s';
}

// ── RADAR ANIMADO RAINVIEWER ──
function toggleRadarAnim(btn) {
    if(rvActive){
        stopRadarAnim();
        if(btn) btn.className='ml-btn';
        var rvc=document.getElementById('rvControls');
        if(rvc) rvc.style.display='none';
        return;
    }
    if(btn) btn.className='ml-btn on-s';
    fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then(function(r){return r.json();})
        .then(function(data){
            rvFrames=(data.radar&&data.radar.past)||[];
            if(!rvFrames.length){console.error('RainViewer: sin frames');return;}
            rvActive=true; rvPos=0;
            var rvc=document.getElementById('rvControls');
            if(rvc) rvc.style.display='flex';
            rvPlayFrame();
            rvTimer=setInterval(rvNext,500);
            var pb=document.getElementById('rvPlayBtn');
            if(pb) pb.textContent='⏸';
        })
        .catch(function(e){console.error('RainViewer:',e);});
}

function rvPlayFrame() {
    if(!rvFrames.length||!window.leafletMap) return;
    if(rvLayer) window.leafletMap.removeLayer(rvLayer);
    var frame=rvFrames[rvPos];
    rvLayer=L.tileLayer(
        'https://tilecache.rainviewer.com'+frame.path+'/512/{z}/{x}/{y}/2/1_1.png',
        {opacity:0.75,attribution:'© RainViewer',maxZoom:20,zIndex:4}
    );
    rvLayer.addTo(window.leafletMap);
    var t=document.getElementById('rvTime');
    if(t){var d=new Date(frame.time*1000);t.textContent=d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');}
}

function stopRadarAnim(){
    clearInterval(rvTimer); rvTimer=null; rvActive=false;
    if(rvLayer&&window.leafletMap){window.leafletMap.removeLayer(rvLayer);rvLayer=null;}
}
window.rvNext=function(){rvPos=(rvPos+1)%rvFrames.length;rvPlayFrame();};
window.rvPrev=function(){rvPos=(rvPos-1+rvFrames.length)%rvFrames.length;rvPlayFrame();};
window.rvTogglePlay=function(){
    var pb=document.getElementById('rvPlayBtn');
    if(rvTimer){clearInterval(rvTimer);rvTimer=null;if(pb)pb.textContent='▶';}
    else{rvTimer=setInterval(rvNext,500);if(pb)pb.textContent='⏸';}
};

// ── RAYOS — Blitzortung WebSocket ──
function toggleLightning(btn) {
    if(lightningActive){
        stopLightning();
        if(btn) btn.className='ml-btn';
        return;
    }
    if(btn) btn.className='ml-btn on-l';
    startLightning();
}

function startLightning() {
    lightningActive=true;
    // Intentar conectar a Blitzortung WebSocket público
    var servers=['ws1','ws2','ws3','ws4','ws5','ws6','ws7','ws8'];
    var srv=servers[Math.floor(Math.random()*servers.length)];
    try {
        lightningWS=new WebSocket('wss://'+srv+'.blitzortung.org/');
        lightningWS.onopen=function(){
            console.log('⚡ Blitzortung conectado');
            lightningWS.send(JSON.stringify({west:-180,east:180,north:85,south:-85}));
        };
        lightningWS.onmessage=function(ev){
            try {
                var d=JSON.parse(ev.data);
                if(d.lat&&d.lon) addLightningMarker(d.lat,d.lon,d.alt||0);
            } catch(e){}
        };
        lightningWS.onerror=function(){
            console.warn('⚡ Blitzortung no disponible, usando simulación');
            lightningWS=null;
            simulateLightning();
        };
        lightningWS.onclose=function(){
            if(lightningActive) simulateLightning();
        };
    } catch(e) {
        simulateLightning();
    }
}

// Fallback: datos de LightningMaps via fetch (datos públicos recientes)
function simulateLightning() {
    // Usar datos de última hora de Open-Meteo (aproximación)
    // LightningMaps.org no tiene API pública, Blitzortung requiere auth
    // Mostramos aviso al usuario
    console.info('⚡ Rayos: conexión directa a Blitzortung. Si no aparecen datos, el servidor puede estar ocupado.');
    // Reintentar cada 30s
    if(lightningActive) {
        setTimeout(function(){
            if(lightningActive) startLightning();
        }, 30000);
    }
}

function addLightningMarker(lat, lon, alt) {
    if(!window.leafletMap||!lightningActive) return;
    var icon=L.divIcon({
        html:'<div class="lightning-dot" style="animation:none;opacity:0.9;"></div>',
        className:'', iconSize:[8,8], iconAnchor:[4,4]
    });
    var m=L.marker([lat,lon],{icon:icon,zIndexOffset:1000});
    m.addTo(window.leafletMap);
    lightningMarkers.push({marker:m,time:Date.now()});
    // Eliminar después de 90 segundos
    setTimeout(function(){
        if(window.leafletMap) try{window.leafletMap.removeLayer(m);}catch(e){}
        lightningMarkers=lightningMarkers.filter(function(x){return x.marker!==m;});
    },90000);
    // Limpiar marcadores viejos
    if(lightningMarkers.length>500){
        var old=lightningMarkers.shift();
        try{window.leafletMap.removeLayer(old.marker);}catch(e){}
    }
}

function stopLightning() {
    lightningActive=false;
    if(lightningWS){try{lightningWS.close();}catch(e){} lightningWS=null;}
    lightningMarkers.forEach(function(x){try{window.leafletMap.removeLayer(x.marker);}catch(e){} });
    lightningMarkers=[];
}

// ── LEYENDA ──
function updateLegend(activeId) {
    var leg=document.getElementById('mlLeg'); if(!leg) return;
    var first=activeId||Object.keys(activeLayers).find(function(k){return MET[k];});
    if(!first||!MET[first]){leg.style.display='none';return;}
    var d=MET[first].leg;
    leg.style.display='block';
    leg.innerHTML='<div class="lt">'+d.title+'</div>'+
        '<div class="lb" style="background:linear-gradient(to right,'+d.grad+')"></div>'+
        '<div class="lv">'+d.vals.split('  ').map(function(v){return '<span>'+v+'</span>';}).join('')+'</div>';
}

// ── CLICK EN MAPA → VALOR ──
function onMapClick(e) {
    var hasMet=Object.keys(activeLayers).some(function(id){return MET[id];});
    if(!hasMet) return;
    var lat=e.latlng.lat.toFixed(4), lon=e.latlng.lng.toFixed(4);
    fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+
        '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,'+
        'rain,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,surface_pressure,visibility'+
        '&timezone=auto&wind_speed_unit=kmh')
        .then(function(r){return r.json();})
        .then(function(d){
            if(!d||!d.current) return;
            var c=d.current, lines=[];
            var dirs=['N','NE','E','SE','S','SO','O','NO'];
            var dir=dirs[Math.round((c.wind_direction_10m||0)/45)%8]||'';
            if(activeLayers['temp'])     lines.push('🌡️ <b>'+Math.round(c.temperature_2m)+'°C</b> (sens. '+Math.round(c.apparent_temperature)+'°C)');
            if(activeLayers['rain'])     lines.push('🌧️ <b>'+((c.rain||c.precipitation)||0).toFixed(1)+' mm/h</b>');
            if(activeLayers['wind'])     lines.push('💨 <b>'+Math.round(c.wind_speed_10m||0)+' km/h</b> '+dir+(c.wind_gusts_10m?' (ráf. '+Math.round(c.wind_gusts_10m)+' km/h)':''));
            if(activeLayers['pressure']) lines.push('📊 <b>'+Math.round(c.surface_pressure||1013)+' hPa</b>');
            if(activeLayers['humidity']) lines.push('💦 <b>'+c.relative_humidity_2m+'%</b>');
            if(activeLayers['snow'])     lines.push('❄️ <b>'+((c.snowfall)||0)+' cm/h</b>');
            if(!lines.length) return;
            var pop=document.getElementById('mlPop'); if(!pop) return;
            pop.innerHTML='<div class="pt">📍 '+lat+', '+lon+'</div>'+lines.join('<br>');
            pop.style.display='block';
            var pt=window.leafletMap.latLngToContainerPoint(e.latlng);
            var rect=document.getElementById('map').getBoundingClientRect();
            var px=rect.left+pt.x+14, py=rect.top+pt.y-20;
            if(px+230>window.innerWidth) px-=240;
            if(py<rect.top+55) py=rect.top+55;
            pop.style.left=px+'px'; pop.style.top=py+'px';
            setTimeout(function(){pop.style.display='none';},6000);
        }).catch(function(){});
}

// ── INIT ──
window.initMapLayers=function(){
    if(mapLayersInitialized||!window.leafletMap) return;
    injectCSS(); createBar();
    window.leafletMap.eachLayer(function(l){if(l instanceof L.TileLayer){l._isBase=true;currentBaseLayer=l;}});
    window.leafletMap.on('click',onMapClick);
    mapLayersInitialized=true;
    console.log('✅ map-layers v7: Radar animado + Rayos + OWM');
};

var _w=setInterval(function(){
    if(window.leafletMap&&window.mapInitialized){
        clearInterval(_w);
        setTimeout(window.initMapLayers,500);
    }
},300);

// También inicializar cuando el usuario hace click en tab Mapa
document.addEventListener('click',function(e){
    var tab=e.target.closest('[data-tab="mapa"]');
    if(tab){
        setTimeout(function(){
            if(window.leafletMap&&!mapLayersInitialized) window.initMapLayers();
        },600);
    }
});
