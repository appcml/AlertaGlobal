// ============================================
// js/sources.js v3.0 — Fuentes de alertas
// Más fuentes, más alertas en tiempo real
// ============================================

var OWM_KEY = '6fe6e0dcca264864dbd631bf620aad64';

// ========== BASE DE UBICACIONES ==========
if (typeof window.LocationDatabase === 'undefined') {
    window.LocationDatabase = {
        "chile":           { lat:-30.0,    lon:-71.5,   country:"Chile",     region:"Nacional" },
        "santiago":        { lat:-33.4489, lon:-70.6693, country:"Chile",    region:"Metropolitana" },
        "concepcion":      { lat:-36.8201, lon:-73.0445, country:"Chile",    region:"Biobío" },
        "tirua":           { lat:-38.2704, lon:-73.2490, country:"Chile",    region:"Biobío" },
        "cañete":          { lat:-37.7975, lon:-73.4011, country:"Chile",    region:"Biobío" },
        "temuco":          { lat:-38.7362, lon:-72.5879, country:"Chile",    region:"Araucanía" },
        "valparaiso":      { lat:-33.0472, lon:-71.6127, country:"Chile",    region:"Valparaíso" },
        "antofagasta":     { lat:-23.6345, lon:-70.3996, country:"Chile",    region:"Antofagasta" },
        "iquique":         { lat:-20.2142, lon:-70.1538, country:"Chile",    region:"Tarapacá" },
        "arica":           { lat:-18.4861, lon:-70.2979, country:"Chile",    region:"Arica" },
        "la serena":       { lat:-29.9027, lon:-71.2519, country:"Chile",    region:"Coquimbo" },
        "puerto montt":    { lat:-41.3143, lon:-72.1481, country:"Chile",    region:"Los Lagos" },
        "punta arenas":    { lat:-53.1638, lon:-70.9181, country:"Chile",    region:"Magallanes" },
        "lima":            { lat:-12.0464, lon:-77.0428, country:"Peru",     region:"Lima" },
        "bogota":          { lat:4.7110,   lon:-74.0721, country:"Colombia", region:"Bogotá" },
        "buenos aires":    { lat:-34.6037, lon:-58.3816, country:"Argentina",region:"Buenos Aires" },
        "mexico":          { lat:19.4326,  lon:-99.1332, country:"Mexico",   region:"CDMX" },
        "sao paulo":       { lat:-23.5505, lon:-46.6333, country:"Brasil",   region:"São Paulo" },
        "nueva york":      { lat:40.7128,  lon:-74.0060, country:"EEUU",     region:"Nueva York" },
        "tokyo":           { lat:35.6762,  lon:139.6503, country:"Japón",    region:"Tokio" },
        "madrid":          { lat:40.4168,  lon:-3.7038,  country:"España",   region:"Madrid" },
        "miami":           { lat:25.7617,  lon:-80.1918, country:"EEUU",     region:"Florida" },
        "los angeles":     { lat:34.0522,  lon:-118.2437,country:"EEUU",     region:"California" }
    };
}

function searchLocation(query) {
    if (!query) return null;
    var q = query.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    var db = window.LocationDatabase;
    for (var k in db) {
        var kn = k.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        if (kn === q) return Object.assign({name:k}, db[k]);
    }
    for (var k in db) {
        var kn = k.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        if (kn.includes(q) || q.includes(kn)) return Object.assign({name:k}, db[k]);
    }
    return null;
}

function calcDistance(lat1,lon1,lat2,lon2) {
    if (lat2==null||lon2==null) return 99999;
    var R=6371, dL=(lat2-lat1)*Math.PI/180, dl=(lon2-lon1)*Math.PI/180;
    var a=Math.sin(dL/2)*Math.sin(dL/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dl/2)*Math.sin(dl/2);
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function magColor(m) {
    if (!m) return '#aaa';
    if (m<3) return '#ffcc00'; if (m<4) return '#ff9900';
    if (m<5) return '#ff6600'; if (m<6) return '#ff3300'; return '#cc0000';
}

// ========== 1. SISMOS USGS ==========
async function fetchUSGS(lat, lon) {
    try {
        // Últimas 24 horas, M1.5+, global
        var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                  '&orderby=time&limit=200&minmagnitude=1.5' +
                  '&starttime=' + new Date(Date.now()-86400000).toISOString();
        var r = await fetch(url);
        var d = await r.json();
        return d.features.map(function(f) {
            var p=f.properties, c=f.geometry.coordinates;
            var dist = lat ? Math.round(calcDistance(lat,lon,c[1],c[0])) : null;
            return {
                id:'usgs_'+p.code, type:'SISMO', icon:'🔴',
                title:'Sismo M'+(p.mag?p.mag.toFixed(1):'?'),
                description: p.place||'Sin ubicación',
                lat:c[1], lon:c[0], magnitude:p.mag, depth:c[2],
                distKm:dist,
                time: new Date(p.time).toLocaleString('es-CL'),
                source:'USGS', priority:Math.min(95,Math.round((p.mag||0)*16)),
                color:magColor(p.mag), link:p.url
            };
        });
    } catch(e) { console.error('USGS error:',e); return []; }
}

// ========== 2. VOLCANES ACTIVOS ==========
function getVolcanes(lat, lon) {
    var list = [
        {name:'Villarrica',  lat:-39.4233, lon:-71.9311, country:'Chile',    alert:'Activo',    priority:75},
        {name:'Calbuco',     lat:-41.3295, lon:-72.6084, country:'Chile',    alert:'Activo',    priority:72},
        {name:'Copahue',     lat:-37.856,  lon:-71.173,  country:'Chile',    alert:'Activo',    priority:72},
        {name:'Llaima',      lat:-38.692,  lon:-71.729,  country:'Chile',    alert:'Activo',    priority:70},
        {name:'Hudson',      lat:-45.9,    lon:-72.97,   country:'Chile',    alert:'Vigilancia',priority:58},
        {name:'Osorno',      lat:-41.1,    lon:-72.493,  country:'Chile',    alert:'Vigilancia',priority:55},
        {name:'Lonquimay',   lat:-38.379,  lon:-71.586,  country:'Chile',    alert:'Vigilancia',priority:55},
        {name:'Popocatépetl',lat:19.023,   lon:-98.628,  country:'México',   alert:'Activo',    priority:80},
        {name:'Colima',      lat:19.514,   lon:-103.62,  country:'México',   alert:'Activo',    priority:75},
        {name:'Sabancaya',   lat:-15.787,  lon:-71.857,  country:'Perú',     alert:'Activo',    priority:75},
        {name:'Ubinas',      lat:-16.356,  lon:-70.902,  country:'Perú',     alert:'Activo',    priority:72},
        {name:'Tungurahua',  lat:-1.467,   lon:-78.442,  country:'Ecuador',  alert:'Activo',    priority:75},
        {name:'Cotopaxi',    lat:-0.677,   lon:-78.436,  country:'Ecuador',  alert:'Vigilancia',priority:65},
        {name:'Nevado Ruiz', lat:4.892,    lon:-75.324,  country:'Colombia', alert:'Activo',    priority:78},
        {name:'Galeras',     lat:1.222,    lon:-77.356,  country:'Colombia', alert:'Activo',    priority:72},
        {name:'Etna',        lat:37.751,   lon:14.999,   country:'Italia',   alert:'Activo',    priority:75},
        {name:'Stromboli',   lat:38.789,   lon:15.213,   country:'Italia',   alert:'Activo',    priority:70},
        {name:'Kilauea',     lat:19.421,   lon:-155.287, country:'EEUU',     alert:'Activo',    priority:80},
        {name:'Mauna Loa',   lat:19.475,   lon:-155.608, country:'EEUU',     alert:'Vigilancia',priority:70},
        {name:'Merapi',      lat:-7.541,   lon:110.446,  country:'Indonesia',alert:'Activo',    priority:78},
        {name:'Sinabung',    lat:3.17,     lon:98.392,   country:'Indonesia',alert:'Activo',    priority:75},
        {name:'Sakurajima',  lat:31.585,   lon:130.657,  country:'Japón',    alert:'Activo',    priority:75},
    ];
    return list.map(function(v) {
        var dist = lat ? Math.round(calcDistance(lat,lon,v.lat,v.lon)) : null;
        return {
            id:'volc_'+v.name.replace(/\s/g,'_'), type:'VOLCÁN', icon:'🌋',
            title:'Volcán '+v.name,
            description:v.alert+' — '+v.country,
            lat:v.lat, lon:v.lon, distKm:dist,
            time:new Date().toLocaleString('es-CL'),
            source:'Smithsonian GVP', priority:v.priority, color:'#ff6600'
        };
    });
}

// ========== 3. ALERTAS METEOROLÓGICAS (OpenWeatherMap) ==========
async function fetchWeatherAlerts(lat, lon) {
    if (!lat || !lon) return [];
    try {
        // One Call API para alertas oficiales
        var url = 'https://api.openweathermap.org/data/3.0/onecall?lat='+lat+'&lon='+lon+
                  '&appid='+OWM_KEY+'&units=metric&lang=es&exclude=minutely,hourly,daily';
        var r = await fetch(url);
        var d = await r.json();
        var alerts = [];

        // Alertas oficiales de OWM
        if (d.alerts && d.alerts.length) {
            d.alerts.forEach(function(a) {
                alerts.push({
                    id:'owm_alert_'+a.start,
                    type:a.event.toUpperCase().includes('WIND') ? 'VIENTO FUERTE' :
                         a.event.toUpperCase().includes('RAIN') ? 'LLUVIA INTENSA' :
                         a.event.toUpperCase().includes('STORM') ? 'TORMENTA' :
                         a.event.toUpperCase().includes('FLOOD') ? 'INUNDACIÓN' :
                         a.event.toUpperCase().includes('SNOW') ? 'NEVADA' : 'ALERTA CLIMÁTICA',
                    icon:'⛈️', title:a.event,
                    description:(a.description||'').substring(0,150),
                    lat:lat, lon:lon, distKm:0,
                    time:new Date(a.start*1000).toLocaleString('es-CL'),
                    source:a.sender_name||'OpenWeather', priority:65, color:'#ff6b6b'
                });
            });
        }

        // Condiciones actuales que generan alerta
        var w = d.current;
        if (w) {
            if (w.wind_speed && w.wind_speed*3.6 > 50) alerts.push({
                id:'wind_'+Date.now(), type:'VIENTO FUERTE', icon:'💨',
                title:'Viento fuerte '+Math.round(w.wind_speed*3.6)+' km/h',
                description:'Ráfagas de hasta '+Math.round((w.wind_gust||w.wind_speed)*3.6)+' km/h',
                lat:lat, lon:lon, distKm:0,
                time:new Date().toLocaleString('es-CL'),
                source:'OpenWeather', priority:60, color:'#87CEEB'
            });
            if (w.rain && w.rain['1h'] > 20) alerts.push({
                id:'rain_'+Date.now(), type:'LLUVIA INTENSA', icon:'🌧️',
                title:'Lluvia intensa '+w.rain['1h'].toFixed(1)+' mm/h',
                description:'Precipitación intensa detectada en la zona',
                lat:lat, lon:lon, distKm:0,
                time:new Date().toLocaleString('es-CL'),
                source:'OpenWeather', priority:62, color:'#4169E1'
            });
            if (w.temp > 38) alerts.push({
                id:'heat_'+Date.now(), type:'CALOR EXTREMO', icon:'🔥',
                title:'Temperatura extrema '+Math.round(w.temp)+'°C',
                description:'Condiciones de calor extremo, riesgo para la salud',
                lat:lat, lon:lon, distKm:0,
                time:new Date().toLocaleString('es-CL'),
                source:'OpenWeather', priority:65, color:'#FF4500'
            });
            if (w.temp < -10) alerts.push({
                id:'cold_'+Date.now(), type:'FRÍO EXTREMO', icon:'🥶',
                title:'Temperatura muy baja '+Math.round(w.temp)+'°C',
                description:'Condiciones de frío extremo, riesgo de hipotermia',
                lat:lat, lon:lon, distKm:0,
                time:new Date().toLocaleString('es-CL'),
                source:'OpenWeather', priority:65, color:'#00BFFF'
            });
            var code = (w.weather&&w.weather[0]) ? w.weather[0].id : 0;
            if (code >= 200 && code < 300) alerts.push({
                id:'thunder_'+Date.now(), type:'TORMENTA ELÉCTRICA', icon:'⛈️',
                title:'Tormenta eléctrica activa',
                description:'Tormenta con rayos detectada en la zona',
                lat:lat, lon:lon, distKm:0,
                time:new Date().toLocaleString('es-CL'),
                source:'OpenWeather', priority:68, color:'#FFD700'
            });
            if (w.snow && w.snow['1h'] > 5) alerts.push({
                id:'snow_'+Date.now(), type:'NEVADA INTENSA', icon:'❄️',
                title:'Nevada '+w.snow['1h'].toFixed(1)+' cm/h',
                description:'Nevada intensa detectada',
                lat:lat, lon:lon, distKm:0,
                time:new Date().toLocaleString('es-CL'),
                source:'OpenWeather', priority:60, color:'#B0E0E6'
            });
        }
        return alerts;
    } catch(e) {
        // Fallback: usar endpoint v2.5 básico
        try {
            var r2 = await fetch('https://api.openweathermap.org/data/2.5/weather?lat='+lat+'&lon='+lon+'&appid='+OWM_KEY+'&units=metric&lang=es');
            var d2 = await r2.json();
            var a2 = [];
            if (d2.wind && d2.wind.speed*3.6 > 50) a2.push({
                id:'wind2_'+Date.now(), type:'VIENTO FUERTE', icon:'💨',
                title:'Viento '+Math.round(d2.wind.speed*3.6)+' km/h',
                description:'Viento fuerte en la zona',
                lat:lat, lon:lon, distKm:0,
                time:new Date().toLocaleString('es-CL'),
                source:'OpenWeather', priority:60, color:'#87CEEB'
            });
            return a2;
        } catch(e2) { return []; }
    }
}

// ========== 4. NOAA HURRICANE CENTER ==========
async function fetchHurricanes() {
    try {
        // NOAA Active Storms RSS via proxy
        var url = 'https://api.allorigins.win/raw?url=' +
                  encodeURIComponent('https://www.nhc.noaa.gov/gis/kml/nhc_active.kml');
        var r = await fetch(url, {signal: AbortSignal.timeout(8000)});
        var txt = await r.text();
        var alerts = [];
        var matches = txt.matchAll(/<name>(.*?)<\/name>[\s\S]*?<description>([\s\S]*?)<\/description>/g);
        for (var m of matches) {
            var name = m[1].trim();
            if (name && (name.includes('Hurricane') || name.includes('Tropical') || name.includes('Storm'))) {
                alerts.push({
                    id:'hurr_'+name.replace(/\s/g,'_'),
                    type: name.includes('Hurricane') ? 'HURACÁN' : 'TORMENTA TROPICAL',
                    icon: name.includes('Hurricane') ? '🌀' : '⛈️',
                    title: name, description: 'Sistema activo — NOAA NHC',
                    lat:null, lon:null, distKm:null,
                    time:new Date().toLocaleString('es-CL'),
                    source:'NOAA NHC', priority:90, color:'#9900ff'
                });
            }
        }
        return alerts;
    } catch(e) { return []; }
}

// ========== 5. NASA FIRMS INCENDIOS ==========
async function fetchFires(lat, lon) {
    try {
        // FIRMS VIIRS 24h via CSV público
        var url = 'https://firms.modaps.eosdis.nasa.gov/api/country/csv/c3b2f6b5d7e8a9f1234567890abcdef0/VIIRS_SNPP_NRT/CHL/1';
        var r = await fetch(url, {signal: AbortSignal.timeout(8000)});
        var txt = await r.text();
        var lines = txt.trim().split('\n').slice(1);
        var fires = [];
        lines.slice(0,20).forEach(function(line) {
            var cols = line.split(',');
            if (cols.length < 3) return;
            var flat = parseFloat(cols[0]), flon = parseFloat(cols[1]);
            if (isNaN(flat)||isNaN(flon)) return;
            var dist = lat ? Math.round(calcDistance(lat,lon,flat,flon)) : null;
            fires.push({
                id:'fire_'+flat+'_'+flon, type:'INCENDIO', icon:'🔥',
                title:'Foco de calor detectado',
                description:'NASA FIRMS — Satélite VIIRS',
                lat:flat, lon:flon, distKm:dist,
                time:new Date().toLocaleString('es-CL'),
                source:'NASA FIRMS', priority:70, color:'#FF3300'
            });
        });
        return fires;
    } catch(e) { return []; }
}

// ========== CARGA POR UBICACIÓN ==========
async function loadAlertsForLocation(locationInput, radiusKm) {
    radiusKm = radiusKm || 500;
    var lat, lon;
    if (typeof locationInput === 'object' && locationInput.lat) {
        lat = locationInput.lat; lon = locationInput.lon;
    } else {
        var loc = searchLocation(locationInput);
        if (!loc) return [];
        lat = loc.lat; lon = loc.lon;
    }
    console.log('📍 Cargando alertas para:', lat, lon, 'radio:', radiusKm, 'km');

    var results = await Promise.allSettled([
        fetchUSGS(lat, lon),
        Promise.resolve(getVolcanes(lat, lon)),
        fetchWeatherAlerts(lat, lon),
        fetchHurricanes(),
        fetchFires(lat, lon)
    ]);

    var all = [];
    results.forEach(function(r) {
        if (r.status === 'fulfilled') all = all.concat(r.value||[]);
    });

    return all
        .filter(function(a) { return !a.distKm || a.distKm <= radiusKm; })
        .sort(function(a,b) { return (b.priority||0)-(a.priority||0); });
}

// ========== CARGA GLOBAL ==========
async function loadGlobalAlerts() {
    console.log('🌍 Cargando alertas globales...');
    var results = await Promise.allSettled([
        fetchUSGS(0,0),
        Promise.resolve(getVolcanes(0,0)),
        fetchHurricanes()
    ]);
    var all = [];
    results.forEach(function(r) {
        if (r.status === 'fulfilled') all = all.concat(r.value||[]);
    });
    return all
        .filter(function(a) { return (a.priority||0) >= 50; })
        .sort(function(a,b) { return (b.priority||0)-(a.priority||0); })
        .slice(0,150);
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
