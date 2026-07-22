// ============================================
// js/map-layers.js v6 — Colores vivos + Leyenda
// ============================================

var OWM_KEY = '6fe6e0dcca264864dbd631bf620aad64';
var activeLayers = {};
var currentBaseLayer = null;
var mapLayersInitialized = false;
var activeLegend = null;

var BASE = {
    dark:  {e:'🌑',t:'Oscuro',   url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',a:'© CartoDB'},
    light: {e:'🌕',t:'Claro',    url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',a:'© OSM'},
    sat:   {e:'🛰️', t:'Satélite', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',a:'© Esri'},
    topo:  {e:'⛰️',t:'Relieve',  url:'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',a:'© OSM'},
};

// Capas OWM con opacidad ALTA para colores notorios
var MET = {
    temp:     {e:'🌡️',t:'Temp',    owm:'temp_new',          op:1.0, leg:{title:'Temperatura °C', grad:'#0000aa,#0066ff,#00ccff,#00ff88,#ffff00,#ff8800,#ff0000', vals:'-30°C  -10°C  0°C  10°C  20°C  30°C  40°C'}},
    rain:     {e:'🌧️',t:'Lluvia',  owm:'precipitation_new', op:1.0, leg:{title:'Precipitación mm/h', grad:'transparent,#a0d4ff,#5599ff,#0044ff,#6600ff,#ff00ff', vals:'0  1  5  10  25  50mm'}},
    wind:     {e:'💨',t:'Viento',  owm:'wind_new',           op:1.0, leg:{title:'Viento km/h', grad:'#ccffcc,#88ff44,#ffff00,#ff8800,#ff3300,#aa0000', vals:'0  10  20  35  55  80+'}},
    clouds:   {e:'☁️',t:'Nubes',   owm:'clouds_new',         op:0.95,leg:{title:'Nubosidad %', grad:'transparent,#bbccdd,#8899aa,#556677,#223344,#000022', vals:'0  20  40  60  80  100%'}},
    pressure: {e:'📊',t:'Presión', owm:'pressure_new',       op:1.0, leg:{title:'Presión hPa', grad:'#ff8800,#ffcc00,#aaffaa,#55aaff,#0000ff,#000088', vals:'970  990  1000  1010  1030  1050'}},
    humidity: {e:'💦',t:'Humedad', owm:'humidity_new',       op:1.0, leg:{title:'Humedad %', grad:'#ffe0a0,#ffcc44,#aadd44,#44aa88,#0088cc,#0033aa', vals:'0  20  40  60  80  100%'}},
    snow:     {e:'❄️',t:'Nieve',   owm:'snow',               op:1.0, leg:{title:'Nieve cm', grad:'transparent,#e0eeff,#aaccff,#6688ff,#3344ff,#0000aa', vals:'0  1  5  10  20  30cm'}},
};

var SAT = {
    radar:  {e:'📡',t:'Radar',   url:'https://tilecache.rainviewer.com/v2/radar/nowcast/{z}/{x}/{y}/2/1_1.png',op:0.75},
    sat2:   {e:'🌍',t:'Esri',    url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',op:0.9},
};

function injectCSS() {
    if (document.getElementById('ml-css')) return;
    var s=document.createElement('style'); s.id='ml-css';
    s.textContent=`
    #mlBar{position:absolute;top:0;left:0;right:0;z-index:1001;background:rgba(4,4,14,.97);
    border-bottom:1px solid #1a1a2a;display:flex;align-items:center;overflow-x:auto;
    overflow-y:hidden;scrollbar-width:thin;scrollbar-color:#333 transparent;
    padding:2px 6px;gap:1px;-webkit-overflow-scrolling:touch;}
    #mlBar::-webkit-scrollbar{height:3px;}#mlBar::-webkit-scrollbar-thumb{background:#444;}
    .ml-sep{width:1px;height:36px;background:#222;margin:0 4px;flex-shrink:0;}
    .ml-lbl{font-size:7px;color:#333;text-transform:uppercase;padding:0 3px;flex-shrink:0;}
    .ml-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;
    min-width:38px;height:48px;padding:1px 2px 0;border-radius:5px;border:1px solid transparent;
    background:transparent;color:#888;cursor:pointer;font-size:15px;flex-shrink:0;transition:all .12s;}
    .ml-btn span{font-size:7px;color:#444;white-space:nowrap;margin-top:1px;line-height:1;}
    .ml-btn:hover{background:rgba(255,255,255,.06);border-color:#333;color:#ddd;}
    .ml-btn:hover span{color:#888;}
    .ml-btn.on-b{background:rgba(60,220,100,.15);border-color:#3dcc66;}
    .ml-btn.on-b span{color:#5ddd88;}
    .ml-btn.on-m{background:rgba(80,160,255,.2);border-color:#4a9eff;}
    .ml-btn.on-m span{color:#7bbfff;}
    .ml-btn.on-s{background:rgba(180,100,255,.2);border-color:#c07fff;}
    .ml-btn.on-s span{color:#d4a0ff;}
    #mlLeg{position:absolute;bottom:36px;left:50%;transform:translateX(-50%);
    z-index:1002;background:rgba(4,4,14,.92);border:1px solid #333;border-radius:8px;
    padding:6px 14px;display:none;min-width:220px;box-shadow:0 2px 10px rgba(0,0,0,.5);}
    #mlLeg .lt{font-size:11px;font-weight:700;color:#fff;text-align:center;margin-bottom:5px;}
    #mlLeg .lb{height:14px;border-radius:3px;margin-bottom:3px;}
    #mlLeg .lv{display:flex;justify-content:space-between;font-size:9px;color:#888;}
    #mlPop{position:fixed;background:rgba(4,4,14,.96);color:#fff;padding:8px 12px;
    border-radius:8px;font-size:12px;z-index:9999;border:1px solid #2a2a3a;
    pointer-events:none;display:none;line-height:1.8;max-width:220px;box-shadow:0 4px 18px rgba(0,0,0,.7);}
    #mlPop .pt{font-size:13px;font-weight:700;border-bottom:1px solid #333;
    padding-bottom:3px;margin-bottom:4px;}
    `;
    document.head.appendChild(s);
}

function createBar() {
    if (document.getElementById('mlBar')) return;
    var bar=document.createElement('div'); bar.id='mlBar';
    function lbl(t){var s=document.createElement('span');s.className='ml-lbl';s.textContent=t;return s;}
    function sep(){var d=document.createElement('div');d.className='ml-sep';return d;}
    function btn(id,e,t,cl,fn){
        var b=document.createElement('button');
        b.className='ml-btn'+(cl?' '+cl:'');b.id='mlb-'+id;b.title=t;
        b.innerHTML=e+'<span>'+t+'</span>';b.onclick=fn;return b;
    }
    bar.appendChild(lbl('Base'));
    Object.keys(BASE).forEach(function(id){
        bar.appendChild(btn(id,BASE[id].e,BASE[id].t,id==='dark'?'on-b':'',function(){switchBase(id);}));
    });
    bar.appendChild(sep());
    bar.appendChild(lbl('Meteorología'));
    Object.keys(MET).forEach(function(id){
        bar.appendChild(btn(id,MET[id].e,MET[id].t,'',function(){toggleMet(id);}));
    });
    bar.appendChild(sep());
    bar.appendChild(lbl('Satélite'));
    Object.keys(SAT).forEach(function(id){
        bar.appendChild(btn(id,SAT[id].e,SAT[id].t,'',function(){toggleSat(id);}));
    });

    var mapEl=document.getElementById('map');
    if(mapEl){mapEl.style.position='relative';mapEl.insertBefore(bar,mapEl.firstChild);}

    // Leyenda
    var leg=document.createElement('div');leg.id='mlLeg';
    if(mapEl)mapEl.appendChild(leg);

    // Popup
    var pop=document.createElement('div');pop.id='mlPop';
    document.body.appendChild(pop);

    setTimeout(function(){if(window.leafletMap)window.leafletMap.invalidateSize();},300);
}

function switchBase(id) {
    if(!window.leafletMap)return;
    if(currentBaseLayer){window.leafletMap.removeLayer(currentBaseLayer);currentBaseLayer=null;}
    window.leafletMap.eachLayer(function(l){if(l._isBase)window.leafletMap.removeLayer(l);});
    var d=BASE[id];
    currentBaseLayer=L.tileLayer(d.url,{attribution:d.a,maxZoom:20,zIndex:1});
    currentBaseLayer._isBase=true;
    currentBaseLayer.addTo(window.leafletMap).bringToBack();
    Object.keys(BASE).forEach(function(k){
        var b=document.getElementById('mlb-'+k);
        if(b)b.className='ml-btn'+(k===id?' on-b':'');
    });
}

function showLegend(id) {
    var leg=document.getElementById('mlLeg');
    if(!leg)return;
    // Encontrar primera capa met activa
    var firstActive=Object.keys(activeLayers).find(function(k){return MET[k];});
    if(!firstActive){leg.style.display='none';return;}
    var d=MET[firstActive];
    if(!d.leg){leg.style.display='none';return;}
    leg.style.display='block';
    leg.innerHTML='<div class="lt">'+d.leg.title+'</div>'+
        '<div class="lb" style="background:linear-gradient(to right,'+d.leg.grad+')"></div>'+
        '<div class="lv">'+d.leg.vals.split('  ').map(function(v){return '<span>'+v+'</span>';}).join('')+'</div>';
}

function toggleMet(id) {
    if(!window.leafletMap)return;
    var b=document.getElementById('mlb-'+id);
    if(activeLayers[id]){
        window.leafletMap.removeLayer(activeLayers[id]);delete activeLayers[id];
        if(b)b.className='ml-btn';showLegend();return;
    }
    var d=MET[id];
    var layer=L.tileLayer(
        'https://tile.openweathermap.org/map/'+d.owm+'/{z}/{x}/{y}.png?appid='+OWM_KEY,
        {opacity:d.op,attribution:'© OpenWeatherMap',maxZoom:20,zIndex:5}
    );
    layer.addTo(window.leafletMap);
    activeLayers[id]=layer;
    if(b)b.className='ml-btn on-m';
    showLegend(id);
}

function toggleSat(id) {
    if(!window.leafletMap)return;
    var b=document.getElementById('mlb-'+id);
    if(activeLayers[id]){
        window.leafletMap.removeLayer(activeLayers[id]);delete activeLayers[id];
        if(b)b.className='ml-btn';return;
    }
    var d=SAT[id];
    var layer=L.tileLayer(d.url,{opacity:d.op,attribution:'© RainViewer/Esri',maxZoom:20,minZoom:1,zIndex:4});
    layer.addTo(window.leafletMap);activeLayers[id]=layer;
    if(b)b.className='ml-btn on-s';
}

function onMapClick(e) {
    var hasMet=Object.keys(activeLayers).some(function(id){return MET[id];});
    if(!hasMet)return;
    var lat=e.latlng.lat.toFixed(4),lon=e.latlng.lng.toFixed(4);
    fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+
        '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,'+
        'rain,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,surface_pressure,visibility'+
        '&timezone=auto&wind_speed_unit=kmh')
        .then(function(r){return r.json();})
        .then(function(d){
            if(!d||!d.current)return;
            var c=d.current,lines=[];
            var dirs=['N','NE','E','SE','S','SO','O','NO'];
            var dir=dirs[Math.round((c.wind_direction_10m||0)/45)%8]||'';
            if(activeLayers['temp'])    lines.push('🌡️ <b>'+Math.round(c.temperature_2m)+'°C</b> (sens. '+Math.round(c.apparent_temperature)+'°C)');
            if(activeLayers['rain'])    lines.push('🌧️ <b>'+((c.rain||c.precipitation)||0).toFixed(1)+' mm/h</b>');
            if(activeLayers['wind'])    lines.push('💨 <b>'+Math.round(c.wind_speed_10m||0)+' km/h</b> '+dir+(c.wind_gusts_10m?' (ráf. '+Math.round(c.wind_gusts_10m)+')':''));
            if(activeLayers['clouds'])  lines.push('☁️ Nubes: consultando...');
            if(activeLayers['pressure'])lines.push('📊 <b>'+Math.round(c.surface_pressure||1013)+' hPa</b>');
            if(activeLayers['humidity'])lines.push('💦 <b>'+c.relative_humidity_2m+'%</b>');
            if(activeLayers['snow'])    lines.push('❄️ Nieve: '+((d.current.snowfall)||0)+' cm/h');
            if(!lines.length)return;
            var pop=document.getElementById('mlPop');if(!pop)return;
            pop.innerHTML='<div class="pt">📍 '+lat+', '+lon+'</div>'+lines.join('<br>');
            pop.style.display='block';
            var pt=window.leafletMap.latLngToContainerPoint(e.latlng);
            var rect=document.getElementById('map').getBoundingClientRect();
            var px=rect.left+pt.x+14,py=rect.top+pt.y-20;
            if(px+230>window.innerWidth)px-=240;
            if(py<rect.top+55)py=rect.top+55;
            pop.style.left=px+'px';pop.style.top=py+'px';
            setTimeout(function(){pop.style.display='none';},6000);
        }).catch(function(){});
}

window.initMapLayers=function(){
    if(mapLayersInitialized||!window.leafletMap)return;
    injectCSS();createBar();
    window.leafletMap.eachLayer(function(l){if(l instanceof L.TileLayer){l._isBase=true;currentBaseLayer=l;}});
    window.leafletMap.on('click',onMapClick);
    mapLayersInitialized=true;
    console.log('✅ Capas v6');
};

var _w=setInterval(function(){
    if(window.leafletMap&&window.mapInitialized){clearInterval(_w);setTimeout(window.initMapLayers,500);}
},500);
