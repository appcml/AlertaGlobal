// ============================================
// js/sources.js v4.0
// Fuentes oficiales + alertas climáticas reales
// ============================================

var OWM_KEY = '6fe6e0dcca264864dbd631bf620aad64';

if (typeof window.LocationDatabase === 'undefined') {
    window.LocationDatabase = {
        "chile":          { lat:-30.0,    lon:-71.5,   country:"Chile",     region:"Nacional" },
        "santiago":       { lat:-33.4489, lon:-70.6693, country:"Chile",    region:"Metropolitana" },
        "concepcion":     { lat:-36.8201, lon:-73.0445, country:"Chile",    region:"Biobío" },
        "tirua":          { lat:-38.2704, lon:-73.2490, country:"Chile",    region:"Biobío" },
        "cañete":         { lat:-37.7975, lon:-73.4011, country:"Chile",    region:"Biobío" },
        "temuco":         { lat:-38.7362, lon:-72.5879, country:"Chile",    region:"Araucanía" },
        "valparaiso":     { lat:-33.0472, lon:-71.6127, country:"Chile",    region:"Valparaíso" },
        "antofagasta":    { lat:-23.6345, lon:-70.3996, country:"Chile",    region:"Antofagasta" },
        "iquique":        { lat:-20.2142, lon:-70.1538, country:"Chile",    region:"Tarapacá" },
        "arica":          { lat:-18.4861, lon:-70.2979, country:"Chile",    region:"Arica" },
        "la serena":      { lat:-29.9027, lon:-71.2519, country:"Chile",    region:"Coquimbo" },
        "puerto montt":   { lat:-41.3143, lon:-72.1481, country:"Chile",    region:"Los Lagos" },
        "punta arenas":   { lat:-53.1638, lon:-70.9181, country:"Chile",    region:"Magallanes" },
        "osorno":         { lat:-40.5733, lon:-73.1347, country:"Chile",    region:"Los Lagos" },
        "valdivia":       { lat:-39.8142, lon:-73.2459, country:"Chile",    region:"Los Ríos" },
        "copiapo":        { lat:-27.3668, lon:-70.3323, country:"Chile",    region:"Atacama" },
        "lima":           { lat:-12.0464, lon:-77.0428, country:"Peru",     region:"Lima" },
        "bogota":         { lat:4.7110,   lon:-74.0721, country:"Colombia", region:"Bogotá" },
        "buenos aires":   { lat:-34.6037, lon:-58.3816, country:"Argentina",region:"Buenos Aires" },
        "mexico":         { lat:19.4326,  lon:-99.1332, country:"Mexico",   region:"CDMX" },
        "sao paulo":      { lat:-23.5505, lon:-46.6333, country:"Brasil",   region:"São Paulo" },
        "nueva york":     { lat:40.7128,  lon:-74.0060, country:"EEUU",     region:"Nueva York" },
        "tokyo":          { lat:35.6762,  lon:139.6503, country:"Japón",    region:"Tokio" },
        "madrid":         { lat:40.4168,  lon:-3.7038,  country:"España",   region:"Madrid" },
        "miami":          { lat:25.7617,  lon:-80.1918, country:"EEUU",     region:"Florida" },
        "los angeles":    { lat:34.0522,  lon:-118.2437,country:"EEUU",     region:"California" }
    };
}

function searchLocation(q) {
    if (!q) return null;
    var s = q.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    var db = window.LocationDatabase;
    for (var k in db) { var n=k.normalize('NFD').replace(/[\u0300-\u036f]/g,''); if(n===s) return Object.assign({name:k},db[k]); }
    for (var k in db) { var n=k.normalize('NFD').replace(/[\u0300-\u036f]/g,''); if(n.includes(s)||s.includes(n)) return Object.assign({name:k},db[k]); }
    return null;
}

function calcDistance(lat1,lon1,lat2,lon2) {
    if(lat2==null||lon2==null) return 99999;
    var R=6371,dL=(lat2-lat1)*Math.PI/180,dl=(lon2-lon1)*Math.PI/180;
    var a=Math.sin(dL/2)*Math.sin(dL/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dl/2)*Math.sin(dl/2);
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// ========== 1. SISMOS - USGS (Global, últimas 24h) ==========
async function fetchUSGS(lat, lon) {
    try {
        var since = new Date(Date.now() - 86400000).toISOString();
        var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                  '&orderby=time&limit=200&minmagnitude=2.0&starttime=' + since;
        var r = await fetch(url, {signal: AbortSignal.timeout(10000)});
        var d = await r.json();
        return d.features.map(function(f) {
            var p=f.properties, c=f.geometry.coordinates;
            var mag = p.mag || 0;
            return {
                id:'usgs_'+p.code,
                type:'SISMO', icon: mag>=6?'🔴':mag>=4?'🟠':'🟡',
                title:'Sismo M'+mag.toFixed(1),
                description:(p.place||'Sin ubicación') + ' — Prof. '+(c[2]?Math.round(c[2])+'km':'?'),
                lat:c[1], lon:c[0], magnitude:mag, depth:c[2],
                distKm: lat ? Math.round(calcDistance(lat,lon,c[1],c[0])) : null,
                time: new Date(p.time).toLocaleString('es-CL'),
                source:'USGS Earthquake Hazards',
                priority: mag>=7?95 : mag>=6?88 : mag>=5?78 : mag>=4?65 : mag>=3?52 : 40,
                color: mag>=6?'#ff0000':mag>=4?'#ff6600':mag>=3?'#ffaa00':'#ffdd00',
                link: p.url
            };
        });
    } catch(e) { console.error('USGS error:',e); return []; }
}

// ========== 2. SISMOS CHILE - CSN ==========
async function fetchCSNChile(lat, lon) {
    try {
        // CSN via proxy (datos últimas 24h Chile)
        var url = 'https://api.allorigins.win/raw?url=' +
                  encodeURIComponent('https://www.sismologia.cl/sismicidad/catalogo/ultimashoras.html');
        var r = await fetch(url, {signal: AbortSignal.timeout(8000)});
        var txt = await r.text();
        var alerts = [];
        // Parsear tabla HTML del CSN
        var rows = txt.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
        rows.slice(1, 30).forEach(function(row) {
            var cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi)||[]).map(function(c){
                return c.replace(/<[^>]+>/g,'').trim();
            });
            if (cells.length < 5) return;
            var mag = parseFloat(cells[2]);
            if (isNaN(mag) || mag < 2) return;
            var flat = parseFloat(cells[3]), flon = parseFloat(cells[4]);
            if (isNaN(flat)||isNaN(flon)) return;
            alerts.push({
                id:'csn_'+cells[0]+'_'+cells[1],
                type:'SISMO', icon: mag>=5?'🔴':'🟠',
                title:'Sismo M'+mag.toFixed(1)+' — CSN Chile',
                description:'Prof. '+(cells[5]||'?')+' km — '+( cells[6]||'Chile'),
                lat:flat, lon:flon, magnitude:mag,
                distKm: lat ? Math.round(calcDistance(lat,lon,flat,flon)) : null,
                time: (cells[0]||'')+' '+(cells[1]||''),
                source:'CSN — Sismología Chile',
                priority: mag>=6?90 : mag>=5?78 : mag>=4?63 : mag>=3?50 : 38,
                color: mag>=5?'#ff4400':'#ff9900'
            });
        });
        return alerts;
    } catch(e) { console.error('CSN error:',e); return []; }
}

// ========== 3. VOLCANES - Smithsonian GVP ==========
function getVolcanes(lat, lon) {
    var list = [
        {n:'Villarrica',   la:-39.4233,lo:-71.9311,co:'Chile',    a:'Activo',    p:78},
        {n:'Calbuco',      la:-41.3295,lo:-72.6084,co:'Chile',    a:'Activo',    p:75},
        {n:'Copahue',      la:-37.856, lo:-71.173, co:'Chile',    a:'Activo',    p:75},
        {n:'Llaima',       la:-38.692, lo:-71.729, co:'Chile',    a:'Activo',    p:72},
        {n:'Osorno',       la:-41.1,   lo:-72.493, co:'Chile',    a:'Vigilancia',p:58},
        {n:'Hudson',       la:-45.9,   lo:-72.97,  co:'Chile',    a:'Vigilancia',p:55},
        {n:'Chaitén',      la:-42.833, lo:-72.646, co:'Chile',    a:'Vigilancia',p:60},
        {n:'Lonquimay',    la:-38.379, lo:-71.586, co:'Chile',    a:'Vigilancia',p:55},
        {n:'Calbuco',      la:-41.330, lo:-72.608, co:'Chile',    a:'Vigilancia',p:60},
        {n:'Popocatépetl', la:19.023,  lo:-98.628, co:'México',   a:'Activo',    p:82},
        {n:'Colima',       la:19.514,  lo:-103.62, co:'México',   a:'Activo',    p:78},
        {n:'Sabancaya',    la:-15.787, lo:-71.857, co:'Perú',     a:'Activo',    p:78},
        {n:'Ubinas',       la:-16.356, lo:-70.902, co:'Perú',     a:'Activo',    p:72},
        {n:'Tungurahua',   la:-1.467,  lo:-78.442, co:'Ecuador',  a:'Activo',    p:76},
        {n:'Cotopaxi',     la:-0.677,  lo:-78.436, co:'Ecuador',  a:'Vigilancia',p:65},
        {n:'Nevado Ruiz',  la:4.892,   lo:-75.324, co:'Colombia', a:'Activo',    p:80},
        {n:'Galeras',      la:1.222,   lo:-77.356, co:'Colombia', a:'Activo',    p:72},
        {n:'Etna',         la:37.751,  lo:14.999,  co:'Italia',   a:'Activo',    p:78},
        {n:'Stromboli',    la:38.789,  lo:15.213,  co:'Italia',   a:'Activo',    p:72},
        {n:'Kilauea',      la:19.421,  lo:-155.287,co:'EEUU',     a:'Activo',    p:82},
        {n:'Mauna Loa',    la:19.475,  lo:-155.608,co:'EEUU',     a:'Vigilancia',p:70},
        {n:'Merapi',       la:-7.541,  lo:110.446, co:'Indonesia',a:'Activo',    p:80},
        {n:'Sakurajima',   la:31.585,  lo:130.657, co:'Japón',    a:'Activo',    p:76},
        {n:'Sinabung',     la:3.17,    lo:98.392,  co:'Indonesia',a:'Activo',    p:76},
        {n:'Taal',         la:14.002,  lo:120.993, co:'Filipinas',a:'Vigilancia',p:65},
    ];
    return list.map(function(v) {
        return {
            id:'volc_'+v.n.replace(/\s/g,'_'),
            type:'VOLCÁN', icon:'🌋',
            title:'Volcán '+v.n,
            description:v.a+' — '+v.co,
            lat:v.la, lon:v.lo,
            distKm: lat ? Math.round(calcDistance(lat,lon,v.la,v.lo)) : null,
            time: new Date().toLocaleString('es-CL'),
            source:'Smithsonian GVP', priority:v.p, color:'#ff6600'
        };
    });
}

// ========== 4. ALERTAS CLIMÁTICAS REALES (OWM) ==========
async function fetchWeatherAlerts(lat, lon) {
    if (!lat||!lon) return [];
    var alerts = [];

    try {
        // Datos actuales
        var r = await fetch('https://api.openweathermap.org/data/2.5/weather?lat='+lat+'&lon='+lon+
                            '&appid='+OWM_KEY+'&units=metric&lang=es',
                            {signal: AbortSignal.timeout(8000)});
        var d = await r.json();
        if (!d||!d.main) return [];

        var w = d.weather && d.weather[0] ? d.weather[0] : {};
        var code = w.id || 0;
        var ws = (d.wind&&d.wind.speed||0) * 3.6; // m/s → km/h
        var wg = (d.wind&&d.wind.gust||0) * 3.6;
        var rain1h = d.rain&&d.rain['1h'] ? d.rain['1h'] : 0;
        var snow1h = d.snow&&d.snow['1h'] ? d.snow['1h'] : 0;
        var temp = d.main.temp;
        var city = d.name || '';

        // ── TORMENTAS ELÉCTRICAS (código 2xx) ──
        if (code >= 200 && code < 300) alerts.push({
            id:'thunder_'+Date.now(), type:'TORMENTA ELÉCTRICA', icon:'⛈️',
            title:'Tormenta eléctrica en '+city,
            description:'Tormenta con rayos y precipitaciones — '+w.description,
            lat:lat, lon:lon, distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:72, color:'#FFD700'
        });

        // ── LLUVIA INTENSA (código 5xx o >15mm/h) ──
        if (rain1h > 15 || (code>=500 && code<520 && rain1h>5)) alerts.push({
            id:'rain_'+Date.now(), type:'LLUVIA INTENSA', icon:'🌧️',
            title:'Lluvia intensa '+rain1h.toFixed(1)+' mm/h — '+city,
            description:'Precipitación intensa. Posibles anegamientos.',
            lat:lat, lon:lon, distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:65, color:'#4169E1'
        });

        // ── LLUVIA MODERADA (>5mm/h) ──
        if (rain1h > 5 && rain1h <= 15) alerts.push({
            id:'rain_mod_'+Date.now(), type:'LLUVIA MODERADA', icon:'🌦️',
            title:'Lluvia '+rain1h.toFixed(1)+' mm/h — '+city,
            description:'Precipitación moderada en la zona.',
            lat:lat, lon:lon, distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:45, color:'#6495ED'
        });

        // ── VIENTO FUERTE (>60 km/h) ──
        if (ws > 60) alerts.push({
            id:'wind_'+Date.now(), type:'VIENTO FUERTE', icon:'💨',
            title:'Viento '+Math.round(ws)+' km/h — '+city,
            description:'Viento fuerte'+(wg>60?' con ráfagas de '+Math.round(wg)+' km/h':'')+'. Precaución al manejar.',
            lat:lat, lon:lon, distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:68, color:'#87CEEB'
        });

        // ── VIENTO MODERADO (>40 km/h) ──
        if (ws > 40 && ws <= 60) alerts.push({
            id:'wind_mod_'+Date.now(), type:'VIENTO MODERADO', icon:'🌬️',
            title:'Viento moderado '+Math.round(ws)+' km/h — '+city,
            description:'Advertencia de viento moderado.',
            lat:lat, lon:lon, distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:50, color:'#ADD8E6'
        });

        // ── NEVADA (código 6xx o snow > 2cm/h) ──
        if (snow1h > 2 || (code>=600 && code<700)) alerts.push({
            id:'snow_'+Date.now(), type:'NEVADA', icon:'❄️',
            title:'Nevada '+(snow1h>0?snow1h.toFixed(1)+' cm/h — ':'')+city,
            description:'Nevada'+(snow1h>5?' intensa':'')+'. Condiciones resbaladizas en vías.',
            lat:lat, lon:lon, distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:62, color:'#B0E0E6'
        });

        // ── NIEBLA (código 7xx) ──
        if (code >= 700 && code < 800 && d.visibility && d.visibility < 1000) alerts.push({
            id:'fog_'+Date.now(), type:'NIEBLA', icon:'🌫️',
            title:'Niebla densa — '+city+' (visib. '+(d.visibility/1000).toFixed(1)+' km)',
            description:'Visibilidad reducida. Conducir con precaución.',
            lat:lat, lon:lon, distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:50, color:'#C0C0C0'
        });

        // ── CALOR EXTREMO (>38°C) ──
        if (temp > 38) alerts.push({
            id:'heat_'+Date.now(), type:'CALOR EXTREMO', icon:'🔥',
            title:'Temperatura extrema '+Math.round(temp)+'°C — '+city,
            description:'Condiciones de calor peligroso. Manténgase hidratado.',
            lat:lat, lon:lon, distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:72, color:'#FF4500'
        });

        // ── FRÍO EXTREMO (<-10°C) ──
        if (temp < -10) alerts.push({
            id:'cold_'+Date.now(), type:'FRÍO EXTREMO', icon:'🥶',
            title:'Temperatura muy baja '+Math.round(temp)+'°C — '+city,
            description:'Riesgo de hipotermia. Abríguese bien.',
            lat:lat, lon:lon, distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:68, color:'#00BFFF'
        });

        // ── GRANIZO (código 622) ──
        if (code === 622 || (code>=200&&code<300&&snow1h>0)) alerts.push({
            id:'hail_'+Date.now(), type:'GRANIZO', icon:'🌨️',
            title:'Granizo detectado — '+city,
            description:'Caída de granizo. Proteja vehículos y cultivos.',
            lat:lat, lon:lon, distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:65, color:'#B0C4DE'
        });

    } catch(e) { console.error('OWM weather error:',e); }

    // ── Intentar One Call API v3 para alertas oficiales ──
    try {
        var r2 = await fetch('https://api.openweathermap.org/data/3.0/onecall?lat='+lat+'&lon='+lon+
                             '&appid='+OWM_KEY+'&units=metric&lang=es&exclude=minutely,hourly,daily',
                             {signal: AbortSignal.timeout(8000)});
        var d2 = await r2.json();
        if (d2.alerts && d2.alerts.length) {
            d2.alerts.forEach(function(a) {
                var tipo = 'ALERTA CLIMÁTICA';
                var icono = '⚠️';
                var ev = (a.event||'').toLowerCase();
                if (/wind|viento/i.test(ev))   { tipo='VIENTO FUERTE';       icono='💨'; }
                if (/rain|lluvia/i.test(ev))    { tipo='LLUVIA INTENSA';      icono='🌧️'; }
                if (/storm|tormenta/i.test(ev)) { tipo='TORMENTA';            icono='⛈️'; }
                if (/flood|inundac/i.test(ev))  { tipo='INUNDACIÓN';          icono='💧'; }
                if (/snow|nieve/i.test(ev))     { tipo='NEVADA';              icono='❄️'; }
                if (/fog|niebla/i.test(ev))     { tipo='NIEBLA';              icono='🌫️'; }
                if (/fire|incendio/i.test(ev))  { tipo='INCENDIO';            icono='🔥'; }
                if (/frost|helada/i.test(ev))   { tipo='HELADA';              icono='🧊'; }
                alerts.push({
                    id:'owm_off_'+a.start, type:tipo, icon:icono,
                    title:'⚠️ '+a.event,
                    description:(a.description||'').substring(0,200),
                    lat:lat, lon:lon, distKm:0,
                    time:new Date(a.start*1000).toLocaleString('es-CL'),
                    source:a.sender_name||'OpenWeather Alerts', priority:70, color:'#FF6B6B'
                });
            });
        }
    } catch(e) { /* One Call v3 puede requerir suscripción */ }

    return alerts;
}

// ========== 5. NOAA NHC - Huracanes activos ==========
async function fetchHurricanes() {
    try {
        var url = 'https://api.allorigins.win/raw?url=' +
                  encodeURIComponent('https://www.nhc.noaa.gov/gis/kml/nhc_active.kml');
        var r = await fetch(url, {signal: AbortSignal.timeout(8000)});
        var txt = await r.text();
        var alerts = [];
        var parser = new DOMParser();
        var kml = parser.parseFromString(txt, 'text/xml');
        var placemarks = kml.querySelectorAll('Placemark');
        placemarks.forEach(function(pm) {
            var name = (pm.querySelector('name')||{}).textContent||'';
            var desc = (pm.querySelector('description')||{}).textContent||'';
            var coord = pm.querySelector('coordinates');
            var lat=null, lon=null;
            if (coord) {
                var parts = coord.textContent.trim().split(',');
                lon = parseFloat(parts[0]); lat = parseFloat(parts[1]);
            }
            if (name && /Hurricane|Tropical Storm|Depression|Cyclone|Typhoon/i.test(name)) {
                var tipo = /Hurricane/i.test(name) ? 'HURACÁN' : /Typhoon/i.test(name) ? 'TIFÓN' : 'TORMENTA TROPICAL';
                alerts.push({
                    id:'nhc_'+name.replace(/\s/g,'_'),
                    type:tipo, icon:'🌀',
                    title:name, description:desc.replace(/<[^>]+>/g,'').substring(0,200),
                    lat:lat, lon:lon, distKm:null,
                    time:new Date().toLocaleString('es-CL'),
                    source:'NOAA NHC', priority:92, color:'#9900ff'
                });
            }
        });
        return alerts;
    } catch(e) { console.error('NHC error:',e); return []; }
}

// ========== 6. INCENDIOS NASA FIRMS ==========
async function fetchFires(lat, lon) {
    try {
        // API pública FIRMS sin clave
        var url = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=wildfires&limit=30&days=1';
        var r = await fetch(url, {signal: AbortSignal.timeout(8000)});
        var d = await r.json();
        var fires = [];
        (d.events||[]).forEach(function(ev) {
            var geo = ev.geometry && ev.geometry[0];
            if (!geo) return;
            var flat=null, flon=null;
            if (geo.type==='Point') { flon=geo.coordinates[0]; flat=geo.coordinates[1]; }
            fires.push({
                id:'fire_'+ev.id,
                type:'INCENDIO', icon:'🔥',
                title:ev.title||'Incendio forestal activo',
                description:'NASA EONET — Incendio activo detectado por satélite',
                lat:flat, lon:flon,
                distKm: (lat&&flat) ? Math.round(calcDistance(lat,lon,flat,flon)) : null,
                time:new Date(ev.geometry[0].date||Date.now()).toLocaleString('es-CL'),
                source:'NASA EONET', priority:75, color:'#FF3300'
            });
        });
        return fires;
    } catch(e) { console.error('EONET error:',e); return []; }
}

// ========== CARGA POR UBICACIÓN ==========
async function loadAlertsForLocation(locationInput, radiusKm) {
    radiusKm = radiusKm || 500;
    var lat, lon;
    if (typeof locationInput==='object'&&locationInput.lat) {
        lat=locationInput.lat; lon=locationInput.lon;
    } else {
        var loc=searchLocation(locationInput);
        if(!loc) return [];
        lat=loc.lat; lon=loc.lon;
    }
    console.log('📍 Alertas para:',lat,lon,'radio:',radiusKm,'km');

    var isChile = lat<-17 && lat>-56 && lon>-76 && lon<-65;

    var tasks = [
        fetchUSGS(lat, lon),
        Promise.resolve(getVolcanes(lat, lon)),
        fetchWeatherAlerts(lat, lon),
        fetchHurricanes(),
        fetchFires(lat, lon)
    ];
    if (isChile) tasks.push(fetchCSNChile(lat, lon));

    var results = await Promise.allSettled(tasks);
    var all = [];
    results.forEach(function(r) { if(r.status==='fulfilled') all=all.concat(r.value||[]); });

    return all
        .filter(function(a) { return !a.distKm || a.distKm<=radiusKm; })
        .sort(function(a,b) { return (b.priority||0)-(a.priority||0); });
}

// ========== CARGA GLOBAL ==========
async function loadGlobalAlerts() {
    console.log('🌍 Cargando alertas globales...');
    var results = await Promise.allSettled([
        fetchUSGS(0,0),
        Promise.resolve(getVolcanes(0,0)),
        fetchHurricanes(),
        fetchFires(0,0)
    ]);
    var all = [];
    results.forEach(function(r) { if(r.status==='fulfilled') all=all.concat(r.value||[]); });
    return all
        .filter(function(a) { return (a.priority||0)>=45; })
        .sort(function(a,b) { return (b.priority||0)-(a.priority||0); })
        .slice(0,200);
}

// ========== EXPORTS ==========
window.searchLocation        = searchLocation;
window.loadAlertsForLocation = loadAlertsForLocation;
window.loadGlobalAlerts      = loadGlobalAlerts;
window.calcDistance          = calcDistance;

window.loadExternalSources = function(callback) {
    loadGlobalAlerts()
        .then(function(alerts) {
            console.log('✅ Alertas globales cargadas:', alerts.length);
            if (callback) callback(alerts);
        })
        .catch(function(e) {
            console.error('Error fuentes:', e);
            if (callback) callback([]);
        });
};
