// ============================================
// js/zone-engine.js — Detección de zona geográfica
// y generación de pins climáticos para el mapa
// ============================================

// ── TIPOS DE ZONA ──
var ZONE_TYPES = {
    COASTAL:   { id:'coastal',   icon:'🏖️', label:'Zona Costera',    color:'#0088ff' },
    MOUNTAIN:  { id:'mountain',  icon:'🏔️', label:'Zona Montañosa',  color:'#8855aa' },
    DESERT:    { id:'desert',    icon:'🏜️', label:'Desierto/Árido',  color:'#ff9900' },
    VALLEY:    { id:'valley',    icon:'🌄', label:'Valle/Cuenca',    color:'#44aa44' },
    FOREST:    { id:'forest',    icon:'🌲', label:'Zona Boscosa',   color:'#226622' },
    URBAN:     { id:'urban',     icon:'🏙️', label:'Zona Urbana',    color:'#888888' },
    UNKNOWN:   { id:'unknown',   icon:'📍', label:'Tu zona',        color:'#aaaaaa' }
};

// Zona detectada actualmente
window.currentZone = null;

// ── DETECTAR ZONA desde Open-Meteo ──
async function detectZoneType(lat, lon) {
    try {
        // Open-Meteo incluye elevation y variables que permiten inferir zona
        var url = 'https://api.open-meteo.com/v1/forecast?' +
            'latitude='+lat+'&longitude='+lon +
            '&current=temperature_2m,precipitation,relative_humidity_2m,' +
            'wind_speed_10m,surface_pressure,visibility' +
            '&daily=precipitation_sum,temperature_2m_max,temperature_2m_min' +
            '&models=best_match&timezone=auto&forecast_days=1' +
            '&elevation=true'; // incluye elevación del punto

        var r = await fetch(url, {signal: AbortSignal.timeout(8000)});
        if (!r.ok) throw new Error('HTTP '+r.status);
        var d = await r.json();

        var elev     = d.elevation || 0;          // metros sobre el mar
        var temp     = (d.current && d.current.temperature_2m) || 15;
        var rain     = (d.daily && d.daily.precipitation_sum && d.daily.precipitation_sum[0]) || 0;
        var humidity = (d.current && d.current.relative_humidity_2m) || 60;
        var pressure = (d.current && d.current.surface_pressure) || 1013;
        var wind     = (d.current && d.current.wind_speed_10m) || 0;
        var vis      = (d.current && d.current.visibility) || 10000;

        // Presión corregida a nivel del mar para inferir elevación real
        // P_sl = P * e^(elev/8434)
        var pressureSL = pressure * Math.exp(elev / 8434);

        // ── Clasificar zona ──
        var zone = classifyZone(lat, lon, elev, temp, rain, humidity, wind, pressureSL);
        zone.elevation = elev;
        zone.conditions = { temp, rain, humidity, wind, pressure, visibility: vis };

        window.currentZone = zone;
        console.log('🗺️ Zona detectada:', zone.type.label, '| Elevación:', Math.round(elev)+'m');

        // Notificar a la app del cambio de zona
        if (typeof window.onZoneDetected === 'function') {
            window.onZoneDetected(zone);
        }

        return zone;
    } catch(e) {
        console.log('ZoneEngine error:', e);
        return { type: ZONE_TYPES.UNKNOWN, elevation: 0, conditions: {} };
    }
}

function classifyZone(lat, lon, elev, temp, rain, humidity, wind, pressure) {
    // ── 1. COSTERA — cerca del mar ──
    // Heurística geográfica mejorada + humedad alta + viento
    var isCostalGeo = false;
    // Chile costa Pacífico
    if (lat>=-56 && lat<=-17 && lon<=-71.0) isCostalGeo = true;
    // Chile/Argentina sur con fiordos
    if (lat<=-42 && lon<=-72) isCostalGeo = true;
    // Costa Atlántica
    if (lat>=-55 && lat<=10 && lon>=-52 && lon<=-34) isCostalGeo = true;
    // Europa costera, Japón, Australia, etc.
    if (elev < 50 && humidity > 75 && wind > 15) isCostalGeo = true;

    if (isCostalGeo && elev < 200) {
        return { type: ZONE_TYPES.COASTAL, geo: { lat, lon, elev } };
    }

    // ── 2. MONTAÑA — elevación alta ──
    if (elev > 2500) return { type: ZONE_TYPES.MOUNTAIN, geo: { lat, lon, elev } };
    if (elev > 1500 && pressure < 850) return { type: ZONE_TYPES.MOUNTAIN, geo: { lat, lon, elev } };

    // ── 3. DESIERTO — árido y caluroso ──
    // Atacama (lat -18 a -30, lon -68 a -71), Sahara, Arabia, etc.
    var isDesertGeo = (lat>=-30 && lat<=-18 && lon>=-71 && lon<=-66); // Atacama
    isDesertGeo = isDesertGeo || (lat>=18 && lat<=32 && lon>=-18 && lon<=60);  // Sahara/Arabia
    isDesertGeo = isDesertGeo || (lat>=-35 && lat<=-18 && lon>=-70 && lon<=-60 && rain < 5);
    if (isDesertGeo && humidity < 40 && rain < 10) {
        return { type: ZONE_TYPES.DESERT, geo: { lat, lon, elev } };
    }

    // ── 4. VALLE/CUENCA — presión más alta, menos viento ──
    if (elev > 500 && elev < 1500 && wind < 15 && humidity > 55) {
        return { type: ZONE_TYPES.VALLEY, geo: { lat, lon, elev } };
    }

    // ── 5. BOSQUE/FORESTAL — lluvia alta, humedad alta ──
    // Patagonia, bosque templado, selva
    if (rain > 5 && humidity > 80 && temp < 20) {
        return { type: ZONE_TYPES.FOREST, geo: { lat, lon, elev } };
    }

    // ── 6. URBANO — presión normal, parámetros medios ──
    return { type: ZONE_TYPES.URBAN, geo: { lat, lon, elev } };
}

// ── ALERTAS ADAPTADAS POR ZONA ──
function getZoneSpecificTips(zone, alerts) {
    if (!zone) return [];
    var tips = [];
    var zid = zone.type.id;
    var cond = zone.conditions || {};
    var elev = zone.elevation || 0;

    if (zid === 'coastal') {
        tips.push({
            icon: '🌊', title: 'Zona Costera — Cuidados específicos', color: '#0088ff',
            tips: [
                '🌊 Monitorea el nivel del mar y marejadas antes de actividades en playa',
                '⛵ Verifica el estado del mar antes de salir en embarcaciones',
                '📡 Frecuencia marítima de emergencia: Canal 16 VHF (156.8 MHz)',
                '🌀 En caso de sismo ≥M6 cerca de la costa: ALÉJATE del mar inmediatamente',
                '⚓ Caletas pesqueras: evitar zonas bajas con oleaje > 2m'
            ]
        });
        if (cond.wind > 30) tips.push({
            icon: '💨', title: 'Viento costero elevado', color: '#4488ff',
            tips: [
                'Viento '+Math.round(cond.wind)+' km/h — condiciones marítimas adversas',
                'No recomendado: pesca artesanal, kayak ni deportes de playa',
                'Arena en suspensión — usa gafas en playas expuestas'
            ]
        });
    }

    if (zid === 'mountain') {
        tips.push({
            icon: '🏔️', title: 'Zona Montañosa '+Math.round(elev)+'m — Cuidados', color: '#8855aa',
            tips: [
                '❄️ Temperatura cae 6.5°C por cada 1000m de altitud',
                '🌬️ Vientos más fuertes en crestas y pasos de montaña',
                '⚡ Tormentas eléctricas: no permanecer en cimas ni bajo árboles aislados',
                '🎒 Lleva ropa impermeable y de abrigo aunque el tiempo parezca bueno',
                '📱 Cobertura celular limitada — informa tu ruta antes de salir'
            ]
        });
        if (elev > 3000) tips.push({
            icon: '🫁', title: 'Altitud elevada — Soroche', color: '#9966cc',
            tips: [
                'A '+Math.round(elev)+'m: posible mal de altura (soroche)',
                'Síntomas: dolor de cabeza, náuseas, mareo',
                'Aclimatación recomendada: descanso 24-48h al subir',
                'Evita actividad física intensa el primer día'
            ]
        });
    }

    if (zid === 'desert') {
        tips.push({
            icon: '🏜️', title: 'Zona Árida/Desértica — Cuidados', color: '#ff9900',
            tips: [
                '💧 Hidratación crítica: mínimo 4-6 litros de agua por día',
                '☀️ UV extremo en zonas áridas — protector 50+ obligatorio',
                '🌡️ Temperatura puede superar 40°C al mediodía y bajar a 5°C de noche',
                '🚗 Revisa agua y combustible antes de rutas en zonas remotas',
                '🕐 Evita actividad exterior entre 11:00-16:00'
            ]
        });
    }

    if (zid === 'valley') {
        tips.push({
            icon: '🌄', title: 'Valle/Cuenca — Cuidados específicos', color: '#44aa44',
            tips: [
                '🌫️ Riesgo de inversión térmica en invierno — acumulación de smog',
                '💨 Circulación de vientos encauzados por el valle',
                '🌊 Precaución en orillas de ríos — crecidas repentinas tras lluvias en altura',
                '❄️ Heladas más intensas en fondos de valle en noches despejadas'
            ]
        });
    }

    if (zid === 'forest') {
        tips.push({
            icon: '🌲', title: 'Zona Boscosa/Húmeda — Cuidados', color: '#226622',
            tips: [
                '🔥 En verano seco: riesgo de incendio forestal',
                '🌧️ Suelos húmedos: precaución con deslizamientos tras lluvias intensas',
                '🌡️ Temperatura puede ser varios grados menor que zonas abiertas',
                '📍 Marca tu ruta si entras al bosque — fácil desorientación'
            ]
        });
    }

    return tips;
}

// ── PINS CLIMÁTICOS EN GRILLA (para el mapa) ──
// Genera 8 puntos alrededor del usuario en una grilla y consulta clima en cada uno
async function generateClimateGridPins(centerLat, centerLon, radiusDeg) {
    radiusDeg = radiusDeg || 0.8; // ~90km
    var pins = [];

    // 8 puntos en grilla + centro
    var offsets = [
        [0, 0],               // Centro
        [-radiusDeg, 0],      // Norte
        [radiusDeg, 0],       // Sur
        [0, -radiusDeg],      // Oeste
        [0, radiusDeg],       // Este
        [-radiusDeg*0.7, -radiusDeg*0.7], // NO
        [-radiusDeg*0.7,  radiusDeg*0.7], // NE
        [ radiusDeg*0.7, -radiusDeg*0.7], // SO
        [ radiusDeg*0.7,  radiusDeg*0.7]  // SE
    ];

    // Consultar todos en paralelo (batch en Open-Meteo no disponible — usar Promise.allSettled)
    var results = await Promise.allSettled(offsets.map(function(off) {
        var lat = centerLat + off[0];
        var lon = centerLon + off[1];
        return fetchClimatePoint(lat, lon);
    }));

    offsets.forEach(function(off, i) {
        if (results[i].status === 'fulfilled' && results[i].value) {
            pins.push(results[i].value);
        }
    });

    return pins;
}

async function fetchClimatePoint(lat, lon) {
    try {
        var url = 'https://api.open-meteo.com/v1/forecast?' +
            'latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4) +
            '&current=temperature_2m,precipitation,wind_speed_10m,' +
            'weather_code,relative_humidity_2m' +
            '&timezone=auto&forecast_days=1';
        var r = await fetch(url, {signal: AbortSignal.timeout(6000)});
        if (!r.ok) return null;
        var d = await r.json();
        if (!d.current) return null;
        var c = d.current;
        var wc = c.weather_code || 0;
        var icon = weatherCodeToIcon(wc);
        var rain = c.precipitation || 0;
        var temp = c.temperature_2m != null ? Math.round(c.temperature_2m) : null;
        var wind = Math.round(c.wind_speed_10m || 0);
        if (temp == null) return null;

        // Determinar color del pin según condiciones
        var pinColor = '#00cc88'; // verde = normal
        var priority = 30;
        if (rain > 20) { pinColor = '#0055aa'; priority = 60; }
        else if (rain > 5) { pinColor = '#4488ff'; priority = 45; }
        if (wind > 60) { pinColor = '#ff6600'; priority = 70; }
        if (wind > 80) { pinColor = '#ff0000'; priority = 85; }
        if (temp > 38) { pinColor = '#ff4400'; priority = 72; }
        if (temp < -5) { pinColor = '#aaddff'; priority = 65; }

        return {
            id: 'climate_'+lat.toFixed(2)+'_'+lon.toFixed(2),
            type: 'CLIMA', icon: icon,
            lat: lat, lon: lon, distKm: null,
            title: icon+' '+temp+'°C '+wind+'km/h'+(rain>0?' 💧'+rain.toFixed(0)+'mm':''),
            description: 'Temp: '+temp+'°C | Viento: '+wind+' km/h'+(rain>0?' | Lluvia: '+rain.toFixed(1)+'mm':''),
            source: 'Open-Meteo Grid',
            priority: priority, color: pinColor,
            time: new Date().toLocaleString('es-CL'),
            _timeMs: Date.now(),
            _isClimatePin: true  // marcar para mapa
        };
    } catch(e) { return null; }
}

function weatherCodeToIcon(code) {
    if (code === 0) return '☀️';
    if (code <= 2) return '🌤️';
    if (code <= 3) return '☁️';
    if (code <= 49) return '🌫️';
    if (code <= 59) return '🌦️';
    if (code <= 69) return '🌧️';
    if (code <= 79) return '🌨️';
    if (code <= 84) return '🌧️';
    if (code <= 99) return '⛈️';
    return '🌡️';
}

// ── INICIALIZACIÓN ──
window.ZoneEngine = {
    detect: detectZoneType,
    getZoneTips: getZoneSpecificTips,
    generateGridPins: generateClimateGridPins,
    currentZone: function() { return window.currentZone; }
};
