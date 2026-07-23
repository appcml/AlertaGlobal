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

        // ── MAREJADAS COSTERAS (Marine API Open-Meteo — sin key) ──
        // Detectar si la ubicación es costera: intentar la API marine siempre
        // Si falla, es tierra adentro → silencioso
        try {
            var marineUrl = 'https://marine-api.open-meteo.com/v1/marine?' +
                'latitude='+lat+'&longitude='+lon +
                '&current=wave_height,swell_wave_height,wave_period,wind_wave_height' +
                '&timezone=auto';
            var rm = await fetch(marineUrl, {signal: AbortSignal.timeout(8000)});
            if (rm.ok) {
                var dm = await rm.json();
                if (dm && dm.current && dm.current.wave_height != null) {
                    var wh  = dm.current.wave_height       || 0;
                    var swh = dm.current.swell_wave_height || 0;
                    var wp  = dm.current.wave_period       || 0;
                    if (wh >= 4.0) alerts.push({
                        id:'om_wave_ex_'+Date.now(), type:'MAREJADA PELIGROSA', icon:'🌊',
                        title:'Marejada peligrosa '+wh.toFixed(1)+' m — '+city,
                        description:'Olas de '+wh.toFixed(1)+' m. Peligro extremo. No acercarse al borde costero ni caletas.',
                        lat:lat,lon:lon,distKm:0, time:now,
                        source:'Open-Meteo Marine', priority:88, color:'#0000CD'
                    });
                    else if (wh >= 2.5) alerts.push({
                        id:'om_wave_hi_'+Date.now(), type:'MAREJADA', icon:'🌊',
                        title:'Marejada '+wh.toFixed(1)+' m — '+city,
                        description:'Olas de '+wh.toFixed(1)+' m. Playas peligrosas. Evitar zonas costeras bajas.',
                        lat:lat,lon:lon,distKm:0, time:now,
                        source:'Open-Meteo Marine', priority:72, color:'#0055AA'
                    });
                    else if (wh >= 1.5) alerts.push({
                        id:'om_wave_md_'+Date.now(), type:'MAR AGITADO', icon:'🌊',
                        title:'Mar agitado '+wh.toFixed(1)+' m — '+city,
                        description:'Olas moderadas. Precaución en actividades marítimas y pesca artesanal.',
                        lat:lat,lon:lon,distKm:0, time:now,
                        source:'Open-Meteo Marine', priority:52, color:'#4169E1'
                    });
                    if (swh >= 3.0) alerts.push({
                        id:'om_swell_'+Date.now(), type:'OLEAJE DE FONDO', icon:'🌊',
                        title:'Oleaje de fondo '+swh.toFixed(1)+' m — '+city,
                        description:'Swell de '+swh.toFixed(1)+' m (período '+wp.toFixed(0)+'s). Riesgo para embarcaciones menores y bañistas.',
                        lat:lat,lon:lon,distKm:0, time:now,
                        source:'Open-Meteo Marine', priority:65, color:'#1E90FF'
                    });
                }
            }
        } catch(em) { /* ubicación sin datos marinos — continental */ }

        // ── UV EXTREMO ──
        if (c.is_day && temp > 15) {
            try {
                var uvUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?' +
                    'latitude='+lat+'&longitude='+lon+'&current=uv_index&timezone=auto';
                var ruv = await fetch(uvUrl, {signal: AbortSignal.timeout(6000)});
                if (ruv.ok) {
                    var duv = await ruv.json();
                    var uvi = (duv && duv.current && duv.current.uv_index) || 0;
                    if (uvi >= 11) alerts.push({
                        id:'om_uv_ex_'+Date.now(), type:'UV EXTREMO', icon:'☀️',
                        title:'Radiación UV extrema (UVI '+uvi.toFixed(0)+') — '+city,
                        description:'Índice UV extremo. Evitar exposición 10:00-16:00. Protector 50+, gafas y sombrero obligatorios.',
                        lat:lat,lon:lon,distKm:0, time:now,
                        source:'Open-Meteo UV', priority:70, color:'#FF4500'
                    });
                    else if (uvi >= 8) alerts.push({
                        id:'om_uv_hi_'+Date.now(), type:'UV ALTO', icon:'☀️',
                        title:'Radiación UV muy alta (UVI '+uvi.toFixed(0)+') — '+city,
                        description:'Índice UV muy alto. Protector solar 30+, limitar exposición al mediodía.',
                        lat:lat,lon:lon,distKm:0, time:now,
                        source:'Open-Meteo UV', priority:52, color:'#FF8C00'
                    });
                }
            } catch(euv) { /* sin datos UV */ }
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

// ========== 6. WEATHER.GOV — Alertas oficiales EEUU (sin key) ==========
async function fetchWeatherGov(lat, lon) {
    // Solo aplica para coordenadas dentro de EEUU
    if (!lat||!lon) return [];
    var isUSA = lat>18&&lat<72&&lon>-180&&lon<-65;
    if (!isUSA) return [];
    try {
        // Primero obtener el punto
        var pt = await (await fetch(
            'https://api.weather.gov/points/'+lat.toFixed(4)+','+lon.toFixed(4),
            {signal:AbortSignal.timeout(8000), headers:{'User-Agent':'AlertaGlobal/1.0'}}
        )).json();
        if (!pt||!pt.properties||!pt.properties.county) return [];
        // Luego obtener alertas activas de esa zona
        var zone = pt.properties.county;
        var al = await (await fetch(
            'https://api.weather.gov/alerts/active?zone='+zone.split('/').pop(),
            {signal:AbortSignal.timeout(8000), headers:{'User-Agent':'AlertaGlobal/1.0'}}
        )).json();
        return (al.features||[]).map(function(f) {
            var p=f.properties||{};
            var sev = p.severity||'Unknown';
            var pri = sev==='Extreme'?92:sev==='Severe'?80:sev==='Moderate'?65:50;
            return {
                id:'nws_'+p.id, type:'ALERTA METEOROLÓGICA', icon:'⚠️',
                title:'⚠️ '+p.event+' — NWS',
                description:(p.headline||p.description||'').substring(0,200),
                lat:lat, lon:lon, distKm:0,
                time:new Date(p.onset||Date.now()).toLocaleString('es-CL'),
                source:'NOAA/NWS', priority:pri, color:'#FF6B35'
            };
        });
    } catch(e) { console.error('NWS:',e); return []; }
}

// ========== 7. OPEN-METEO AIR QUALITY — Sin key ==========
async function fetchAirQuality(lat, lon, cityName) {
    if (!lat||!lon) return [];
    try {
        var url = 'https://air-quality-api.open-meteo.com/v1/air-quality?' +
            'latitude='+lat+'&longitude='+lon +
            '&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide,dust' +
            '&timezone=auto';
        var d = await (await fetch(url, {signal:AbortSignal.timeout(8000)})).json();
        if (!d||!d.current) return [];
        var c = d.current;
        var aqi = c.us_aqi||0;
        var alerts = [];
        var city = cityName||'Tu zona';
        var now = new Date().toLocaleString('es-CL');

        // Clasificar AQI
        var aqiLabel, aqiColor, aqiPri, aqiIcon;
        if (aqi>300)      { aqiLabel='Peligroso';          aqiColor='#7e0023'; aqiPri=92; aqiIcon='☠️'; }
        else if (aqi>200) { aqiLabel='Muy Dañino';         aqiColor='#8f3f97'; aqiPri=85; aqiIcon='😷'; }
        else if (aqi>150) { aqiLabel='Dañino grupos sens.',aqiColor='#ff0000'; aqiPri=75; aqiIcon='😷'; }
        else if (aqi>100) { aqiLabel='Dañino sensibles',   aqiColor='#ff7e00'; aqiPri=65; aqiIcon='😮'; }
        else if (aqi>50)  { aqiLabel='Moderado',           aqiColor='#ffff00'; aqiPri=42; aqiIcon='😐'; }
        else              { aqiLabel='Bueno',               aqiColor='#00e400'; aqiPri=20; aqiIcon='😊'; }

        if (aqi>50) {
            alerts.push({
                id:'aqi_'+Date.now(), type:'CALIDAD DEL AIRE', icon:aqiIcon,
                title:'AQI '+aqi+' — '+aqiLabel+' ('+city+')',
                description:[
                    'Calidad del aire: '+aqiLabel+'.',
                    c.pm2_5>35   ? '⚠️ PM2.5: '+c.pm2_5.toFixed(1)+' μg/m³ (alto)' : '',
                    c.pm10>50    ? '⚠️ PM10: '+c.pm10.toFixed(1)+' μg/m³ (alto)' : '',
                    c.ozone>100  ? '⚠️ Ozono: '+c.ozone.toFixed(0)+' μg/m³' : '',
                    c.nitrogen_dioxide>40 ? '⚠️ NO₂: '+c.nitrogen_dioxide.toFixed(0)+' μg/m³' : '',
                ].filter(Boolean).join(' '),
                lat:lat, lon:lon, distKm:0, time:now,
                source:'Open-Meteo Air Quality', priority:aqiPri, color:aqiColor,
                extra:{ aqi:aqi, pm25:c.pm2_5, pm10:c.pm10, ozone:c.ozone, no2:c.nitrogen_dioxide }
            });
        }

        // CO elevado (monóxido de carbono)
        if (c.carbon_monoxide>15000) {
            alerts.push({
                id:'co_'+Date.now(), type:'MONÓXIDO DE CARBONO', icon:'☠️',
                title:'CO elevado en '+city,
                description:'Concentración de CO: '+Math.round(c.carbon_monoxide/1000)+' mg/m³. Peligro de intoxicación.',
                lat:lat, lon:lon, distKm:0, time:now,
                source:'Open-Meteo Air Quality', priority:82, color:'#8B0000'
            });
        }

        return alerts;
    } catch(e) { console.error('AQI:',e); return []; }
}

// ========== 8. GDACS — Desastres ONU (sin key) ==========
async function fetchGDACS() {
    try {
        var url = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?' +
                  'fromDate='+ new Date(Date.now()-7*86400000).toISOString().split('T')[0] +
                  '&toDate='+ new Date().toISOString().split('T')[0] +
                  '&alertlevel=Red,Orange&eventtype=EQ,TC,FL,VO,WF,TS';
        var r = await fetch('https://api.allorigins.win/raw?url='+encodeURIComponent(url),
                            {signal:AbortSignal.timeout(10000)});
        var d = await r.json();
        var events = d.features||d.results||d||[];
        if (!Array.isArray(events)) return [];
        return events.slice(0,30).map(function(ev) {
            var p = ev.properties||ev||{};
            var type = (p.eventtype||p.EventType||'').toUpperCase();
            var icons = {EQ:'🔴',TC:'🌀',FL:'💧',VO:'🌋',WF:'🔥',TS:'🌊'};
            var types = {EQ:'SISMO',TC:'CICLÓN TROPICAL',FL:'INUNDACIÓN',VO:'ERUPCIÓN',WF:'INCENDIO',TS:'TSUNAMI'};
            var alert = (p.alertlevel||p.AlertLevel||'').toLowerCase();
            return {
                id:'gdacs_'+(p.eventid||p.EventID||Math.random()),
                type:types[type]||type, icon:icons[type]||'⚠️',
                title:(p.name||p.Name||'Evento GDACS')+' — GDACS/ONU',
                description:(p.description||p.Description||'Evento confirmado').substring(0,200),
                lat:parseFloat(p.latitude||p.Latitude||0)||null,
                lon:parseFloat(p.longitude||p.Longitude||0)||null,
                distKm:null,
                time:new Date(p.fromDate||p.FromDate||Date.now()).toLocaleString('es-CL'),
                source:'GDACS / ONU',
                priority:alert==='red'?88:alert==='orange'?72:55,
                color:alert==='red'?'#ff0000':'#ff8800'
            };
        }).filter(function(a){return a.lat&&a.lon;});
    } catch(e) { console.error('GDACS:',e); return []; }
}

// ========== 9. EMSC — Sismos Europa + Mediterráneo ==========
async function fetchEMSC(lat, lon) {
    try {
        var since = new Date(Date.now()-86400000).toISOString();
        var url = 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json' +
                  '&orderby=time&limit=100&minmagnitude=2.0&starttime='+since;
        var d = await (await fetch(url,{signal:AbortSignal.timeout(10000)})).json();
        return (d.features||[]).map(function(f) {
            var p=f.properties, c=f.geometry.coordinates, mag=p.mag||0;
            return {
                id:'emsc_'+(p.unid||Math.random()),
                type:'SISMO', icon:mag>=5?'🔴':mag>=4?'🟠':'🟡',
                title:'Sismo M'+mag.toFixed(1)+' — EMSC',
                description:(p.flynn_region||p.region||'Europa/Mediterráneo')+
                            ' — Prof. '+(c[2]?Math.round(c[2])+'km':'?km'),
                lat:c[1], lon:c[0], magnitude:mag, depth:c[2],
                distKm:lat?Math.round(calcDistance(lat,lon,c[1],c[0])):null,
                time:new Date(p.time).toLocaleString('es-CL'),
                source:'EMSC',
                priority:mag>=6?90:mag>=5?78:mag>=4?62:mag>=3?48:35,
                color:mag>=6?'#ff0000':mag>=5?'#ff4400':mag>=4?'#ff9900':'#ffcc00',
                link:'https://www.seismicportal.eu/eventdetails.html?unid='+(p.unid||'')
            };
        });
    } catch(e) { console.error('EMSC:',e); return []; }
}

// ========== 10. DMC CHILE — Dirección Meteorológica ==========
async function fetchDMCChile(lat, lon) {
    try {
        var url = 'https://api.allorigins.win/raw?url='+
                  encodeURIComponent('https://www.meteochile.gob.cl/PortalDMC-web/rss/avisos.rss');
        var r = await fetch(url,{signal:AbortSignal.timeout(12000)});
        if (!r.ok) return [];
        var txt = await r.text();
        var xml = new DOMParser().parseFromString(txt,'text/xml');
        var alerts = [];
        xml.querySelectorAll('item').forEach(function(item) {
            var title = (item.querySelector('title')||{}).textContent||'';
            var desc  = (item.querySelector('description')||{}).textContent||'';
            var link  = (item.querySelector('link')||{}).textContent||'';
            var date  = (item.querySelector('pubDate')||{}).textContent||'';
            if (!title||title.length<3) return;
            var tipo='ALERTA METEOROLÓGICA', icono='⚠️', pri=65;
            var td = title+desc;
            if (/lluvia|precipitaci/i.test(td)) { tipo='LLUVIA INTENSA';  icono='🌧️'; pri=72; }
            if (/viento|ventisca/i.test(td))    { tipo='VIENTO FUERTE';   icono='💨'; pri=70; }
            if (/nieve|nevada/i.test(td))       { tipo='NEVADA';          icono='❄️'; pri=68; }
            if (/tormenta/i.test(td))           { tipo='TORMENTA';        icono='⛈️'; pri=78; }
            if (/tsunami/i.test(td))            { tipo='TSUNAMI';         icono='🌊'; pri=98; }
            if (/marejada/i.test(td))           { tipo='MAREJADA';        icono='🌊'; pri=75; }
            if (/calor/i.test(td))              { tipo='CALOR EXTREMO';   icono='🔥'; pri=72; }
            if (/helada/i.test(td))             { tipo='HELADA';          icono='🧊'; pri=62; }
            alerts.push({
                id:'dmc_'+alerts.length+'_'+Date.now(),
                type:tipo, icon:icono,
                title:'🇨🇱 DMC: '+title.replace(/<[^>]+>/g,'').trim(),
                description:desc.replace(/<[^>]+>/g,'').substring(0,200),
                lat:lat||null, lon:lon||null, distKm:0,
                time:date?new Date(date).toLocaleString('es-CL'):new Date().toLocaleString('es-CL'),
                source:'DMC — Meteorología Chile',
                priority:pri, color:'#FF6B35', link:link
            });
        });
        return alerts.slice(0,10);
    } catch(e) { console.error('DMC:',e); return []; }
}

// ========== 11. SHOA — Avisos Tsunamis Pacífico ==========
async function fetchSHOA() {
    try {
        var url = 'https://api.allorigins.win/raw?url='+
                  encodeURIComponent('http://www.shoa.cl/php/infot.php');
        var r = await fetch(url,{signal:AbortSignal.timeout(12000)});
        if (!r.ok) return [];
        var txt = await r.text();
        var alerts = [];
        if (txt&&txt.length>50) {
            var clean = txt.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
            var tipo='BOLETÍN SHOA', icono='🌊', pri=60;
            if (/cancelad|sin amenaza|no existe|normal/i.test(clean)) { tipo='SIN AMENAZA TSUNAMI'; icono='✅'; pri=25; }
            if (/alerta roja|TSUNAMI ALERT/i.test(clean))             { tipo='ALERTA TSUNAMI';      icono='🚨'; pri=99; }
            if (/watch|vigilancia/i.test(clean))                      { tipo='VIGILANCIA TSUNAMI';  icono='🌊'; pri=88; }
            if (clean.length>20) {
                alerts.push({
                    id:'shoa_'+Date.now(),
                    type:tipo, icon:icono,
                    title:'🇨🇱 SHOA: '+clean.substring(0,80),
                    description:clean.substring(0,250),
                    lat:-30.0, lon:-71.5, distKm:0,
                    time:new Date().toLocaleString('es-CL'),
                    source:'SHOA — Chile Pacífico',
                    priority:pri, color:pri>=85?'#0000ff':'#4169E1',
                    link:'http://www.shoa.cl'
                });
            }
        }
        return alerts;
    } catch(e) { console.error('SHOA:',e); return []; }
}

// ========== 11b. CSN — Centro Sismológico Nacional Chile ==========
// Fuente oficial: www.sismologia.cl — más rápida que USGS para sismos chilenos
//
// ESTRUCTURA REAL de la tabla HTML del CSN (3 columnas):
// <td><a href="/...">2026-07-23 11:04:09\n41 km al SE de Constitución</a></td>
// <td>46</td>      ← profundidad en km (número solo, sin texto)
// <td>3.5</td>     ← magnitud (número decimal)
//
// El link en cells[0] contiene fecha + salto de línea + descripción del lugar
async function fetchCSN(lat, lon) {
    var today = new Date();
    var y = today.getFullYear();
    var m = String(today.getMonth()+1).padStart(2,'0');
    var d = String(today.getDate()).padStart(2,'0');
    var dateStr = y + m + d;

    var targetUrl = 'https://www.sismologia.cl/sismicidad/catalogo/'+y+'/'+m+'/'+dateStr+'.html';

    var proxies = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?',
        'https://api.codetabs.com/v1/proxy?quest='
    ];

    var html = null;
    for (var i = 0; i < proxies.length; i++) {
        try {
            var r = await fetch(proxies[i] + encodeURIComponent(targetUrl),
                               {signal: AbortSignal.timeout(12000)});
            if (r.ok) { html = await r.text(); break; }
        } catch(e) { continue; }
    }

    if (!html || html.length < 200) return [];

    // ── Mapa de referencia: ciudades chilenas → coordenadas ──
    var CIUDADES = {
        'santiago':[-33.45,-70.67],'concepcion':[-36.82,-73.04],
        'valparaiso':[-33.05,-71.61],'temuco':[-38.74,-72.59],
        'antofagasta':[-23.65,-70.40],'iquique':[-20.21,-70.15],
        'arica':[-18.49,-70.30],'la serena':[-29.90,-71.25],
        'puerto montt':[-41.47,-72.94],'coquimbo':[-29.95,-71.34],
        'rancagua':[-34.17,-70.74],'talca':[-35.43,-71.67],
        'chillan':[-36.61,-72.10],'los angeles':[-37.47,-72.35],
        'osorno':[-40.57,-73.13],'valdivia':[-39.81,-73.25],
        'constitucion':[-35.33,-72.42],'curico':[-34.98,-71.24],
        'linares':[-35.85,-71.60],'san antonio':[-33.60,-71.62],
        'pichilemu':[-34.39,-72.00],'ovalle':[-30.60,-71.20],
        'caldera':[-27.07,-70.82],'copiapo':[-27.37,-70.33],
        'illapel':[-31.63,-71.17],'punta arenas':[-53.16,-70.92],
        'coyhaique':[-45.57,-72.07],'cauquenes':[-35.97,-72.32],
        'parral':[-36.14,-71.83],'santa cruz':[-34.63,-71.36],
        'calama':[-22.45,-68.93],'tocopilla':[-22.09,-70.20],
        'mejillones':[-23.10,-70.45],'taltal':[-25.40,-70.49],
        'papudo':[-32.50,-71.45],'los vilos':[-31.91,-71.51],
        'vicuna':[-30.03,-70.71],'salamanca':[-31.77,-70.97],
        'fray jorge':[-30.65,-71.65],'ollague':[-21.23,-68.25],
        'ollagüe':[-21.23,-68.25],'carrizal bajo':[-28.07,-71.14],
        'cañete':[-37.80,-73.40],'lebu':[-37.61,-73.65],
        'arauco':[-37.25,-73.32],'tirua':[-38.35,-73.50],
        'camarones':[-19.02,-69.86],'camina':[-19.57,-69.42],
        'vichuquen':[-34.87,-72.02],'pelluhue':[-35.82,-72.57],
        'empedrado':[-35.60,-72.27],'chanco':[-35.73,-72.53],
        'quirihue':[-36.28,-72.54],'coelemu':[-36.49,-72.71],
        'florida':[-37.10,-72.65],'santa barbara':[-37.67,-72.02],
        'mulchen':[-37.72,-72.24],'nacimiento':[-37.50,-72.67],
        'angol':[-37.80,-72.71],'victoria':[-38.23,-72.33],
        'curacautin':[-38.44,-71.88],'lonquimay':[-38.44,-71.24],
        'villarrica':[-39.28,-72.23],'pucon':[-39.27,-71.96],
        'loncoche':[-39.37,-72.63],'pitrufquen':[-38.97,-72.65],
        'panguipulli':[-39.64,-72.34],'la union':[-40.29,-73.08],
        'rio bueno':[-40.33,-72.97],'mafil':[-39.68,-72.93],
        'llanquihue':[-41.24,-73.00],'frutillar':[-41.12,-73.07],
        'puerto varas':[-41.32,-72.98],'calbuco':[-41.77,-73.13],
        'maullin':[-41.63,-73.59],'ancud':[-41.87,-73.83],
        'castro':[-42.48,-73.77],'quellon':[-43.12,-73.62],
        'chaiten':[-42.92,-72.71],'futaleufu':[-43.19,-71.86]
    };

    // ── Función para calcular coords del sismo desde descripción ──
    function lugarACoords(lugarText) {
        // Formato CSN: "41 km al SE de Constitución" o "2 km al NE de Camiña"
        var m = lugarText.match(/(\d+)\s*km\s*al\s+([NSEO]+(?:\s*de\s*[NSEO]+)?)\s+de\s+(.+)/i);
        if (!m) return null;
        var distRef = parseInt(m[1]);
        var dir = m[2].trim().toUpperCase()
            .replace(/\s+DE\s+/i,'')   // "NO de" → "NO"
            .replace(/NORTE/i,'N').replace(/SUR/i,'S')
            .replace(/ESTE/i,'E').replace(/OESTE/i,'O');
        var ciudad = m[3].trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g,'');

        var coords = null;
        for (var k in CIUDADES) {
            var kn = k.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
            if (ciudad === kn || ciudad.includes(kn) || kn.includes(ciudad)) {
                coords = CIUDADES[k]; break;
            }
        }
        if (!coords) return null;

        var kmPerDegLat = 111;
        var kmPerDegLon = 111 * Math.cos(coords[0] * Math.PI / 180);
        var dLat = 0, dLon = 0;
        // Diagonal: componente 0.707
        var factor = (dir.length >= 2) ? 0.707 : 1.0;
        if (dir.includes('N')) dLat =  (distRef * factor) / kmPerDegLat;
        if (dir.includes('S')) dLat = -(distRef * factor) / kmPerDegLat;
        if (dir.includes('E')) dLon =  (distRef * factor) / kmPerDegLon;
        if (dir.includes('O') || dir.includes('W')) dLon = -(distRef * factor) / kmPerDegLon;

        return [coords[0] + dLat, coords[1] + dLon];
    }

    var alerts = [];
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    var rows = doc.querySelectorAll('table tr');

    rows.forEach(function(row) {
        var cells = row.querySelectorAll('td');
        // La tabla CSN tiene 4 columnas separadas:
        // cells[0] = <a href="...">FECHA LOCAL</a>  (solo fecha en el link)
        // cells[1] = LUGAR  ("41 km al SE de Constitución")
        // cells[2] = PROFUNDIDAD  ("108")
        // cells[3] = MAGNITUD  ("3.5")
        if (cells.length < 4) return;

        // ── Columna 0: fecha (dentro del link) ──
        var fechaText = (cells[0].textContent || '').replace(/\s+/g,' ').trim();
        var fechaMatch = fechaText.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
        if (!fechaMatch) return;
        fechaText = fechaMatch[1]; // "2026-07-23 11:04:09"

        // ── Columna 1: lugar ──
        var lugar = (cells[1].textContent || '').replace(/\s+/g,' ').trim();

        // ── Columna 2: profundidad (km) ──
        var profText = (cells[2].textContent || '').replace(/[^0-9]/g,'').trim();
        var prof = parseInt(profText) || 0;

        // ── Columna 3: magnitud ──
        var magText = (cells[3].textContent || '').replace(/[^0-9.]/g,'').trim();
        var mag = parseFloat(magText);
        if (isNaN(mag) || mag < 2.0 || mag > 10.0) return; // Validar rango real

        // ── Parsear fecha → timestamp para ordenar y formatear ──
        // "2026-07-23 11:04:09" → ISO sin zona → interpretar como hora local Chile
        var fechaISO = fechaText.replace(' ', 'T'); // "2026-07-23T11:04:09"
        var fechaObj;
        try {
            // El CSN reporta en hora LOCAL chilena (CLT = UTC-3, CLST = UTC-4)
            // Agregamos offset -03:00 para parseo correcto
            fechaObj = new Date(fechaISO + '-03:00');
            if (isNaN(fechaObj.getTime())) fechaObj = new Date(fechaISO);
        } catch(e) { fechaObj = new Date(); }

        var timeMs  = fechaObj.getTime();
        var timeStr = fechaObj.toLocaleString('es-CL');

        // ── Calcular coordenadas del epicentro ──
        var coords = lugarACoords(lugar);
        var sisoLat = coords ? coords[0] : null;
        var sisoLon = coords ? coords[1] : null;
        var distKmCalc = (lat && sisoLat) ? Math.round(calcDistance(lat, lon, sisoLat, sisoLon)) : null;

        // ── Link al detalle ──
        var linkEl = row.querySelector('a');
        var href   = linkEl ? linkEl.getAttribute('href') : '';

        // ── Prioridad y color según magnitud ──
        var pri = mag>=7?96 : mag>=6?88 : mag>=5?76 : mag>=4?62 : mag>=3?50 : 38;
        var col = mag>=6?'#ff0000' : mag>=5?'#ff4400' : mag>=4?'#ff9900' : mag>=3?'#ffcc00' : '#ffee88';
        var icon = mag>=6?'🔴' : mag>=5?'🟠' : mag>=4?'🟡' : '⚪';

        alerts.push({
            id: 'csn_' + dateStr + '_' + timeMs,
            type: 'SISMO', icon: icon,
            title: 'Sismo M' + mag.toFixed(1) + ' — ' + lugar,
            description: lugar + ' · Prof. ' + prof + ' km' +
                         (distKmCalc ? ' · ' + distKmCalc + ' km de ti' : ''),
            lat: sisoLat, lon: sisoLon,
            magnitude: mag, depth: prof,
            distKm: distKmCalc,
            time: timeStr,
            _timeMs: timeMs,   // guardamos ms para ordenar
            source: 'CSN — Chile',
            priority: pri, color: col,
            link: 'https://www.sismologia.cl' + (href || '')
        });
    });

    // Ordenar por tiempo descendente (más reciente primero)
    alerts.sort(function(a,b){ return (b._timeMs||0) - (a._timeMs||0); });

    console.log('🇨🇱 CSN:', alerts.length, 'sismos hoy (M2.0+)');
    return alerts;
}

// ========== 12. NASA FIRMS — Incendios casi en tiempo real ==========
async function fetchNASAFIRMS(lat, lon) {
    try {
        // NASA FIRMS API pública (sin key para datos generales)
        var url = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=wildfires&limit=100&days=1';
        var d = await (await fetch(url,{signal:AbortSignal.timeout(10000)})).json();
        return (d.events||[]).map(function(ev){
            var geo=ev.geometry&&ev.geometry[0];
            var flat=null,flon=null;
            if(geo&&geo.type==='Point'){flon=geo.coordinates[0];flat=geo.coordinates[1];}
            return {
                id:'firms_'+ev.id, type:'INCENDIO ACTIVO', icon:'🔥',
                title:'🔥 '+ev.title,
                description:'Incendio detectado en tiempo real por satélite NASA FIRMS.',
                lat:flat, lon:flon,
                distKm:(lat&&flat)?Math.round(calcDistance(lat,lon,flat,flon)):null,
                time:new Date((geo&&geo.date)||Date.now()).toLocaleString('es-CL'),
                source:'NASA FIRMS', priority:80, color:'#FF3300'
            };
        }).filter(function(a){return a.lat;});
    } catch(e) { return []; }
}

// ========== 13. NOAA Space Weather — Clima espacial ==========
async function fetchSpaceWeather() {
    try {
        var url = 'https://api.allorigins.win/raw?url='+
                  encodeURIComponent('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
        var d = await (await fetch(url,{signal:AbortSignal.timeout(10000)})).json();
        var alerts = [];
        if (Array.isArray(d) && d.length > 1) {
            var last = d[d.length-1];
            var kp = parseFloat(last[1]) || 0;
            if (kp >= 5) {
                var level = kp>=8?'Extrema':kp>=7?'Severa':kp>=6?'Fuerte':'Moderada';
                var icon = kp>=7?'☢️':'🌌';
                alerts.push({
                    id:'kp_'+Date.now(), type:'TORMENTA GEOMAGNÉTICA', icon:icon,
                    title:icon+' Tormenta geomagnética '+level+' (Kp='+kp+')',
                    description:'Índice Kp='+kp+'. '+
                        (kp>=7?'Posibles auroras visibles en latitudes medias. Riesgo para satélites y redes eléctricas.':
                         kp>=6?'Posibles auroras visibles. Interferencias en GPS y comunicaciones.':
                         'Actividad geomagnética elevada. Posibles interferencias de radio.'),
                    lat:null, lon:null, distKm:null,
                    time:new Date().toLocaleString('es-CL'),
                    source:'NOAA SWPC', priority:kp>=7?85:70, color:'#9B59B6'
                });
            }
        }
        // CME y alertas de la NOAA
        try {
            var alerts2 = await (await fetch(
                'https://api.allorigins.win/raw?url='+
                encodeURIComponent('https://services.swpc.noaa.gov/products/alerts.json'),
                {signal:AbortSignal.timeout(8000)}
            )).json();
            (alerts2||[]).slice(0,5).forEach(function(a){
                if (!a.message) return;
                var msg = a.message.substring(0,200);
                var pri = /WATCH|WARNING/i.test(a.product_id||'') ? 78 : 60;
                alerts.push({
                    id:'swpc_'+a.serial_number, type:'CLIMA ESPACIAL', icon:'☀️',
                    title:'☀️ NOAA SWPC: '+(a.product_id||'Alerta Solar'),
                    description:msg,
                    lat:null, lon:null, distKm:null,
                    time:new Date(a.issue_datetime||Date.now()).toLocaleString('es-CL'),
                    source:'NOAA SWPC', priority:pri, color:'#E67E22'
                });
            });
        } catch(e2) {}
        return alerts;
    } catch(e) { console.error('SpaceWeather:',e); return []; }
}

// ========== 14. OpenSky Network — Aviación en tiempo real ==========
async function fetchOpenSky(lat, lon, radius) {
    if (!lat||!lon) return [];
    try {
        // OpenSky tiene API pública sin key (con límites)
        var deg = (radius||200)/111;
        var url = 'https://opensky-network.org/api/states/all?'+
                  'lamin='+(lat-deg)+'&lamax='+(lat+deg)+
                  '&lomin='+(lon-deg)+'&lomax='+(lon+deg);
        var d = await (await fetch(url,{signal:AbortSignal.timeout(10000)})).json();
        if (!d||!d.states||!d.states.length) return [];
        // Solo mostrar vuelos de emergencia o interesantes
        var emergency = (d.states||[]).filter(function(s){
            return s[15]===true || s[14]==='squawk 7700' || s[14]==='squawk 7600';
        });
        return emergency.map(function(s){
            return {
                id:'sky_'+s[0], type:'EMERGENCIA AÉREA', icon:'✈️',
                title:'✈️ Emergencia: '+s[1]+' ('+s[0]+')',
                description:'Vuelo en situación de emergencia. Alt: '+(s[7]?Math.round(s[7])+'m':'?')+
                            ' Vel: '+(s[9]?Math.round(s[9]*3.6)+'km/h':'?'),
                lat:s[6]||null, lon:s[5]||null,
                distKm:s[6]&&lat?Math.round(calcDistance(lat,lon,s[6],s[5])):null,
                time:new Date().toLocaleString('es-CL'),
                source:'OpenSky Network', priority:92, color:'#FF0000'
            };
        }).filter(function(a){return a.lat;});
    } catch(e) { return []; }
}

// ========== 15. MeteoAlarm — Alertas oficiales Europa ==========
async function fetchMeteoAlarm() {
    try {
        // MeteoAlarm RSS feed (cap alerts)
        var url = 'https://api.allorigins.win/raw?url='+
                  encodeURIComponent('https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-europe');
        var txt = await (await fetch(url,{signal:AbortSignal.timeout(10000)})).text();
        var xml = new DOMParser().parseFromString(txt,'text/xml');
        var alerts = [];
        xml.querySelectorAll('entry').forEach(function(e){
            var title = (e.querySelector('title')||{}).textContent||'';
            var summary = (e.querySelector('summary')||{}).textContent||'';
            var updated = (e.querySelector('updated')||{}).textContent||'';
            if (!title||title.length<3) return;
            var severity = /extreme/i.test(summary)?95:/severe/i.test(summary)?82:/moderate/i.test(summary)?65:50;
            var tipo = 'ALERTA METEOROLÓGICA', icono = '⚠️';
            if (/wind/i.test(title+summary))     { tipo='VIENTO FUERTE';     icono='💨'; }
            if (/rain|flood/i.test(title+summary)){ tipo='LLUVIA/INUNDACIÓN'; icono='🌧️'; }
            if (/snow|ice/i.test(title+summary))  { tipo='NIEVE/HIELO';      icono='❄️'; }
            if (/thunder/i.test(title+summary))   { tipo='TORMENTA';         icono='⛈️'; }
            if (/heat/i.test(title+summary))      { tipo='CALOR EXTREMO';    icono='🔥'; }
            if (/fog/i.test(title+summary))       { tipo='NIEBLA';           icono='🌫️'; }
            alerts.push({
                id:'ma_'+alerts.length+'_'+Date.now(),
                type:tipo, icon:icono,
                title:'🇪🇺 MeteoAlarm: '+title.substring(0,80),
                description:summary.replace(/<[^>]+>/g,'').substring(0,200),
                lat:null, lon:null, distKm:null,
                time:updated?new Date(updated).toLocaleString('es-CL'):new Date().toLocaleString('es-CL'),
                source:'MeteoAlarm (Europa)', priority:severity, color:'#FF6B35'
            });
        });
        return alerts.slice(0,15);
    } catch(e) { console.error('MeteoAlarm:',e); return []; }
}

// ========== 16. Global Flood Awareness System (GloFAS) ==========
async function fetchGloFAS() {
    try {
        // Copernicus GloFAS via GDACS (integrado en API GDACS)
        var url = 'https://api.allorigins.win/raw?url='+
                  encodeURIComponent('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?'+
                  'fromDate='+new Date(Date.now()-3*86400000).toISOString().split('T')[0]+
                  '&toDate='+new Date().toISOString().split('T')[0]+
                  '&alertlevel=Red,Orange&eventtype=FL');
        var d = await (await fetch(url,{signal:AbortSignal.timeout(10000)})).json();
        var events = d.features||d.results||[];
        return events.slice(0,20).map(function(ev){
            var p=ev.properties||ev;
            var alert=(p.alertlevel||'').toLowerCase();
            return {
                id:'flood_'+(p.eventid||Math.random()),
                type:'INUNDACIÓN', icon:'💧',
                title:'💧 Inundación — '+(p.name||p.country||'GloFAS'),
                description:(p.description||'Inundación confirmada por GloFAS/Copernicus').substring(0,200),
                lat:parseFloat(p.latitude||0)||null,
                lon:parseFloat(p.longitude||0)||null,
                distKm:null,
                time:new Date(p.fromDate||Date.now()).toLocaleString('es-CL'),
                source:'GloFAS / Copernicus',
                priority:alert==='red'?88:70,
                color:alert==='red'?'#0044ff':'#0088ff'
            };
        }).filter(function(a){return a.lat;});
    } catch(e) { return []; }
}

// ========== 17. OpenAQ — Calidad del Aire Ciudadana ==========
async function fetchOpenAQ(lat, lon) {
    if (!lat||!lon) return [];
    try {
        var url = 'https://api.openaq.org/v2/measurements?'+
                  'coordinates='+lat+','+lon+'&radius=50000&limit=20&order_by=datetime&sort=desc&'+
                  'parameter=pm25,pm10,o3,no2,co';
        var d = await (await fetch(url,{
            signal:AbortSignal.timeout(10000),
            headers:{'X-API-Key':''}  // OpenAQ permite acceso sin key
        })).json();
        if (!d||!d.results||!d.results.length) return [];
        // Agrupar por parameter y tomar último valor
        var vals = {};
        (d.results||[]).forEach(function(r){
            if (!vals[r.parameter]) vals[r.parameter]=r.value;
        });
        var pm25 = vals.pm25, pm10 = vals.pm10, o3 = vals.o3;
        var alerts = [];
        if (pm25 && pm25>35) alerts.push({
            id:'oaq_pm25_'+Date.now(), type:'PM2.5 ELEVADO', icon:'😷',
            title:'😷 PM2.5: '+pm25.toFixed(1)+' μg/m³ (OpenAQ)',
            description:'Partículas finas PM2.5 por encima del límite recomendado OMS (25 μg/m³).',
            lat:lat, lon:lon, distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenAQ', priority:pm25>75?80:65, color:'#8B4513'
        });
        if (pm10 && pm10>50) alerts.push({
            id:'oaq_pm10_'+Date.now(), type:'PM10 ELEVADO', icon:'😷',
            title:'😷 PM10: '+pm10.toFixed(1)+' μg/m³ (OpenAQ)',
            description:'Partículas PM10 por encima del límite recomendado.',
            lat:lat, lon:lon, distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:'OpenAQ', priority:60, color:'#CD853F'
        });
        return alerts;
    } catch(e) { return []; }
}

// ========== 18. NOAA Storm Prediction Center — Tornados USA ==========
async function fetchSPC() {
    try {
        var url = 'https://api.allorigins.win/raw?url='+
                  encodeURIComponent('https://www.spc.noaa.gov/products/spcacrss.xml');
        var txt = await (await fetch(url,{signal:AbortSignal.timeout(10000)})).text();
        var xml = new DOMParser().parseFromString(txt,'text/xml');
        var alerts = [];
        xml.querySelectorAll('item').forEach(function(item){
            var title = (item.querySelector('title')||{}).textContent||'';
            var desc  = (item.querySelector('description')||{}).textContent||'';
            var date  = (item.querySelector('pubDate')||{}).textContent||'';
            if (!title||title.length<3) return;
            var tipo='ALERTA CONVECTIVA', icono='⛈️', pri=75;
            if (/tornado/i.test(title+desc)) { tipo='TORNADO'; icono='🌪️'; pri=92; }
            if (/severe.*thunderstorm/i.test(title+desc)) { tipo='TORMENTA SEVERA'; icono='⛈️'; pri=82; }
            if (/hail/i.test(title+desc)) { tipo='GRANIZO SEVERO'; icono='🌨️'; pri=78; }
            // Traducir y limpiar título
            var titleES = title
                .replace(/Convective Outlook/gi,'Perspectiva Convectiva')
                .replace(/Day 1/gi,'Día 1').replace(/Day 2/gi,'Día 2')
                .replace(/Severe Thunderstorm/gi,'Tormenta Severa')
                .replace(/Tornado Watch/gi,'Vigilancia Tornado')
                .replace(/Tornado Warning/gi,'Alerta Tornado')
                .replace(/Hail/gi,'Granizo')
                .substring(0,80);
            alerts.push({
                id:'spc_'+alerts.length+'_'+Date.now(),
                type:tipo, icon:icono,
                title:'🇺🇸 SPC: '+titleES,
                description:desc.replace(/<[^>]+>/g,'').substring(0,200),
                lat:null, lon:null, distKm:null,
                time:date?new Date(date).toLocaleString('es-CL'):new Date().toLocaleString('es-CL'),
                source:'NOAA SPC', priority:pri, color:'#FF0000'
            });
        });
        return alerts.slice(0,10);
    } catch(e) { return []; }
}

// ========== 19. Pacific Tsunami Warning Center (PTWC) ==========
async function fetchPTWC() {
    try {
        var url = 'https://api.allorigins.win/raw?url='+
                  encodeURIComponent('https://www.tsunami.gov/events/xml/PHEBAtom.xml');
        var txt = await (await fetch(url,{signal:AbortSignal.timeout(10000)})).text();
        var xml = new DOMParser().parseFromString(txt,'text/xml');
        var alerts = [];
        xml.querySelectorAll('entry').forEach(function(e){
            var title   = (e.querySelector('title')||{}).textContent||'';
            var summary = (e.querySelector('summary')||{}).textContent||'';
            var updated = (e.querySelector('updated')||{}).textContent||'';
            if (!title||title.length<3) return;
            var isCancelled = /cancel|no.*threat/i.test(title+summary);
            var pri = isCancelled?20:(/warning/i.test(title)?98:/watch/i.test(title)?88:70);
            var icon = isCancelled?'✅':'🌊';
            alerts.push({
                id:'ptwc_'+alerts.length+'_'+Date.now(),
                type:isCancelled?'SIN AMENAZA TSUNAMI':'ALERTA TSUNAMI', icon:icon,
                title:icon+' PTWC: '+title.substring(0,80),
                description:summary.replace(/<[^>]+>/g,'').substring(0,200),
                lat:null, lon:null, distKm:null,
                time:updated?new Date(updated).toLocaleString('es-CL'):new Date().toLocaleString('es-CL'),
                source:'Pacific Tsunami Warning Center',
                priority:pri, color:pri>=85?'#0000ff':'#4169E1'
            });
        });
        return alerts.slice(0,5);
    } catch(e) { return []; }
}


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

    var isChile = lat&&lat<-17&&lat>-56&&lon>-76&&lon<-65;
    var isUSA   = lat&&lat>18&&lat<72&&lon>-180&&lon<-65;
    var all=[];
    (await Promise.allSettled([
        // ── Clima local ──
        fetchOpenMeteoAlerts(lat,lon,cityName),
        fetchAirQuality(lat,lon,cityName),
        fetchOpenAQ(lat,lon),                    // OpenAQ partículas
        // ── Sismos ──
        fetchUSGS(lat,lon),
        fetchEMSC(lat,lon),
        // ── Volcanes e Incendios ──
        Promise.resolve(getVolcanes(lat,lon)),
        fetchNASAFIRMS(lat,lon),                 // NASA FIRMS incendios
        fetchFires(lat,lon),                     // NASA EONET backup
        // ── Ciclones y Tsunamis ──
        fetchHurricanes(),
        fetchPTWC(),                             // Pacific Tsunami WC
        // ── Desastres globales ──
        fetchGDACS(),
        fetchGloFAS(),                           // Inundaciones
        fetchSpaceWeather(),                     // Clima espacial
        // ── Tormentas severas ──
        fetchSPC(),                              // NOAA SPC tornados
        fetchMeteoAlarm(),                       // Alertas Europa
        // ── Regionales ──
        isUSA   ? fetchWeatherGov(lat,lon) : Promise.resolve([]),
        isChile ? fetchDMCChile(lat,lon)   : Promise.resolve([]),
        isChile ? fetchSHOA()              : Promise.resolve([]),
        isChile ? fetchCSN(lat,lon)        : Promise.resolve([])
    ])).forEach(function(r){if(r.status==='fulfilled')all=all.concat(r.value||[]);});

    return all
        .filter(function(a){
            if(a.distKm===0||!a.distKm) {
                // Alertas sin coordenadas: solo mostrar si son globalmente importantes
                // o si vienen de fuentes que ya filtran por zona
                var src = a.source||'';
                var tipo = a.type||'';
                // Tsunamis, clima espacial y huracanes siempre
                if(/TSUNAMI|GEOMAGNÉTICA|CLIMA ESPACIAL|SOLAR|HURACÁN|TIFÓN/i.test(tipo)) return true;
                // Alertas de MeteoAlarm y SPC: solo si la ubicación es Europa o EEUU
                if(/MeteoAlarm/i.test(src)) {
                    var isEurope = lat&&lat>35&&lat<72&&lon>-10&&lon<45;
                    return isEurope;
                }
                if(/NOAA SPC/i.test(src)) {
                    var isUSA2 = lat&&lat>18&&lat<72&&lon>-180&&lon<-65;
                    return isUSA2;
                }
                // Alertas Open-Meteo, DMC, SHOA: siempre (ya son locales)
                if(/Open-Meteo|DMC|SHOA|OpenWeather|OpenAQ/i.test(src)) return true;
                // PTWC y GDACS: solo alertas críticas
                if(/PTWC|GDACS|GloFAS/i.test(src)) return (a.priority||0)>=70;
                return (a.priority||0)>=75;
            }
            if(/TSUNAMI|HURACÁN|CICLÓN|ALERTA TSUNAMI/.test(a.type||'')) return true;
            return a.distKm<=radiusKm;
        })
        .sort(function(a,b){return (b.priority||0)-(a.priority||0);});
}

// ========== CARGA GLOBAL ==========
async function loadGlobalAlerts() {
    console.log('🌍 Cargando alertas globales...');
    var all=[];
    (await Promise.allSettled([
        fetchUSGS(0,0),
        fetchEMSC(0,0),
        Promise.resolve(getVolcanes(0,0)),
        fetchHurricanes(),
        fetchNASAFIRMS(0,0),
        fetchFires(0,0),
        fetchGDACS(),
        fetchGloFAS(),
        fetchSpaceWeather(),
        fetchSPC(),
        fetchMeteoAlarm(),
        fetchPTWC(),
        fetchSHOA()
    ])).forEach(function(r){if(r.status==='fulfilled')all=all.concat(r.value||[]);});
    return all.filter(function(a){return (a.priority||0)>=30;})
              .sort(function(a,b){return (b.priority||0)-(a.priority||0);})
              .slice(0,500);
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
