// ============================================================
// weather-openmeteo.js — Pestaña de Clima sin API key
// ✅ Reemplaza OpenWeatherMap por Open-Meteo (gratis, sin key)
// ✅ Mismos datos: temperatura, humedad, viento, presión, AQI
// ✅ AGREGA: UV index, punto de rocío, visibilidad, pronóstico 7 días
// ✅ Compatible con el HTML existente de la pestaña Clima
//
// INSTRUCCIONES DE USO:
// 1. Elimina las referencias a CONFIG.WEATHER_API_KEY en app.js
// 2. Incluye este script ANTES de app.js en index.html:
//    <script src="js/weather-openmeteo.js"></script>
// 3. En app.js, reemplaza la función loadWeather() con la de abajo
// ============================================================

// Códigos WMO → descripción en español + icono
var WMO_WEATHER = {
    0:  {desc:'Cielo despejado',       icon:'☀️'},
    1:  {desc:'Principalmente despejado',icon:'🌤️'},
    2:  {desc:'Parcialmente nublado',   icon:'⛅'},
    3:  {desc:'Nublado',               icon:'☁️'},
    45: {desc:'Niebla',                icon:'🌫️'},
    48: {desc:'Niebla con escarcha',   icon:'🌫️'},
    51: {desc:'Llovizna leve',         icon:'🌦️'},
    53: {desc:'Llovizna moderada',     icon:'🌦️'},
    55: {desc:'Llovizna intensa',      icon:'🌧️'},
    61: {desc:'Lluvia leve',           icon:'🌧️'},
    63: {desc:'Lluvia moderada',       icon:'🌧️'},
    65: {desc:'Lluvia intensa',        icon:'🌧️'},
    71: {desc:'Nevada leve',           icon:'❄️'},
    73: {desc:'Nevada moderada',       icon:'❄️'},
    75: {desc:'Nevada intensa',        icon:'❄️'},
    77: {desc:'Granos de nieve',       icon:'🌨️'},
    80: {desc:'Chubascos leves',       icon:'🌦️'},
    81: {desc:'Chubascos moderados',   icon:'🌦️'},
    82: {desc:'Chubascos fuertes',     icon:'⛈️'},
    85: {desc:'Chubascos de nieve',    icon:'❄️'},
    86: {desc:'Chubascos de nieve intensos',icon:'❄️'},
    95: {desc:'Tormenta eléctrica',    icon:'⛈️'},
    96: {desc:'Tormenta con granizo',  icon:'⛈️'},
    99: {desc:'Tormenta con granizo intenso',icon:'⛈️'},
};

function getWMODesc(code) {
    return WMO_WEATHER[code] || {desc:'Condición especial', icon:'🌡️'};
}

// AQI EPA → etiqueta + color
function getAQIInfo(aqi) {
    if (!aqi) return {label:'Sin datos', color:'#888', emoji:'❓'};
    if (aqi<=50)  return {label:'Bueno',         color:'#00e400', emoji:'😊'};
    if (aqi<=100) return {label:'Moderado',       color:'#ffff00', emoji:'😐'};
    if (aqi<=150) return {label:'Poco saludable', color:'#ff7e00', emoji:'😮'};
    if (aqi<=200) return {label:'Insalubre',      color:'#ff0000', emoji:'😷'};
    if (aqi<=300) return {label:'Muy insalubre',  color:'#8f3f97', emoji:'😷'};
    return              {label:'Peligroso',       color:'#7e0023', emoji:'☠️'};
}

// Dirección del viento en texto
function windDirection(deg) {
    if (deg==null) return '';
    var dirs = ['N','NE','E','SE','S','SO','O','NO'];
    return dirs[Math.round(deg/45) % 8];
}

// ============================================================
// loadWeatherOpenMeteo — reemplaza loadWeather() en app.js
// ============================================================
async function loadWeatherOpenMeteo(lat, lon, cityLabel) {
    var container = document.getElementById('weatherContainer');
    var loading   = document.getElementById('weatherLoading');
    var errEl     = document.getElementById('weatherError');

    if (loading)   loading.style.display='flex';
    if (container) container.style.display='none';
    if (errEl)     errEl.style.display='none';

    try {
        // Llamadas paralelas: clima actual + calidad del aire + geocodificación inversa
        var weatherUrl =
            'https://api.open-meteo.com/v1/forecast?' +
            'latitude='+lat+'&longitude='+lon +
            '&current=temperature_2m,relative_humidity_2m,apparent_temperature,' +
            'precipitation,rain,snowfall,wind_speed_10m,wind_gusts_10m,wind_direction_10m,' +
            'weather_code,surface_pressure,pressure_msl,visibility,is_day,uv_index,' +
            'cloud_cover,dew_point_2m' +
            '&hourly=temperature_2m,precipitation_probability,weather_code' +
            '&daily=weather_code,temperature_2m_max,temperature_2m_min,' +
            'precipitation_sum,wind_speed_10m_max,sunrise,sunset,uv_index_max' +
            '&timezone=auto&forecast_days=7&wind_speed_unit=kmh';

        var aqiUrl =
            'https://air-quality-api.open-meteo.com/v1/air-quality?' +
            'latitude='+lat+'&longitude='+lon +
            '&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone&timezone=auto';

        var [dRes, aqiRes] = await Promise.all([
            fetch(weatherUrl,{signal:AbortSignal.timeout(12000)}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
            fetch(aqiUrl,{signal:AbortSignal.timeout(8000)}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
        ]);

        if (!dRes || !dRes.current) throw new Error('No se obtuvieron datos meteorológicos');

        var c = dRes.current;
        var wmo = getWMODesc(c.weather_code||0);
        var pressure = c.pressure_msl!=null ? c.pressure_msl : (c.surface_pressure||1013);
        var vis = c.visibility != null ? (c.visibility/1000).toFixed(1)+' km' : '—';
        var uvi = c.uv_index!=null ? c.uv_index.toFixed(0) : '0';
        var dew = c.dew_point_2m!=null ? Math.round(c.dew_point_2m)+'°C' : '—';
        var clouds = c.cloud_cover!=null ? c.cloud_cover+'%' : '—';
        var windDir = windDirection(c.wind_direction_10m);

        // AQI
        var aqi = aqiRes&&aqiRes.current ? aqiRes.current.us_aqi : null;
        var aqiInfo = getAQIInfo(aqi);

        // Ciudad
        var city = cityLabel || (lat.toFixed(3)+','+lon.toFixed(3));

        // ── Construir HTML del clima actual ──
        var currentHTML =
            '<div class="weather-city">'+wmo.icon+' '+city+'</div>' +
            '<div class="weather-temp">'+Math.round(c.temperature_2m||0)+'°C</div>' +
            '<div class="weather-desc">'+wmo.desc+
            (c.apparent_temperature!=null?' · Sensación '+Math.round(c.apparent_temperature)+'°C':'')+
            '</div>' +
            '<div class="weather-details">' +
                '<div class="weather-detail"><span class="detail-icon">💧</span><span class="detail-label">Humedad</span><span class="detail-value" id="wHumidity">'+(c.relative_humidity_2m||0)+'%</span></div>' +
                '<div class="weather-detail"><span class="detail-icon">💨</span><span class="detail-label">Viento</span><span class="detail-value" id="wWind">'+Math.round(c.wind_speed_10m||0)+' km/h '+windDir+(c.wind_gusts_10m?' (ráf. '+Math.round(c.wind_gusts_10m)+')':'')+' </span></div>' +
                '<div class="weather-detail"><span class="detail-icon">🌡️</span><span class="detail-label">Sensación</span><span class="detail-value" id="wFeels">'+(c.apparent_temperature!=null?Math.round(c.apparent_temperature)+'°C':'—')+'</span></div>' +
                '<div class="weather-detail"><span class="detail-icon">📊</span><span class="detail-label">Presión</span><span class="detail-value" id="wPressure">'+Math.round(pressure)+' hPa</span></div>' +
                '<div class="weather-detail"><span class="detail-icon">☁️</span><span class="detail-label">Nubosidad</span><span class="detail-value" id="wClouds">'+clouds+'</span></div>' +
                '<div class="weather-detail"><span class="detail-icon">😷</span><span class="detail-label">AQI</span><span class="detail-value" id="wAQI" style="color:'+aqiInfo.color+'">'+aqiInfo.emoji+' '+(aqi!=null?aqi+' — '+aqiInfo.label:'Sin datos')+'</span></div>' +
                '<div class="weather-detail"><span class="detail-icon">👁️</span><span class="detail-label">Visibilidad</span><span class="detail-value" id="wVisibility">'+vis+'</span></div>' +
                '<div class="weather-detail"><span class="detail-icon">☀️</span><span class="detail-label">UV Index</span><span class="detail-value">'+uvi+(parseFloat(uvi)>=8?' ⚠️':'')+'</span></div>' +
                '<div class="weather-detail"><span class="detail-icon">💧</span><span class="detail-label">Pto. Rocío</span><span class="detail-value">'+dew+'</span></div>' +
                (dRes.current.is_day&&dRes.daily&&dRes.daily.sunrise?
                '<div class="weather-detail"><span class="detail-icon">🌅</span><span class="detail-label">Amanecer</span><span class="detail-value">'+new Date(dRes.daily.sunrise[0]).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})+'</span></div>':'')+
                (dRes.current.is_day&&dRes.daily&&dRes.daily.sunset?
                '<div class="weather-detail"><span class="detail-icon">🌇</span><span class="detail-label">Atardecer</span><span class="detail-value">'+new Date(dRes.daily.sunset[0]).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})+'</span></div>':'') +
            '</div>';

        // ── Pronóstico 7 días ──
        var forecastHTML = '';
        if (dRes.daily && dRes.daily.weather_code) {
            forecastHTML += '<div style="margin-top:16px;border-top:1px solid #333;padding-top:12px;">';
            forecastHTML += '<div style="color:#aaa;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📅 Pronóstico 7 Días</div>';
            forecastHTML += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;overflow-x:auto;">';
            var days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
            for (var i=0; i<Math.min(7,dRes.daily.weather_code.length); i++) {
                var dayDate = new Date(dRes.daily.time[i]+'T12:00');
                var dayName = i===0 ? 'Hoy' : i===1 ? 'Mañ.' : days[dayDate.getDay()];
                var dayWmo  = getWMODesc(dRes.daily.weather_code[i]);
                var maxT    = dRes.daily.temperature_2m_max[i]!=null ? Math.round(dRes.daily.temperature_2m_max[i]) : '—';
                var minT    = dRes.daily.temperature_2m_min[i]!=null ? Math.round(dRes.daily.temperature_2m_min[i]) : '—';
                var precip  = dRes.daily.precipitation_sum[i]!=null ? dRes.daily.precipitation_sum[i].toFixed(0) : '0';
                var windMax = dRes.daily.wind_speed_10m_max[i]!=null ? Math.round(dRes.daily.wind_speed_10m_max[i]) : '—';
                forecastHTML +=
                    '<div style="background:#111;border:1px solid #222;border-radius:8px;padding:6px 2px;font-size:11px;">' +
                        '<div style="color:#aaa;font-size:10px;">'+dayName+'</div>' +
                        '<div style="font-size:18px;margin:2px 0;">'+dayWmo.icon+'</div>' +
                        '<div style="color:#fff;font-weight:bold;">'+maxT+'°</div>' +
                        '<div style="color:#888;">'+minT+'°</div>' +
                        (parseFloat(precip)>0?'<div style="color:#4169E1;font-size:10px;">'+precip+'mm</div>':'') +
                        '<div style="color:#999;font-size:10px;">'+windMax+' km/h</div>' +
                    '</div>';
            }
            forecastHTML += '</div></div>';
        }

        // ── Pronóstico por hora (próximas 24h) ──
        var hourlyHTML = '';
        if (dRes.hourly && dRes.hourly.temperature_2m) {
            hourlyHTML += '<div style="margin-top:12px;border-top:1px solid #333;padding-top:12px;">';
            hourlyHTML += '<div style="color:#aaa;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🕐 Próximas 24 horas</div>';
            hourlyHTML += '<div style="display:flex;overflow-x:auto;gap:8px;padding-bottom:8px;">';
            var now = new Date();
            var currentHour = now.getHours();
            var shown = 0;
            for (var i=0; i<dRes.hourly.time.length && shown<24; i++) {
                var hTime = new Date(dRes.hourly.time[i]);
                if (hTime < now) continue;
                var hTemp = dRes.hourly.temperature_2m[i];
                var hCode = dRes.hourly.weather_code[i];
                var hProb = dRes.hourly.precipitation_probability ? dRes.hourly.precipitation_probability[i] : null;
                var hWmo  = getWMODesc(hCode);
                hourlyHTML +=
                    '<div style="min-width:50px;text-align:center;background:#111;border:1px solid #222;border-radius:8px;padding:6px 4px;font-size:11px;">' +
                        '<div style="color:#aaa;">'+hTime.getHours().toString().padStart(2,'0')+':00</div>' +
                        '<div style="font-size:16px;">'+hWmo.icon+'</div>' +
                        '<div style="color:#fff;font-weight:bold;">'+(hTemp!=null?Math.round(hTemp)+'°':'—')+'</div>' +
                        (hProb!=null&&hProb>20?'<div style="color:#4169E1;font-size:10px;">'+hProb+'%</div>':'') +
                    '</div>';
                shown++;
            }
            hourlyHTML += '</div></div>';
        }

        // ── Recomendación inteligente ──
        var recommendation = '';
        var temp=c.temperature_2m||0, ws=c.wind_speed_10m||0;
        var rec = [];
        if (temp>=38)     rec.push('🔥 Calor extremo — hidratarse constantemente y evitar exposición solar');
        if (temp<=0)      rec.push('🧊 Temperatura bajo cero — superficies heladas. Abrigarse bien');
        if (ws>=62)       rec.push('💨 Viento fuerte — precaución al conducir. Asegurar objetos sueltos');
        if ((c.weather_code||0)>=95) rec.push('⛈️ Tormenta activa — buscar refugio interior, alejarse de árboles');
        if (aqi!=null&&aqi>150) rec.push('😷 Aire insalubre — usar mascarilla y reducir tiempo al exterior');
        if (parseFloat(uvi)>=8)  rec.push('☀️ UV muy alto — protector solar 30+, gafas y sombrero');
        if (c.rain>5||c.precipitation>5) rec.push('🌧️ Lluvia intensa — llevar paraguas o impermeable');
        if (rec.length===0)  rec.push('✅ Condiciones normales — tiempo aceptable para actividades al aire libre');
        recommendation = '<div class="weather-recommendation" id="wRecommendation" style="background:#1a1a2e;border:1px solid #333;border-radius:8px;padding:12px;margin-top:12px;font-size:13px;line-height:1.7;">'+rec.join('<br>')+'</div>';

        // ── Inyectar en el DOM ──
        if (container) {
            container.innerHTML = currentHTML + recommendation + hourlyHTML + forecastHTML;
            container.style.display = 'block';
        } else {
            // Compatibilidad con el HTML original que usa IDs individuales
            var el = function(id){return document.getElementById(id);};
            if (el('wCity'))     el('wCity').textContent = wmo.icon+' '+city;
            if (el('wTemp'))     el('wTemp').textContent = Math.round(c.temperature_2m||0)+'°C';
            if (el('wDesc'))     el('wDesc').textContent = wmo.desc;
            if (el('wHumidity')) el('wHumidity').textContent = (c.relative_humidity_2m||0)+'%';
            if (el('wWind'))     el('wWind').textContent = Math.round(c.wind_speed_10m||0)+' km/h '+windDir;
            if (el('wFeels'))    el('wFeels').textContent = c.apparent_temperature!=null?Math.round(c.apparent_temperature)+'°C':'—';
            if (el('wPressure')) el('wPressure').textContent = Math.round(pressure)+' hPa';
            if (el('wClouds'))   el('wClouds').textContent = clouds;
            if (el('wAQI'))      el('wAQI').textContent = aqi!=null?aqi+' — '+aqiInfo.label:'Sin datos';
            if (el('wVisibility'))el('wVisibility').textContent = vis;
            if (el('wRecommendation')) el('wRecommendation').textContent = rec[0]||'';
            if (container) container.style.display='block';
        }

        if (loading) loading.style.display='none';

    } catch(e) {
        console.error('Weather Open-Meteo:', e);
        if (loading) loading.style.display='none';
        if (errEl) {
            errEl.textContent = '❌ No se pudieron obtener datos del clima. '+e.message;
            errEl.style.display='block';
        }
    }
};

// ── Exportar globalmente ──
window.loadWeatherOpenMeteo = loadWeatherOpenMeteo;
