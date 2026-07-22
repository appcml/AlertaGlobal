// ============================================
// js/alert-engine.js — Motor de alertas
// Genera alertas propias basadas en escalas
// oficiales internacionales (WMO, USGS, etc.)
// ============================================

// ── Niveles de alerta (escala unificada basada en estándares oficiales) ──
var LEVELS = {
    BLACK:  { label:'EXTREMO',  color:'#1a1a1a', bg:'#1a1a1a', text:'#ffffff', priority:100, icon:'⚫' },
    RED:    { label:'CRÍTICO',  color:'#c0392b', bg:'#f8d7da', text:'#7a1a1a', priority:80,  icon:'🔴' },
    ORANGE: { label:'ALTO',     color:'#e67e22', bg:'#ffe0cc', text:'#8a3a00', priority:65,  icon:'🟠' },
    YELLOW: { label:'MODERADO', color:'#d4a017', bg:'#fff3cd', text:'#7a5000', priority:50,  icon:'🟡' },
    GREEN:  { label:'BAJO',     color:'#27ae60', bg:'#d4edda', text:'#1a5c2a', priority:30,  icon:'🟢' },
    NONE:   { label:'NORMAL',   color:'#95a5a6', bg:'#f0efec', text:'#52514e', priority:0,   icon:'⚪' },
};

// ── 1. ANÁLISIS DE VIENTO — Escala Beaufort ──
function analyzeWind(ws, wg, city) {
    // ws = velocidad km/h, wg = ráfagas km/h
    var max = Math.max(ws||0, wg||0);
    if (max <= 0) return null;

    var beaufort, level, desc, accion;
    if (max >= 252) {
        beaufort=12; level='BLACK';
        desc='Viento huracán '+Math.round(max)+' km/h';
        accion='Destrucción total. No salir bajo ningún motivo.';
    } else if (max >= 118) {
        beaufort=11; level='RED';
        desc='Tormenta violenta '+Math.round(max)+' km/h';
        accion='Daños estructurales severos. Evacuación. No salir.';
    } else if (max >= 88) {
        beaufort=10; level='RED';
        desc='Tormenta '+Math.round(max)+' km/h';
        accion='Árboles arrancados. Daños en edificios. Permanecer en interior.';
    } else if (max >= 75) {
        beaufort=9; level='ORANGE';
        desc='Vendaval fuerte '+Math.round(max)+' km/h';
        accion='Ramas rotas. Daños en infraestructura. Precaución.';
    } else if (max >= 62) {
        beaufort=8; level='ORANGE';
        desc='Vendaval '+Math.round(max)+' km/h';
        accion='Difícil caminar contra el viento. Precaución conducción.';
    } else if (max >= 50) {
        beaufort=7; level='YELLOW';
        desc='Viento fuerte '+Math.round(max)+' km/h';
        accion='Navegación peligrosa para embarcaciones pequeñas.';
    } else if (max >= 39) {
        beaufort=6; level='YELLOW';
        desc='Brisa fuerte '+Math.round(max)+' km/h';
        accion='Arena vuela en playas. Dificultad con paraguas.';
    } else if (max >= 29) {
        beaufort=5; level='GREEN';
        desc='Brisa moderada '+Math.round(max)+' km/h';
        accion='Condiciones normales. Atención con objetos livianos.';
    } else return null; // < Beaufort 5: sin alerta

    if (level === 'GREEN') return null; // No generar alerta verde

    var L = LEVELS[level];
    return {
        id:'wind_b'+beaufort+'_'+Date.now(),
        type:'VIENTO', icon:'💨',
        alertLevel: level,
        alertScale: 'Escala Beaufort '+beaufort,
        title:L.icon+' ['+L.label+'] '+desc+(city?' — '+city:''),
        description:accion+(wg>ws?' Ráfagas de hasta '+Math.round(wg)+' km/h.':''),
        color:L.color, bg:L.bg,
        priority:L.priority + Math.min(20, Math.round(max/10)),
        source:'Open-Meteo / Beaufort',
        distKm:0, lat:null, lon:null
    };
}

// ── 2. ANÁLISIS DE PRECIPITACIÓN ──
function analyzeRain(rain, snow, weatherCode, city) {
    var alerts = [];
    var now = new Date().toLocaleString('es-CL');

    // Lluvia (mm/h)
    if (rain >= 50) {
        alerts.push({
            id:'rain_ex_'+Date.now(), type:'LLUVIA TORRENCIAL', icon:'🌧️',
            alertLevel:'BLACK', alertScale:'WMO / Clasificación OMM',
            title:'⚫ [EXTREMO] Lluvia torrencial '+rain.toFixed(0)+' mm/h'+(city?' — '+city:''),
            description:'Lluvia extrema. Riesgo de inundaciones repentinas, deslizamientos y anegamientos generalizados. Evacuación preventiva.',
            color:LEVELS.BLACK.color, bg:LEVELS.BLACK.bg,
            priority:98, source:'Open-Meteo / WMO', distKm:0
        });
    } else if (rain >= 30) {
        alerts.push({
            id:'rain_h_'+Date.now(), type:'LLUVIA MUY INTENSA', icon:'🌧️',
            alertLevel:'RED', alertScale:'WMO / Clasificación OMM',
            title:'🔴 [CRÍTICO] Lluvia muy intensa '+rain.toFixed(0)+' mm/h'+(city?' — '+city:''),
            description:'Precipitación muy intensa. Alto riesgo de inundaciones y deslizamientos. Evitar circular.',
            color:LEVELS.RED.color, bg:LEVELS.RED.bg,
            priority:88, source:'Open-Meteo / WMO', distKm:0
        });
    } else if (rain >= 15) {
        alerts.push({
            id:'rain_m_'+Date.now(), type:'LLUVIA INTENSA', icon:'🌧️',
            alertLevel:'ORANGE', alertScale:'WMO / Clasificación OMM',
            title:'🟠 [ALTO] Lluvia intensa '+rain.toFixed(1)+' mm/h'+(city?' — '+city:''),
            description:'Precipitación intensa. Posibles anegamientos. Conducir con precaución.',
            color:LEVELS.ORANGE.color, bg:LEVELS.ORANGE.bg,
            priority:70, source:'Open-Meteo / WMO', distKm:0
        });
    } else if (rain >= 5) {
        alerts.push({
            id:'rain_l_'+Date.now(), type:'LLUVIA MODERADA', icon:'🌦️',
            alertLevel:'YELLOW', alertScale:'WMO / Clasificación OMM',
            title:'🟡 [MODERADO] Lluvia '+rain.toFixed(1)+' mm/h'+(city?' — '+city:''),
            description:'Precipitación moderada. Vías mojadas. Reducir velocidad al conducir.',
            color:LEVELS.YELLOW.color, bg:LEVELS.YELLOW.bg,
            priority:52, source:'Open-Meteo / WMO', distKm:0
        });
    } else if (rain >= 0.5) {
        alerts.push({
            id:'drizzle_'+Date.now(), type:'LLOVIZNA', icon:'🌂',
            alertLevel:'YELLOW', alertScale:'WMO',
            title:'🟡 Llovizna'+(city?' — '+city:''),
            description:'Precipitación leve. Carreteras húmedas.',
            color:LEVELS.YELLOW.color, bg:LEVELS.YELLOW.bg,
            priority:35, source:'Open-Meteo / WMO', distKm:0
        });
    }

    // Nieve (cm/h)
    if (snow >= 10) {
        alerts.push({
            id:'snow_h_'+Date.now(), type:'NEVADA INTENSA', icon:'❄️',
            alertLevel:'RED', alertScale:'WMO / Clasificación OMM',
            title:'🔴 [CRÍTICO] Nevada intensa '+snow.toFixed(0)+' cm/h'+(city?' — '+city:''),
            description:'Nevada intensa. Rutas cerradas o peligrosas. No circular sin cadenas o neumáticos de invierno.',
            color:LEVELS.RED.color, bg:LEVELS.RED.bg,
            priority:85, source:'Open-Meteo / WMO', distKm:0
        });
    } else if (snow >= 3) {
        alerts.push({
            id:'snow_m_'+Date.now(), type:'NEVADA', icon:'❄️',
            alertLevel:'ORANGE', alertScale:'WMO / Clasificación OMM',
            title:'🟠 [ALTO] Nevada '+snow.toFixed(1)+' cm/h'+(city?' — '+city:''),
            description:'Nieve acumulándose. Vías resbaladizas. Precaución al conducir.',
            color:LEVELS.ORANGE.color, bg:LEVELS.ORANGE.bg,
            priority:70, source:'Open-Meteo / WMO', distKm:0
        });
    } else if (snow > 0) {
        alerts.push({
            id:'snow_l_'+Date.now(), type:'NEVADA LEVE', icon:'🌨️',
            alertLevel:'YELLOW', alertScale:'WMO',
            title:'🟡 Nevada leve'+(city?' — '+city:''),
            description:'Caída de nieve. Precaución en vías.',
            color:LEVELS.YELLOW.color, bg:LEVELS.YELLOW.bg,
            priority:55, source:'Open-Meteo / WMO', distKm:0
        });
    }

    // Tormenta eléctrica (código WMO 95-99)
    if (weatherCode >= 95) {
        var isHail = weatherCode >= 96;
        alerts.push({
            id:'thunder_'+Date.now(),
            type:isHail?'TORMENTA CON GRANIZO':'TORMENTA ELÉCTRICA',
            icon:'⛈️',
            alertLevel:'RED', alertScale:'WMO Code '+weatherCode,
            title:'🔴 [CRÍTICO] Tormenta eléctrica'+(isHail?' con granizo':'')+' activa'+(city?' — '+city:''),
            description:'Tormenta con rayos'+(isHail?' y granizo':'')+'. Buscar refugio inmediatamente. No permanecer en espacios abiertos.',
            color:LEVELS.RED.color, bg:LEVELS.RED.bg,
            priority:85, source:'Open-Meteo / WMO', distKm:0
        });
    } else if (weatherCode >= 80 && weatherCode <= 82) {
        alerts.push({
            id:'shower_'+Date.now(), type:'CHUBASCOS FUERTES', icon:'🌦️',
            alertLevel:'ORANGE', alertScale:'WMO Code '+weatherCode,
            title:'🟠 [ALTO] Chubascos fuertes'+(city?' — '+city:''),
            description:'Chubascos intensos. Posibles inundaciones locales.',
            color:LEVELS.ORANGE.color, bg:LEVELS.ORANGE.bg,
            priority:65, source:'Open-Meteo / WMO', distKm:0
        });
    }

    // Granizo (código WMO 84-87)
    if (weatherCode >= 84 && weatherCode <= 87) {
        alerts.push({
            id:'hail_'+Date.now(), type:'GRANIZO', icon:'🌨️',
            alertLevel:'ORANGE', alertScale:'WMO Code '+weatherCode,
            title:'🟠 [ALTO] Granizo'+(city?' — '+city:''),
            description:'Caída de granizo. Proteger vehículos y cultivos. Buscar techo.',
            color:LEVELS.ORANGE.color, bg:LEVELS.ORANGE.bg,
            priority:68, source:'Open-Meteo / WMO', distKm:0
        });
    }

    return alerts;
}

// ── 3. ANÁLISIS DE TEMPERATURA ──
function analyzeTemp(temp, feels, city) {
    if (feels === null || feels === undefined) feels = temp;

    if (feels <= -25) return {
        id:'temp_polar_'+Date.now(), type:'FRÍO POLAR', icon:'🥶',
        alertLevel:'BLACK', alertScale:'Sensación térmica',
        title:'⚫ [EXTREMO] Frío polar '+Math.round(temp)+'°C (sens. '+Math.round(feels)+'°C)'+(city?' — '+city:''),
        description:'Temperatura extremadamente peligrosa. Hipotermia en minutos. No salir.',
        color:LEVELS.BLACK.color, bg:'#0d3b6e',
        priority:95, source:'Open-Meteo', distKm:0
    };
    if (feels <= -15) return {
        id:'temp_cold_'+Date.now(), type:'FRÍO INTENSO', icon:'🥶',
        alertLevel:'RED', alertScale:'Sensación térmica',
        title:'🔴 [CRÍTICO] Frío intenso '+Math.round(temp)+'°C (sens. '+Math.round(feels)+'°C)'+(city?' — '+city:''),
        description:'Riesgo de hipotermia. Heladas severas. Abríguese completamente.',
        color:'#1a6aaa', bg:'#d0e8ff',
        priority:82, source:'Open-Meteo', distKm:0
    };
    if (temp <= 0 && temp > -15) return {
        id:'temp_frost_'+Date.now(), type:'HELADA', icon:'🧊',
        alertLevel:'ORANGE', alertScale:'Temperatura bajo cero',
        title:'🟠 [ALTO] Helada '+Math.round(temp)+'°C'+(city?' — '+city:''),
        description:'Temperatura bajo cero. Superficies heladas. Precaución al conducir.',
        color:'#2980b9', bg:'#d6eaf8',
        priority:65, source:'Open-Meteo', distKm:0
    };
    if (feels <= -5 && temp > 0) return {
        id:'temp_windchill_'+Date.now(), type:'FRÍO MODERADO', icon:'🌬️',
        alertLevel:'YELLOW', alertScale:'Sensación térmica',
        title:'🟡 [MODERADO] Frío '+Math.round(temp)+'°C (sens. '+Math.round(feels)+'°C)'+(city?' — '+city:''),
        description:'Sensación de frío intenso por viento. Abrigarse bien al salir.',
        color:LEVELS.YELLOW.color, bg:'#d6eaf8',
        priority:52, source:'Open-Meteo', distKm:0
    };
    if (temp >= 42) return {
        id:'temp_ext_'+Date.now(), type:'CALOR EXTREMO', icon:'🔥',
        alertLevel:'BLACK', alertScale:'OMM Ola de Calor',
        title:'⚫ [EXTREMO] Calor extremo '+Math.round(temp)+'°C (sens. '+Math.round(feels)+'°C)'+(city?' — '+city:''),
        description:'Temperatura extrema. Riesgo vital. Permanecer en interior con clima artificial. Hidratarse constantemente.',
        color:LEVELS.BLACK.color, bg:'#7a1a1a',
        priority:96, source:'Open-Meteo / OMM', distKm:0
    };
    if (temp >= 38) return {
        id:'temp_hot_'+Date.now(), type:'CALOR PELIGROSO', icon:'🔥',
        alertLevel:'RED', alertScale:'OMM Ola de Calor',
        title:'🔴 [CRÍTICO] Calor peligroso '+Math.round(temp)+'°C'+(city?' — '+city:''),
        description:'Temperatura muy alta. Riesgo de golpe de calor. Evitar exposición solar. Hidratarse.',
        color:LEVELS.RED.color, bg:LEVELS.RED.bg,
        priority:84, source:'Open-Meteo / OMM', distKm:0
    };
    if (temp >= 35) return {
        id:'temp_warm_'+Date.now(), type:'CALOR INTENSO', icon:'☀️',
        alertLevel:'ORANGE', alertScale:'OMM',
        title:'🟠 [ALTO] Calor intenso '+Math.round(temp)+'°C'+(city?' — '+city:''),
        description:'Temperatura elevada. Hidratarse. Reducir actividad física al aire libre.',
        color:LEVELS.ORANGE.color, bg:LEVELS.ORANGE.bg,
        priority:65, source:'Open-Meteo / OMM', distKm:0
    };
    return null;
}

// ── 4. ANÁLISIS DE VISIBILIDAD ──
function analyzeVisibility(vis, weatherCode, city) {
    if (!vis && vis !== 0) return null;
    if (vis >= 2000) return null;

    if (vis < 200) return {
        id:'fog_ex_'+Date.now(), type:'NIEBLA DENSA', icon:'🌫️',
        alertLevel:'RED', alertScale:'WMO / Criterio aeronáutico',
        title:'🔴 [CRÍTICO] Niebla densa — visibilidad '+Math.round(vis)+'m'+(city?' — '+city:''),
        description:'Visibilidad muy reducida. Peligro en carreteras y aeropuertos. Conducir solo si es indispensable con luces y baja velocidad.',
        color:LEVELS.RED.color, bg:LEVELS.RED.bg,
        priority:80, source:'Open-Meteo / WMO', distKm:0
    };
    if (vis < 500) return {
        id:'fog_h_'+Date.now(), type:'NIEBLA', icon:'🌫️',
        alertLevel:'ORANGE', alertScale:'WMO',
        title:'🟠 [ALTO] Niebla — visibilidad '+Math.round(vis)+'m'+(city?' — '+city:''),
        description:'Visibilidad muy reducida. Precaución al conducir. Reducir velocidad.',
        color:LEVELS.ORANGE.color, bg:LEVELS.ORANGE.bg,
        priority:65, source:'Open-Meteo / WMO', distKm:0
    };
    return {
        id:'fog_m_'+Date.now(), type:'NIEBLA PARCIAL', icon:'🌫️',
        alertLevel:'YELLOW', alertScale:'WMO',
        title:'🟡 [MODERADO] Niebla parcial — visibilidad '+(vis/1000).toFixed(1)+' km'+(city?' — '+city:''),
        description:'Visibilidad reducida. Precaución.',
        color:LEVELS.YELLOW.color, bg:LEVELS.YELLOW.bg,
        priority:48, source:'Open-Meteo / WMO', distKm:0
    };
}

// ── 5. ANÁLISIS DE PRESIÓN (sistemas de tormenta) ──
function analyzePressure(pressure, city) {
    if (!pressure) return null;
    if (pressure >= 990) return null; // Normal

    if (pressure < 960) return {
        id:'pres_ex_'+Date.now(), type:'DEPRESIÓN PROFUNDA', icon:'🌀',
        alertLevel:'RED', alertScale:'Meteorología sinóptica',
        title:'🔴 [CRÍTICO] Depresión muy profunda '+Math.round(pressure)+' hPa'+(city?' — '+city:''),
        description:'Presión extremadamente baja. Sistema de tormenta severa activo. Condiciones meteorológicas extremas.',
        color:LEVELS.RED.color, bg:LEVELS.RED.bg,
        priority:82, source:'Open-Meteo', distKm:0
    };
    if (pressure < 975) return {
        id:'pres_h_'+Date.now(), type:'BAJA PRESIÓN INTENSA', icon:'🌀',
        alertLevel:'ORANGE', alertScale:'Meteorología sinóptica',
        title:'🟠 [ALTO] Baja presión intensa '+Math.round(pressure)+' hPa'+(city?' — '+city:''),
        description:'Presión muy baja. Posible sistema de tormenta. Empeoramiento del tiempo.',
        color:LEVELS.ORANGE.color, bg:LEVELS.ORANGE.bg,
        priority:68, source:'Open-Meteo', distKm:0
    };
    return {
        id:'pres_m_'+Date.now(), type:'BAJA PRESIÓN', icon:'⬇️',
        alertLevel:'YELLOW', alertScale:'Meteorología sinóptica',
        title:'🟡 [MODERADO] Baja presión '+Math.round(pressure)+' hPa'+(city?' — '+city:''),
        description:'Presión bajo lo normal. Posible deterioro del tiempo.',
        color:LEVELS.YELLOW.color, bg:LEVELS.YELLOW.bg,
        priority:50, source:'Open-Meteo', distKm:0
    };
}

// ── 6. ANÁLISIS DE CALIDAD DEL AIRE (AQI) ──
function analyzeAQI(aqi, pm25, pm10, city) {
    if (!aqi || aqi <= 50) return null;

    var level, desc, accion;
    if (aqi > 300) {
        level='BLACK';
        desc='AQI '+aqi+' — Peligroso';
        accion='Emergencia sanitaria. Toda la población en riesgo. No salir. Usar mascarilla N95 si es indispensable.';
    } else if (aqi > 200) {
        level='RED';
        desc='AQI '+aqi+' — Muy dañino';
        accion='Alertas sanitarias. Evitar toda actividad exterior. Uso de mascarilla obligatorio.';
    } else if (aqi > 150) {
        level='RED';
        desc='AQI '+aqi+' — Dañino';
        accion='Toda la población puede ver efectos en salud. Reducir tiempo en exterior.';
    } else if (aqi > 100) {
        level='ORANGE';
        desc='AQI '+aqi+' — Grupos sensibles';
        accion='Niños, ancianos y enfermos: reducir actividad exterior. Posibles síntomas respiratorios.';
    } else {
        level='YELLOW';
        desc='AQI '+aqi+' — Moderado';
        accion='Grupos muy sensibles podrían presentar síntomas. Precaución.';
    }

    var L = LEVELS[level];
    var extra = [];
    if (pm25 && pm25 > 25) extra.push('PM2.5: '+pm25.toFixed(0)+' μg/m³');
    if (pm10 && pm10 > 50) extra.push('PM10: '+pm10.toFixed(0)+' μg/m³');

    return {
        id:'aqi_'+Date.now(), type:'CALIDAD DEL AIRE', icon:'😷',
        alertLevel:level, alertScale:'EPA AQI',
        title:L.icon+' ['+L.label+'] '+desc+(city?' — '+city:''),
        description:accion+(extra.length?' ('+extra.join(', ')+')':''),
        color:L.color, bg:L.bg,
        priority:L.priority + 5,
        source:'Open-Meteo AQI / EPA', distKm:0
    };
}

// ── 7. ANÁLISIS DE SISMOS (escala USGS) ──
function analyzeEarthquake(magnitude, place, depth, dist) {
    if (!magnitude || magnitude < 2.5) return null;

    var level, desc, accion;
    if (magnitude >= 8.0) {
        level='BLACK';
        desc='Gran terremoto M'+magnitude.toFixed(1);
        accion='Catastrófico. Alerta de tsunami posible. Evacuar costas de inmediato.';
    } else if (magnitude >= 7.0) {
        level='BLACK';
        desc='Terremoto mayor M'+magnitude.toFixed(1);
        accion='Daños extensos. Posible tsunami. Alejarse de costas y edificios dañados.';
    } else if (magnitude >= 6.0) {
        level='RED';
        desc='Terremoto fuerte M'+magnitude.toFixed(1);
        accion='Daños en edificios. Evaluar estructuras antes de entrar. Verificar alerta tsunami.';
    } else if (magnitude >= 5.0) {
        level='ORANGE';
        desc='Terremoto moderado M'+magnitude.toFixed(1);
        accion='Daños leves posibles. Revisar integridad de edificios. Precaución.';
    } else if (magnitude >= 4.0) {
        level='YELLOW';
        desc='Sismo ligero M'+magnitude.toFixed(1);
        accion='Sentido por personas. Posible caída de objetos. Sin daños mayores.';
    } else {
        level='GREEN';
        desc='Sismo menor M'+magnitude.toFixed(1);
        accion='Rara vez sentido. Sin daños.';
        return null;
    }

    if (level === 'GREEN') return null;

    var L = LEVELS[level];
    var distStr = dist ? ' ('+Math.round(dist)+' km)' : '';
    return {
        id:'eq_engine_'+Date.now()+'_'+magnitude,
        type:'SISMO', icon:magnitude>=7?'🔴':magnitude>=5?'🟠':'🟡',
        alertLevel:level, alertScale:'Escala de Magnitud USGS',
        title:L.icon+' ['+L.label+'] '+desc,
        description:(place||'Sin datos de ubicación')+distStr+
                   '. Prof: '+(depth?Math.round(depth)+'km':'?')+'.'+(magnitude>=6?' Verificar alerta de tsunami.':'')+' '+accion,
        color:L.color, bg:L.bg,
        priority:L.priority + Math.round(magnitude * 3),
        source:'USGS', distKm:dist||null
    };
}

// ── 8. ANÁLISIS DE RIESGO INCENDIO ──
function analyzeFireRisk(temp, humidity, wind, city) {
    if (!temp || !humidity) return null;
    // Índice de riesgo simple: temperatura alta + humedad baja + viento
    var risk = 0;
    if (temp > 35) risk += 30;
    else if (temp > 28) risk += 15;
    if (humidity < 20) risk += 40;
    else if (humidity < 35) risk += 20;
    if (wind > 40) risk += 20;
    else if (wind > 25) risk += 10;

    if (risk < 50) return null;

    var level = risk >= 80 ? 'RED' : risk >= 65 ? 'ORANGE' : 'YELLOW';
    var L = LEVELS[level];
    return {
        id:'fire_risk_'+Date.now(), type:'RIESGO DE INCENDIO', icon:'🔥',
        alertLevel:level, alertScale:'Índice FWI (adaptado)',
        title:L.icon+' ['+L.label+'] Alto riesgo de incendio forestal'+(city?' — '+city:''),
        description:'Condiciones críticas: '+Math.round(temp)+'°C, humedad '+Math.round(humidity)+'%, viento '+Math.round(wind)+' km/h. '+
                   (level==='RED'?'Prohibición de fuego. No encender braseros ni fogatas.':'Extremar precaución con fuego.'),
        color:L.color, bg:L.bg,
        priority:L.priority + 10,
        source:'Open-Meteo / FWI', distKm:0
    };
}

// ── FUNCIÓN PRINCIPAL: Analizar todos los datos y generar alertas ──
window.runAlertEngine = async function(lat, lon, cityName, radiusKm) {
    if (!lat || !lon) return [];
    var city = cityName || 'Tu zona';
    var alerts = [];
    console.log('🔍 Alert Engine analizando:', city, lat, lon);

    try {
        // Obtener datos meteorológicos de Open-Meteo
        var url = 'https://api.open-meteo.com/v1/forecast?' +
            'latitude='+lat+'&longitude='+lon +
            '&current=temperature_2m,relative_humidity_2m,apparent_temperature,' +
            'precipitation,rain,showers,snowfall,wind_speed_10m,wind_gusts_10m,' +
            'weather_code,surface_pressure,visibility,is_day' +
            '&timezone=auto&wind_speed_unit=kmh';

        var d = await (await fetch(url, {signal:AbortSignal.timeout(12000)})).json();

        if (d && d.current) {
            var c = d.current;

            // Analizar cada condición
            var wa = analyzeWind(c.wind_speed_10m, c.wind_gusts_10m, city);
            if (wa) alerts.push(wa);

            var ra = analyzeRain(c.rain||c.precipitation||0, c.snowfall||0, c.weather_code||0, city);
            if (ra && ra.length) alerts = alerts.concat(ra);

            var ta = analyzeTemp(c.temperature_2m, c.apparent_temperature, city);
            if (ta) alerts.push(ta);

            var va = analyzeVisibility(c.visibility, c.weather_code, city);
            if (va) alerts.push(va);

            var pa = analyzePressure(c.surface_pressure, city);
            if (pa) alerts.push(pa);

            var fr = analyzeFireRisk(c.temperature_2m, c.relative_humidity_2m, c.wind_speed_10m, city);
            if (fr) alerts.push(fr);
        }

        // Calidad del aire
        try {
            var aqUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?' +
                'latitude='+lat+'&longitude='+lon +
                '&current=us_aqi,pm10,pm2_5&timezone=auto';
            var aqD = await (await fetch(aqUrl, {signal:AbortSignal.timeout(8000)})).json();
            if (aqD && aqD.current) {
                var aa = analyzeAQI(aqD.current.us_aqi, aqD.current.pm2_5, aqD.current.pm10, city);
                if (aa) alerts.push(aa);
            }
        } catch(e) {}

        // Sismos cercanos (USGS) — analizar con motor
        try {
            var since = new Date(Date.now()-86400000).toISOString();
            var eqUrl = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                '&orderby=time&limit=50&minmagnitude=4.0&starttime='+since;
            var eqD = await (await fetch(eqUrl, {signal:AbortSignal.timeout(10000)})).json();
            (eqD.features||[]).forEach(function(f) {
                var p=f.properties, coords=f.geometry.coordinates;
                var dist = Math.round(
                    6371 * 2 * Math.atan2(
                        Math.sqrt(Math.pow(Math.sin((coords[1]-lat)*Math.PI/360),2) +
                        Math.cos(lat*Math.PI/180)*Math.cos(coords[1]*Math.PI/180)*
                        Math.pow(Math.sin((coords[0]-lon)*Math.PI/360),2)),
                        Math.sqrt(1-Math.pow(Math.sin((coords[1]-lat)*Math.PI/360),2) -
                        Math.cos(lat*Math.PI/180)*Math.cos(coords[1]*Math.PI/180)*
                        Math.pow(Math.sin((coords[0]-lon)*Math.PI/360),2))
                    )
                );
                if (dist <= (radiusKm||1000)) {
                    var ea = analyzeEarthquake(p.mag, p.place, coords[2], dist);
                    if (ea) {
                        ea.lat = coords[1];
                        ea.lon = coords[0];
                        ea.time = new Date(p.time).toLocaleString('es-CL');
                        ea.link = p.url;
                        alerts.push(ea);
                    }
                }
            });
        } catch(e) {}

    } catch(e) {
        console.error('Alert Engine error:', e);
    }

    // Ordenar: más peligrosas primero
    alerts.sort(function(a,b){ return (b.priority||0)-(a.priority||0); });

    // Deduplicar por tipo (máximo 2 del mismo tipo)
    var typeCounts = {};
    alerts = alerts.filter(function(a) {
        typeCounts[a.type] = (typeCounts[a.type]||0) + 1;
        return typeCounts[a.type] <= 2;
    });

    console.log('✅ Alert Engine generó', alerts.length, 'alertas para', city);
    return alerts;
};

// Exponer funciones individuales para uso externo
window.AlertEngine = {
    analyzeWind, analyzeRain, analyzeTemp,
    analyzeVisibility, analyzePressure,
    analyzeAQI, analyzeEarthquake, analyzeFireRisk,
    LEVELS
};
