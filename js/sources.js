// ============================================
// js/sources.js v5.0
// Alertas climáticas por pronóstico + sismos sin límite de radio
// ============================================

var OWM_KEY = '6fe6e0dcca264864dbd631bf620aad64';

if (typeof window.LocationDatabase === 'undefined') {
    window.LocationDatabase = {
        "chile":        {lat:-30.0,   lon:-71.5,  country:"Chile",    region:"Nacional"},
        "santiago":     {lat:-33.449, lon:-70.669,country:"Chile",    region:"Metropolitana"},
        "concepcion":   {lat:-36.820, lon:-73.044,country:"Chile",    region:"Biobío"},
        "tirua":        {lat:-38.270, lon:-73.249,country:"Chile",    region:"Biobío"},
        "cañete":       {lat:-37.797, lon:-73.401,country:"Chile",    region:"Biobío"},
        "temuco":       {lat:-38.736, lon:-72.588,country:"Chile",    region:"Araucanía"},
        "valparaiso":   {lat:-33.047, lon:-71.613,country:"Chile",    region:"Valparaíso"},
        "antofagasta":  {lat:-23.635, lon:-70.400,country:"Chile",    region:"Antofagasta"},
        "iquique":      {lat:-20.214, lon:-70.154,country:"Chile",    region:"Tarapacá"},
        "arica":        {lat:-18.486, lon:-70.298,country:"Chile",    region:"Arica"},
        "la serena":    {lat:-29.903, lon:-71.252,country:"Chile",    region:"Coquimbo"},
        "puerto montt": {lat:-41.314, lon:-72.148,country:"Chile",    region:"Los Lagos"},
        "punta arenas": {lat:-53.164, lon:-70.918,country:"Chile",    region:"Magallanes"},
        "valdivia":     {lat:-39.814, lon:-73.246,country:"Chile",    region:"Los Ríos"},
        "osorno":       {lat:-40.573, lon:-73.135,country:"Chile",    region:"Los Lagos"},
        "lima":         {lat:-12.046, lon:-77.043,country:"Peru",     region:"Lima"},
        "bogota":       {lat:4.711,   lon:-74.072,country:"Colombia", region:"Bogotá"},
        "buenos aires": {lat:-34.604, lon:-58.382,country:"Argentina",region:"Buenos Aires"},
        "mexico":       {lat:19.433,  lon:-99.133,country:"Mexico",   region:"CDMX"},
        "sao paulo":    {lat:-23.550, lon:-46.633,country:"Brasil",   region:"São Paulo"},
        "nueva york":   {lat:40.713,  lon:-74.006,country:"EEUU",     region:"Nueva York"},
        "miami":        {lat:25.762,  lon:-80.192,country:"EEUU",     region:"Florida"},
        "tokyo":        {lat:35.676,  lon:139.650,country:"Japón",    region:"Tokio"},
        "madrid":       {lat:40.417,  lon:-3.704, country:"España",   region:"Madrid"},
    };
}

function searchLocation(q) {
    if (!q) return null;
    var s=q.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    var db=window.LocationDatabase;
    for(var k in db){var n=k.normalize('NFD').replace(/[\u0300-\u036f]/g,'');if(n===s)return Object.assign({name:k},db[k]);}
    for(var k in db){var n=k.normalize('NFD').replace(/[\u0300-\u036f]/g,'');if(n.includes(s)||s.includes(n))return Object.assign({name:k},db[k]);}
    return null;
}

function calcDistance(la1,lo1,la2,lo2) {
    if(la2==null||lo2==null) return 99999;
    var R=6371,dL=(la2-la1)*Math.PI/180,dl=(lo2-lo1)*Math.PI/180;
    var a=Math.sin(dL/2)*Math.sin(dL/2)+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dl/2)*Math.sin(dl/2);
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// ========== 1. SISMOS USGS — GLOBAL SIN FILTRO ==========
async function fetchUSGS(lat, lon) {
    try {
        var since = new Date(Date.now()-86400000).toISOString();
        var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=250&minmagnitude=2.5&starttime='+since;
        var d = await (await fetch(url,{signal:AbortSignal.timeout(12000)})).json();
        return d.features.map(function(f) {
            var p=f.properties, c=f.geometry.coordinates, mag=p.mag||0;
            return {
                id:'usgs_'+p.code,
                type:'SISMO',
                icon: mag>=6?'🔴':mag>=5?'🟠':mag>=4?'🟡':'⚪',
                title:'Sismo M'+mag.toFixed(1),
                description:(p.place||'Sin ubicación')+' — Prof. '+(c[2]?Math.round(c[2])+'km':'?km'),
                lat:c[1], lon:c[0], magnitude:mag, depth:c[2],
                distKm: lat ? Math.round(calcDistance(lat,lon,c[1],c[0])) : null,
                time: new Date(p.time).toLocaleString('es-CL'),
                source:'USGS', link:p.url,
                priority: mag>=7?96:mag>=6?88:mag>=5?76:mag>=4?62:mag>=3?48:35,
                color: mag>=6?'#ff0000':mag>=5?'#ff4400':mag>=4?'#ff9900':mag>=3?'#ffcc00':'#ffee88'
            };
        });
    } catch(e) { console.error('USGS:',e); return []; }
}

// ========== 2. VOLCANES ==========
function getVolcanes(lat, lon) {
    var V=[
        {n:'Villarrica', la:-39.423,lo:-71.931,co:'Chile',a:'Activo',p:80},
        {n:'Calbuco',    la:-41.330,lo:-72.608,co:'Chile',a:'Activo',p:76},
        {n:'Copahue',    la:-37.856,lo:-71.173,co:'Chile',a:'Activo',p:74},
        {n:'Llaima',     la:-38.692,lo:-71.729,co:'Chile',a:'Activo',p:72},
        {n:'Osorno',     la:-41.100,lo:-72.493,co:'Chile',a:'Vigilancia',p:58},
        {n:'Chaitén',    la:-42.833,lo:-72.646,co:'Chile',a:'Vigilancia',p:62},
        {n:'Hudson',     la:-45.900,lo:-72.970,co:'Chile',a:'Vigilancia',p:55},
        {n:'Popocatépetl',la:19.023,lo:-98.628,co:'México',a:'Activo',p:84},
        {n:'Colima',     la:19.514, lo:-103.62,co:'México',a:'Activo',p:78},
        {n:'Sabancaya',  la:-15.787,lo:-71.857,co:'Perú',  a:'Activo',p:78},
        {n:'Ubinas',     la:-16.356,lo:-70.902,co:'Perú',  a:'Activo',p:73},
        {n:'Tungurahua', la:-1.467, lo:-78.442,co:'Ecuador',a:'Activo',p:76},
        {n:'Cotopaxi',   la:-0.677, lo:-78.436,co:'Ecuador',a:'Vigilancia',p:66},
        {n:'Nevado Ruiz',la:4.892,  lo:-75.324,co:'Colombia',a:'Activo',p:82},
        {n:'Etna',       la:37.751, lo:14.999, co:'Italia',a:'Activo',p:78},
        {n:'Kilauea',    la:19.421, lo:-155.28,co:'EEUU',  a:'Activo',p:82},
        {n:'Merapi',     la:-7.541, lo:110.446,co:'Indonesia',a:'Activo',p:80},
        {n:'Sakurajima', la:31.585, lo:130.657,co:'Japón', a:'Activo',p:76},
    ];
    return V.map(function(v){
        return {
            id:'volc_'+v.n.replace(/\s/g,'_'),
            type:'VOLCÁN', icon:'🌋',
            title:'Volcán '+v.n,
            description:v.a+' — '+v.co,
            lat:v.la, lon:v.lo,
            distKm: lat?Math.round(calcDistance(lat,lon,v.la,v.lo)):null,
            time: new Date().toLocaleString('es-CL'),
            source:'Smithsonian GVP', priority:v.p, color:'#ff6600'
        };
    });
}

// ========== 3. ALERTAS CLIMÁTICAS — ACTUAL + PRONÓSTICO ==========
async function fetchWeatherAlerts(lat, lon) {
    if (!lat||!lon) return [];
    var alerts = [];

    try {
        // Datos actuales
        var cur = await (await fetch(
            'https://api.openweathermap.org/data/2.5/weather?lat='+lat+'&lon='+lon+
            '&appid='+OWM_KEY+'&units=metric&lang=es',
            {signal:AbortSignal.timeout(8000)}
        )).json();

        if (!cur||!cur.main) return [];

        var city = cur.name||'';
        var ws = (cur.wind&&cur.wind.speed||0)*3.6;
        var wg = (cur.wind&&cur.wind.gust||0)*3.6;
        var rain = cur.rain&&cur.rain['1h'] ? cur.rain['1h'] : 0;
        var snow = cur.snow&&cur.snow['1h'] ? cur.snow['1h'] : 0;
        var temp = cur.main.temp;
        var feels = cur.main.feels_like;
        var humid = cur.main.humidity;
        var vis = cur.visibility||10000;
        var code = cur.weather&&cur.weather[0] ? cur.weather[0].id : 800;
        var wdesc = cur.weather&&cur.weather[0] ? cur.weather[0].description : '';

        // Tormenta eléctrica
        if (code>=200&&code<300) alerts.push({
            id:'thunder_'+Date.now(), type:'TORMENTA ELÉCTRICA', icon:'⛈️',
            title:'Tormenta eléctrica — '+city,
            description:'Tormenta con rayos activa. '+wdesc+'. Manténgase en interior.',
            lat:lat,lon:lon,distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:80, color:'#FFD700'
        });

        // Lluvia intensa
        if (rain>15) alerts.push({
            id:'rain_heavy_'+Date.now(), type:'LLUVIA INTENSA', icon:'🌧️',
            title:'Lluvia intensa '+rain.toFixed(1)+' mm/h — '+city,
            description:'Precipitación intensa. Riesgo de anegamientos y deslizamientos.',
            lat:lat,lon:lon,distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:72, color:'#1E90FF'
        });
        else if (rain>5) alerts.push({
            id:'rain_mod_'+Date.now(), type:'LLUVIA MODERADA', icon:'🌦️',
            title:'Lluvia '+rain.toFixed(1)+' mm/h — '+city,
            description:'Precipitación moderada. Conduzca con precaución.',
            lat:lat,lon:lon,distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:48, color:'#4169E1'
        });
        else if (rain>1) alerts.push({
            id:'rain_light_'+Date.now(), type:'LLUVIA', icon:'🌂',
            title:'Lluvia '+rain.toFixed(1)+' mm/h — '+city,
            description:'Precipitación leve en la zona.',
            lat:lat,lon:lon,distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:32, color:'#6495ED'
        });
        else if (code>=500&&code<600) alerts.push({
            id:'rain_drizzle_'+Date.now(), type:'LLOVIZNA', icon:'🌂',
            title:'Llovizna — '+city+' ('+wdesc+')',
            description:'Precipitación leve detectada.',
            lat:lat,lon:lon,distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:28, color:'#B0C4DE'
        });

        // Viento fuerte
        if (ws>70) alerts.push({
            id:'wind_str_'+Date.now(), type:'VIENTO FUERTE', icon:'💨',
            title:'Viento muy fuerte '+Math.round(ws)+' km/h — '+city,
            description:'Viento fuerte'+(wg>50?' con ráfagas de '+Math.round(wg)+' km/h':'')+'. Riesgo de árboles caídos.',
            lat:lat,lon:lon,distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:72, color:'#87CEEB'
        });
        else if (ws>40) alerts.push({
            id:'wind_mod_'+Date.now(), type:'VIENTO MODERADO', icon:'🌬️',
            title:'Viento moderado '+Math.round(ws)+' km/h — '+city,
            description:'Advertencia de viento moderado'+(wg>0?' (ráfagas '+Math.round(wg)+' km/h)':'')+'. Precaución.',
            lat:lat,lon:lon,distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:55, color:'#ADD8E6'
        });
        else if (ws>20) alerts.push({
            id:'wind_light_'+Date.now(), type:'VIENTO', icon:'🌬️',
            title:'Viento '+Math.round(ws)+' km/h'+(wg>20?' (ráf. '+Math.round(wg)+' km/h)':'')+' — '+city,
            description:'Viento moderado en la zona.',
            lat:lat,lon:lon,distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:38, color:'#E0FFFF'
        });

        // Nevada
        if (snow>2||(code>=600&&code<700)) alerts.push({
            id:'snow_'+Date.now(), type:'NEVADA', icon:'❄️',
            title:'Nevada'+(snow>0?' '+snow.toFixed(1)+' cm/h':'')+' — '+city,
            description:'Nevada'+(snow>5?' intensa':'')+'. Vías resbaladizas. Use neumáticos de invierno.',
            lat:lat,lon:lon,distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:65, color:'#B0E0E6'
        });

        // Niebla densa
        if ((code>=700&&code<800) && vis<500) alerts.push({
            id:'fog_'+Date.now(), type:'NIEBLA DENSA', icon:'🌫️',
            title:'Niebla densa — '+city+' (visib. '+(vis/1000).toFixed(1)+' km)',
            description:'Visibilidad muy reducida. Peligro en rutas y aeropuertos.',
            lat:lat,lon:lon,distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:60, color:'#C0C0C0'
        });

        // Calor extremo
        if (temp>38) alerts.push({
            id:'heat_'+Date.now(), type:'CALOR EXTREMO', icon:'🔥',
            title:'Temperatura extrema '+Math.round(temp)+'°C (sens. '+Math.round(feels)+'°C) — '+city,
            description:'Condiciones de calor peligroso. Hidratarse. Evitar exposición solar.',
            lat:lat,lon:lon,distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:75, color:'#FF4500'
        });

        // Frío extremo
        if (feels<-15) alerts.push({
            id:'cold_'+Date.now(), type:'FRÍO EXTREMO', icon:'🥶',
            title:'Temperatura polar '+Math.round(temp)+'°C (sens. '+Math.round(feels)+'°C) — '+city,
            description:'Riesgo de hipotermia. Abríguese. Evite exposición prolongada.',
            lat:lat,lon:lon,distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:72, color:'#00BFFF'
        });

        // Granizo
        if (code===622||(code>=200&&code<300&&snow>0)) alerts.push({
            id:'hail_'+Date.now(), type:'GRANIZO', icon:'🌨️',
            title:'Granizo — '+city,
            description:'Caída de granizo detectada. Proteja vehículos y cultivos.',
            lat:lat,lon:lon,distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:68, color:'#B0C4DE'
        });

        // Sequía/Humedad muy baja
        if (humid<20&&temp>25) alerts.push({
            id:'dry_'+Date.now(), type:'RIESGO INCENDIO', icon:'🔥',
            title:'Alto riesgo de incendio — '+city,
            description:'Temperatura '+Math.round(temp)+'°C y humedad '+humid+'%. Condiciones propensas a incendios.',
            lat:lat,lon:lon,distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenWeatherMap', priority:70, color:'#FF6600'
        });

    } catch(e) { console.error('OWM actual:',e); }

    // ── PRONÓSTICO: alertas en las próximas horas ──
    try {
        var fct = await (await fetch(
            'https://api.openweathermap.org/data/2.5/forecast?lat='+lat+'&lon='+lon+
            '&appid='+OWM_KEY+'&units=metric&lang=es&cnt=8',
            {signal:AbortSignal.timeout(8000)}
        )).json();

        if (fct&&fct.list) {
            var maxRain=0, maxWind=0, maxTemp=-99, minTemp=99, hasStorm=false, hasSnow=false;
            fct.list.forEach(function(item) {
                var r=item.rain&&item.rain['3h']?item.rain['3h']:0;
                var s=item.snow&&item.snow['3h']?item.snow['3h']:0;
                var w=(item.wind&&item.wind.speed||0)*3.6;
                var t=item.main&&item.main.temp||0;
                var c=item.weather&&item.weather[0]?item.weather[0].id:800;
                if(r>maxRain) maxRain=r;
                if(w>maxWind) maxWind=w;
                if(t>maxTemp) maxTemp=t;
                if(t<minTemp) minTemp=t;
                if(c>=200&&c<300) hasStorm=true;
                if(s>0) hasSnow=true;
            });

            var city2 = fct.city&&fct.city.name ? fct.city.name : '';

            if (maxRain>20) alerts.push({
                id:'fct_rain_'+Date.now(), type:'ALERTA LLUVIA 24H', icon:'⚠️',
                title:'Lluvia fuerte esperada: '+maxRain.toFixed(0)+' mm — '+city2,
                description:'Pronóstico de lluvia intensa en las próximas 24 horas. Posibles anegamientos.',
                lat:lat,lon:lon,distKm:0,
                time:'Próximas 24h',
                source:'OpenWeatherMap Forecast', priority:65, color:'#1E90FF'
            });
            if (maxWind>80) alerts.push({
                id:'fct_wind_'+Date.now(), type:'ALERTA VIENTO 24H', icon:'⚠️',
                title:'Viento fuerte esperado: '+Math.round(maxWind)+' km/h — '+city2,
                description:'Vientos fuertes pronosticados. Asegure objetos en exterior.',
                lat:lat,lon:lon,distKm:0,
                time:'Próximas 24h',
                source:'OpenWeatherMap Forecast', priority:62, color:'#87CEEB'
            });
            if (hasStorm) alerts.push({
                id:'fct_storm_'+Date.now(), type:'TORMENTA ESPERADA', icon:'⛈️',
                title:'Tormentas esperadas próximas horas — '+city2,
                description:'Tormentas eléctricas pronosticadas en las próximas 24h. Precaución.',
                lat:lat,lon:lon,distKm:0,
                time:'Próximas 24h',
                source:'OpenWeatherMap Forecast', priority:68, color:'#FFD700'
            });
            if (hasSnow) alerts.push({
                id:'fct_snow_'+Date.now(), type:'NEVADA ESPERADA', icon:'❄️',
                title:'Nevada pronosticada — '+city2,
                description:'Se esperan nevadas en las próximas horas. Precaución en vías.',
                lat:lat,lon:lon,distKm:0,
                time:'Próximas 24h',
                source:'OpenWeatherMap Forecast', priority:58, color:'#B0E0E6'
            });
        }
    } catch(e) { console.error('OWM forecast:',e); }

    return alerts;
}

// ========== 4. HURACANES NOAA NHC ==========
async function fetchHurricanes() {
    try {
        var url='https://api.allorigins.win/raw?url='+encodeURIComponent('https://www.nhc.noaa.gov/gis/kml/nhc_active.kml');
        var txt=await (await fetch(url,{signal:AbortSignal.timeout(8000)})).text();
        var kml=new DOMParser().parseFromString(txt,'text/xml');
        var alerts=[];
        kml.querySelectorAll('Placemark').forEach(function(pm) {
            var name=(pm.querySelector('name')||{}).textContent||'';
            if(!/Hurricane|Tropical Storm|Cyclone|Typhoon/i.test(name)) return;
            var coord=pm.querySelector('coordinates');
            var lat=null,lon=null;
            if(coord){var p=coord.textContent.trim().split(',');lon=parseFloat(p[0]);lat=parseFloat(p[1]);}
            alerts.push({
                id:'nhc_'+name.replace(/\s/g,'_'),
                type:/Hurricane/i.test(name)?'HURACÁN':'TORMENTA TROPICAL', icon:'🌀',
                title:name,
                description:'Sistema tropical activo — NOAA NHC. Siga las instrucciones de las autoridades.',
                lat:lat,lon:lon,distKm:null,
                time:new Date().toLocaleString('es-CL'),
                source:'NOAA NHC', priority:95, color:'#9900ff'
            });
        });
        return alerts;
    } catch(e) { return []; }
}

// ========== 5. INCENDIOS NASA EONET ==========
async function fetchFires(lat,lon) {
    try {
        var d=await (await fetch(
            'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=wildfires&limit=50&days=2',
            {signal:AbortSignal.timeout(8000)}
        )).json();
        return (d.events||[]).map(function(ev) {
            var geo=ev.geometry&&ev.geometry[0];
            var flat=null,flon=null;
            if(geo&&geo.type==='Point'){flon=geo.coordinates[0];flat=geo.coordinates[1];}
            return {
                id:'fire_'+ev.id, type:'INCENDIO', icon:'🔥',
                title:ev.title||'Incendio activo',
                description:'Incendio forestal detectado por satélite (NASA EONET)',
                lat:flat,lon:flon,
                distKm:(lat&&flat)?Math.round(calcDistance(lat,lon,flat,flon)):null,
                time:new Date((ev.geometry[0]&&ev.geometry[0].date)||Date.now()).toLocaleString('es-CL'),
                source:'NASA EONET', priority:78, color:'#FF3300'
            };
        });
    } catch(e) { return []; }
}

// ========== CARGA POR UBICACIÓN ==========
async function loadAlertsForLocation(locationInput, radiusKm) {
    radiusKm = radiusKm||500;
    var lat,lon;
    if (typeof locationInput==='object'&&locationInput.lat) {
        lat=locationInput.lat; lon=locationInput.lon;
    } else {
        var loc=searchLocation(locationInput);
        if(!loc) return [];
        lat=loc.lat; lon=loc.lon;
    }

    var tasks=[
        fetchUSGS(lat,lon),
        Promise.resolve(getVolcanes(lat,lon)),
        fetchWeatherAlerts(lat,lon),
        fetchHurricanes(),
        fetchFires(lat,lon)
    ];

    var all=[];
    (await Promise.allSettled(tasks)).forEach(function(r){if(r.status==='fulfilled')all=all.concat(r.value||[]);});

    return all
        .filter(function(a){ return !a.distKm||a.distKm<=radiusKm||a.distKm===0; })
        .sort(function(a,b){ return (b.priority||0)-(a.priority||0); });
}

// ========== CARGA GLOBAL ==========
async function loadGlobalAlerts() {
    console.log('🌍 Cargando alertas globales...');
    var all=[];
    (await Promise.allSettled([
        fetchUSGS(0,0),
        Promise.resolve(getVolcanes(0,0)),
        fetchHurricanes(),
        fetchFires(0,0)
    ])).forEach(function(r){if(r.status==='fulfilled')all=all.concat(r.value||[]);});

    return all
        .filter(function(a){return (a.priority||0)>=40;})
        .sort(function(a,b){return (b.priority||0)-(a.priority||0);})
        .slice(0,250);
}

// ========== EXPORTS ==========
window.searchLocation        = searchLocation;
window.loadAlertsForLocation = loadAlertsForLocation;
window.loadGlobalAlerts      = loadGlobalAlerts;
window.calcDistance          = calcDistance;

window.loadExternalSources = function(cb) {
    loadGlobalAlerts()
        .then(function(a){console.log('✅ Alertas globales cargadas:',a.length);if(cb)cb(a);})
        .catch(function(e){console.error('Error:',e);if(cb)cb([]);});
};
