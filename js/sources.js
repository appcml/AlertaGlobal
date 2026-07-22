// ============================================
// js/sources.js v6.0
// Open-Meteo (sin API key) + USGS + Volcanes + NOAA
// ============================================

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

// ========== 1. OPEN-METEO — Sin API key, muy preciso ==========
async function fetchOpenMeteoAlerts(lat, lon, cityName) {
    if (!lat||!lon) return [];
    try {
        // Condiciones actuales + pronóstico 24h + alertas
        var url = 'https://api.open-meteo.com/v1/forecast?' +
            'latitude='+lat+'&longitude='+lon +
            '&current=temperature_2m,relative_humidity_2m,apparent_temperature,' +
            'precipitation,rain,showers,snowfall,wind_speed_10m,wind_gusts_10m,' +
            'wind_direction_10m,weather_code,surface_pressure,visibility,is_day' +
            '&hourly=precipitation_probability,precipitation,wind_speed_10m,temperature_2m' +
            '&forecast_days=2&timezone=auto&wind_speed_unit=kmh';

        var r = await fetch(url, {signal:AbortSignal.timeout(10000)});
        var d = await r.json();
        if (!d||!d.current) return [];

        var c = d.current;
        var city = cityName || (lat.toFixed(2)+','+lon.toFixed(2));
        var alerts = [];
        var now = new Date().toLocaleString('es-CL');

        var temp     = c.temperature_2m || 0;
        var feels    = c.apparent_temperature || temp;
        var humid    = c.relative_humidity_2m || 0;
        var ws       = c.wind_speed_10m || 0;      // ya en km/h
        var wg       = c.wind_gusts_10m || 0;
        var rain     = c.rain || c.precipitation || 0;
        var snow     = c.snowfall || 0;
        var code     = c.weather_code || 0;
        var pressure = c.surface_pressure || 1013;
        var vis      = c.visibility || 10000;

        // ── Decodificar WMO weather codes ──
        // https://open-meteo.com/en/docs#weathervariables
        function wmoDesc(code) {
            if (code===0) return 'Despejado';
            if (code<=3) return 'Parcialmente nublado';
            if (code<=49) return 'Niebla';
            if (code<=59) return 'Llovizna';
            if (code<=69) return 'Lluvia';
            if (code<=79) return 'Nieve';
            if (code<=82) return 'Chubascos';
            if (code<=84) return 'Granizo';
            if (code<=94) return 'Tormenta';
            if (code<=99) return 'Tormenta con granizo';
            return 'Condición especial';
        }

        // ── TORMENTAS (80-99) ──
        if (code>=95) {
            alerts.push({
                id:'om_thunder_'+Date.now(), type:'TORMENTA ELÉCTRICA', icon:'⛈️',
                title:'Tormenta eléctrica'+(code>=96?' con granizo':'')+' — '+city,
                description:'Tormenta activa con rayos y lluvia intensa. Refugiarse en interior.',
                lat:lat,lon:lon,distKm:0, time:now,
                source:'Open-Meteo', priority:85, color:'#FFD700'
            });
        } else if (code>=80) {
            alerts.push({
                id:'om_shower_'+Date.now(), type:'CHUBASCOS FUERTES', icon:'🌦️',
                title:'Chubascos fuertes — '+city,
                description:'Precipitación intensa por chubascos. Conducir con precaución.',
                lat:lat,lon:lon,distKm:0, time:now,
                source:'Open-Meteo', priority:65, color:'#4169E1'
            });
        }

        // ── LLUVIA ──
        if (rain>20) alerts.push({
            id:'om_rain_h_'+Date.now(), type:'LLUVIA INTENSA', icon:'🌧️',
            title:'Lluvia intensa '+rain.toFixed(1)+' mm/h — '+city,
            description:'Precipitación intensa. Riesgo de anegamientos y aludes.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:78, color:'#1E90FF'
        });
        else if (rain>5) alerts.push({
            id:'om_rain_m_'+Date.now(), type:'LLUVIA MODERADA', icon:'🌧️',
            title:'Lluvia '+rain.toFixed(1)+' mm/h — '+city,
            description:'Precipitación moderada. Vías mojadas, conducir despacio.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:52, color:'#4169E1'
        });
        else if (rain>0.5||(code>=51&&code<70)) alerts.push({
            id:'om_rain_l_'+Date.now(), type:'LLOVIZNA', icon:'🌂',
            title:'Llovizna — '+city+' ('+wmoDesc(code)+')',
            description:'Precipitación leve. '+wmoDesc(code)+'.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:30, color:'#87CEEB'
        });

        // ── NIEVE ──
        if (snow>5) alerts.push({
            id:'om_snow_h_'+Date.now(), type:'NEVADA INTENSA', icon:'❄️',
            title:'Nevada intensa '+snow.toFixed(1)+' cm/h — '+city,
            description:'Nevada intensa. Rutas cortadas posibles. Neumáticos de invierno obligatorios.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:75, color:'#B0E0E6'
        });
        else if (snow>0||(code>=70&&code<80)) alerts.push({
            id:'om_snow_l_'+Date.now(), type:'NEVADA', icon:'❄️',
            title:'Nevada — '+city,
            description:'Caída de nieve detectada. Vías resbaladizas.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:62, color:'#B0E0E6'
        });

        // ── GRANIZO ──
        if (code>=84&&code<=87) alerts.push({
            id:'om_hail_'+Date.now(), type:'GRANIZO', icon:'🌨️',
            title:'Granizo — '+city,
            description:'Caída de granizo. Proteger vehículos y cultivos.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:70, color:'#B0C4DE'
        });

        // ── VIENTO ──
        if (ws>80) alerts.push({
            id:'om_wind_ex_'+Date.now(), type:'VIENTO EXTREMO', icon:'🌬️',
            title:'Viento extremo '+Math.round(ws)+' km/h (ráf. '+Math.round(wg)+') — '+city,
            description:'Viento peligroso. Riesgo de árboles y estructuras caídas. No salir.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:90, color:'#FF0000'
        });
        else if (ws>55) alerts.push({
            id:'om_wind_st_'+Date.now(), type:'VIENTO FUERTE', icon:'💨',
            title:'Viento fuerte '+Math.round(ws)+' km/h (ráf. '+Math.round(wg)+') — '+city,
            description:'Viento fuerte. Precaución al conducir y en zonas boscosas.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:72, color:'#FF6B35'
        });
        else if (ws>35) alerts.push({
            id:'om_wind_m_'+Date.now(), type:'VIENTO MODERADO', icon:'🌬️',
            title:'Viento moderado '+Math.round(ws)+' km/h — '+city,
            description:'Viento'+(wg>30?' con ráfagas de '+Math.round(wg)+' km/h':'')+'. Advertencia moderada.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:48, color:'#FFA500'
        });
        else if (ws>15) alerts.push({
            id:'om_wind_l_'+Date.now(), type:'VIENTO', icon:'🌬️',
            title:'Viento '+Math.round(ws)+' km/h — '+city,
            description:'Viento leve a moderado.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:28, color:'#ADD8E6'
        });

        // ── NIEBLA ──
        if ((code>=40&&code<50)||vis<1000) alerts.push({
            id:'om_fog_'+Date.now(), type:'NIEBLA', icon:'🌫️',
            title:'Niebla'+(vis<500?' densa':'')+' — '+city+' (visib. '+(vis/1000).toFixed(1)+' km)',
            description:'Visibilidad reducida. Peligro en rutas y vuelos.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:vis<500?65:48, color:'#C0C0C0'
        });

        // ── TEMPERATURA EXTREMA ──
        if (temp>38||feels>40) alerts.push({
            id:'om_heat_'+Date.now(), type:'CALOR EXTREMO', icon:'🔥',
            title:'Calor extremo '+Math.round(temp)+'°C (sens. '+Math.round(feels)+'°C) — '+city,
            description:'Temperatura peligrosa. Hidratarse y evitar exposición solar.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:80, color:'#FF4500'
        });
        else if (temp>32) alerts.push({
            id:'om_hot_'+Date.now(), type:'CALOR INTENSO', icon:'☀️',
            title:'Temperatura alta '+Math.round(temp)+'°C — '+city,
            description:'Temperatura elevada. Hidratarse bien.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:45, color:'#FF8C00'
        });

        if (feels<-20) alerts.push({
            id:'om_polar_'+Date.now(), type:'FRÍO POLAR', icon:'🥶',
            title:'Frío polar '+Math.round(temp)+'°C (sens. '+Math.round(feels)+'°C) — '+city,
            description:'Condición polar. Riesgo de hipotermia. No salir sin ropa adecuada.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:85, color:'#0000CD'
        });
        else if (feels<-5) alerts.push({
            id:'om_cold_'+Date.now(), type:'FRÍO INTENSO', icon:'🧊',
            title:'Frío intenso '+Math.round(temp)+'°C (sens. '+Math.round(feels)+'°C) — '+city,
            description:'Temperatura muy baja. Riesgo de heladas y congelamiento de vías.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:65, color:'#4169E1'
        });
        else if (temp<2) alerts.push({
            id:'om_frost_'+Date.now(), type:'HELADA', icon:'🧊',
            title:'Helada posible — '+city+' ('+Math.round(temp)+'°C)',
            description:'Temperatura cerca del punto de congelamiento. Helada posible en superficies.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:55, color:'#00BFFF'
        });

        // ── SEQUÍA/RIESGO INCENDIO ──
        if (humid<20&&temp>28) alerts.push({
            id:'om_fire_risk_'+Date.now(), type:'RIESGO DE INCENDIO', icon:'🔥',
            title:'Alto riesgo de incendio — '+city,
            description:'Temp '+Math.round(temp)+'°C, humedad '+humid+'%, viento '+Math.round(ws)+' km/h. Condiciones extremas para incendios.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:78, color:'#FF6600'
        });

        // ── PRESIÓN BAJA (sistema de tormenta) ──
        if (pressure<990) alerts.push({
            id:'om_low_p_'+Date.now(), type:'SISTEMA DE BAJA PRESIÓN', icon:'🌀',
            title:'Baja presión '+Math.round(pressure)+' hPa — '+city,
            description:'Sistema de baja presión. Posible empeoramiento del tiempo.',
            lat:lat,lon:lon,distKm:0, time:now,
            source:'Open-Meteo', priority:55, color:'#9B59B6'
        });

        // ── PRONÓSTICO PRÓXIMAS HORAS ──
        if (d.hourly) {
            var maxRain=0, maxWind=0, maxProb=0;
            var hrs = Math.min(24, (d.hourly.precipitation||[]).length);
            for(var i=0;i<hrs;i++) {
                var pr=(d.hourly.precipitation||[])[i]||0;
                var pw=(d.hourly.wind_speed_10m||[])[i]||0;
                var pp=(d.hourly.precipitation_probability||[])[i]||0;
                if(pr>maxRain) maxRain=pr;
                if(pw>maxWind) maxWind=pw;
                if(pp>maxProb) maxProb=pp;
            }
            if (maxProb>80&&maxRain>5) alerts.push({
                id:'om_fct_rain_'+Date.now(), type:'ALERTA LLUVIA 24H', icon:'⚠️',
                title:'Lluvia intensa prevista — '+city+' ('+Math.round(maxProb)+'% prob.)',
                description:'Se esperan lluvias de hasta '+maxRain.toFixed(0)+' mm en las próximas 24h.',
                lat:lat,lon:lon,distKm:0, time:'Próx. 24h',
                source:'Open-Meteo Forecast', priority:62, color:'#1E90FF'
            });
            if (maxWind>70) alerts.push({
                id:'om_fct_wind_'+Date.now(), type:'ALERTA VIENTO 24H', icon:'⚠️',
                title:'Viento fuerte previsto — '+city+' ('+Math.round(maxWind)+' km/h)',
                description:'Vientos de hasta '+Math.round(maxWind)+' km/h en las próximas 24h.',
                lat:lat,lon:lon,distKm:0, time:'Próx. 24h',
                source:'Open-Meteo Forecast', priority:60, color:'#FFA500'
            });
        }

        return alerts;
    } catch(e) { console.error('Open-Meteo:',e); return []; }
}

// ========== 2. SISMOS USGS ==========
async function fetchUSGS(lat, lon) {
    try {
        var since=new Date(Date.now()-86400000).toISOString();
        var url='https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=250&minmagnitude=2.0&starttime='+since;
        var d=await (await fetch(url,{signal:AbortSignal.timeout(12000)})).json();
        return d.features.map(function(f) {
            var p=f.properties,c=f.geometry.coordinates,mag=p.mag||0;
            return {
                id:'usgs_'+p.code, type:'SISMO',
                icon:mag>=6?'🔴':mag>=5?'🟠':mag>=4?'🟡':'⚪',
                title:'Sismo M'+mag.toFixed(1),
                description:(p.place||'Sin ubicación')+' — Prof. '+(c[2]?Math.round(c[2])+'km':'?km'),
                lat:c[1],lon:c[0],magnitude:mag,depth:c[2],
                distKm:lat?Math.round(calcDistance(lat,lon,c[1],c[0])):null,
                time:new Date(p.time).toLocaleString('es-CL'),
                source:'USGS', link:p.url,
                priority:mag>=7?96:mag>=6?88:mag>=5?76:mag>=4?62:mag>=3?48:35,
                color:mag>=6?'#ff0000':mag>=5?'#ff4400':mag>=4?'#ff9900':mag>=3?'#ffcc00':'#ffee88'
            };
        });
    } catch(e) { console.error('USGS:',e); return []; }
}

// ========== 3. VOLCANES ==========
function getVolcanes(lat,lon) {
    var V=[
        {n:'Villarrica',la:-39.423,lo:-71.931,co:'Chile',a:'Activo',p:80},
        {n:'Calbuco',la:-41.330,lo:-72.608,co:'Chile',a:'Activo',p:76},
        {n:'Copahue',la:-37.856,lo:-71.173,co:'Chile',a:'Activo',p:74},
        {n:'Llaima',la:-38.692,lo:-71.729,co:'Chile',a:'Activo',p:72},
        {n:'Osorno',la:-41.100,lo:-72.493,co:'Chile',a:'Vigilancia',p:58},
        {n:'Chaitén',la:-42.833,lo:-72.646,co:'Chile',a:'Vigilancia',p:62},
        {n:'Lonquimay',la:-38.379,lo:-71.586,co:'Chile',a:'Vigilancia',p:55},
        {n:'Popocatépetl',la:19.023,lo:-98.628,co:'México',a:'Activo',p:84},
        {n:'Colima',la:19.514,lo:-103.62,co:'México',a:'Activo',p:78},
        {n:'Sabancaya',la:-15.787,lo:-71.857,co:'Perú',a:'Activo',p:78},
        {n:'Tungurahua',la:-1.467,lo:-78.442,co:'Ecuador',a:'Activo',p:76},
        {n:'Cotopaxi',la:-0.677,lo:-78.436,co:'Ecuador',a:'Vigilancia',p:66},
        {n:'Nevado Ruiz',la:4.892,lo:-75.324,co:'Colombia',a:'Activo',p:82},
        {n:'Etna',la:37.751,lo:14.999,co:'Italia',a:'Activo',p:78},
        {n:'Kilauea',la:19.421,lo:-155.287,co:'EEUU',a:'Activo',p:82},
        {n:'Merapi',la:-7.541,lo:110.446,co:'Indonesia',a:'Activo',p:80},
        {n:'Sakurajima',la:31.585,lo:130.657,co:'Japón',a:'Activo',p:76},
    ];
    return V.map(function(v){
        return {
            id:'volc_'+v.n.replace(/\s/g,'_'),type:'VOLCÁN',icon:'🌋',
            title:'Volcán '+v.n,description:v.a+' — '+v.co,
            lat:v.la,lon:v.lo,
            distKm:lat?Math.round(calcDistance(lat,lon,v.la,v.lo)):null,
            time:new Date().toLocaleString('es-CL'),
            source:'Smithsonian GVP',priority:v.p,color:'#ff6600'
        };
    });
}

// ========== 4. HURACANES NOAA ==========
async function fetchHurricanes() {
    try {
        var url='https://api.allorigins.win/raw?url='+encodeURIComponent('https://www.nhc.noaa.gov/gis/kml/nhc_active.kml');
        var txt=await (await fetch(url,{signal:AbortSignal.timeout(8000)})).text();
        var kml=new DOMParser().parseFromString(txt,'text/xml');
        var alerts=[];
        kml.querySelectorAll('Placemark').forEach(function(pm){
            var name=(pm.querySelector('name')||{}).textContent||'';
            if(!/Hurricane|Tropical Storm|Cyclone|Typhoon/i.test(name)) return;
            var coord=pm.querySelector('coordinates');
            var lat=null,lon=null;
            if(coord){var p=coord.textContent.trim().split(',');lon=parseFloat(p[0]);lat=parseFloat(p[1]);}
            alerts.push({
                id:'nhc_'+name.replace(/\s/g,'_'),
                type:/Hurricane/i.test(name)?'HURACÁN':'TORMENTA TROPICAL',icon:'🌀',
                title:name,description:'Sistema tropical activo — NOAA NHC.',
                lat:lat,lon:lon,distKm:null,
                time:new Date().toLocaleString('es-CL'),
                source:'NOAA NHC',priority:95,color:'#9900ff'
            });
        });
        return alerts;
    } catch(e) { return []; }
}

// ========== 5. INCENDIOS NASA EONET ==========
async function fetchFires(lat,lon) {
    try {
        var d=await (await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=wildfires&limit=50&days=2',{signal:AbortSignal.timeout(8000)})).json();
        return (d.events||[]).map(function(ev){
            var geo=ev.geometry&&ev.geometry[0];
            var flat=null,flon=null;
            if(geo&&geo.type==='Point'){flon=geo.coordinates[0];flat=geo.coordinates[1];}
            return {
                id:'fire_'+ev.id,type:'INCENDIO',icon:'🔥',
                title:ev.title||'Incendio forestal activo',
                description:'Incendio activo detectado por satélite NASA EONET.',
                lat:flat,lon:flon,
                distKm:(lat&&flat)?Math.round(calcDistance(lat,lon,flat,flon)):null,
                time:new Date((ev.geometry[0]&&ev.geometry[0].date)||Date.now()).toLocaleString('es-CL'),
                source:'NASA EONET',priority:78,color:'#FF3300'
            };
        });
    } catch(e) { return []; }
}

// ========== CARGA POR UBICACIÓN ==========
async function loadAlertsForLocation(locationInput, radiusKm) {
    radiusKm=radiusKm||500;
    var lat,lon,cityName;
    if (typeof locationInput==='object'&&locationInput.lat) {
        lat=locationInput.lat; lon=locationInput.lon;
        cityName=locationInput.name||locationInput.city||'Tu zona';
    } else {
        var loc=searchLocation(locationInput);
        if(!loc) return [];
        lat=loc.lat; lon=loc.lon; cityName=loc.name;
    }
    console.log('📍 Alertas para:',cityName,lat,lon,'radio:',radiusKm);

    var all=[];
    (await Promise.allSettled([
        fetchOpenMeteoAlerts(lat,lon,cityName),
        fetchUSGS(lat,lon),
        Promise.resolve(getVolcanes(lat,lon)),
        fetchHurricanes(),
        fetchFires(lat,lon)
    ])).forEach(function(r){if(r.status==='fulfilled')all=all.concat(r.value||[]);});

    return all
        .filter(function(a){return a.distKm===0||!a.distKm||a.distKm<=radiusKm||/TSUNAMI|HURACÁN/.test(a.type||'');})
        .sort(function(a,b){return (b.priority||0)-(a.priority||0);});
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
    return all.filter(function(a){return (a.priority||0)>=40;})
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
        .then(function(a){console.log('✅ Alertas globales:',a.length);if(cb)cb(a);})
        .catch(function(e){console.error(e);if(cb)cb([]);});
};
