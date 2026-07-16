const CONFIG = {
    USGS_URL: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=30&minmagnitude=4.0&orderby=time',
    WEATHER_API_KEY: 'TU_API_KEY',
    WEATHER_URL: 'https://api.openweathermap.org/data/2.5/weather',
    REFRESH_INTERVAL: 5 * 60 * 1000
};
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-' + target).classList.add('active');
        if (target === 'mapa') {
            const frame = document.getElementById('mapFrame');
            if (!frame.src || frame.src === '' || frame.src === window.location.href) frame.src = 'https://earthquake.usgs.gov/earthquakes/map/';
        }
    });
});
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}
function formatTime(timestamp) {
    const diff = Date.now() - timestamp;
    if (diff < 3600000) return 'Hace ' + Math.floor(diff / 60000) + ' min';
    if (diff < 86400000) return 'Hace ' + Math.floor(diff / 3600000) + 'h';
    return new Date(timestamp).toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
async function loadAlerts() {
    const loading = document.getElementById('alertsLoading');
    const list = document.getElementById('alertList');
    const error = document.getElementById('alertsError');
    loading.style.display = 'flex'; list.innerHTML = ''; error.style.display = 'none';
    try {
        const res = await fetch(CONFIG.USGS_URL);
        const data = await res.json();
        loading.style.display = 'none';
        if (!data.features || data.features.length === 0) { list.innerHTML = '<div class="loading"><p>No hay alertas recientes</p></div>'; return; }
        data.features.forEach(f => {
            const mag = f.properties.mag, place = f.properties.place || 'Desconocida', time = f.properties.time;
            const coords = f.geometry.coordinates, depth = coords[2].toFixed(1);
            let severity, sevClass, sevColor;
            if (mag >= 7.0) { severity='CRÍTICO'; sevClass='critical'; sevColor='severity-critical'; }
            else if (mag >= 5.0) { severity='ALTO'; sevClass='high'; sevColor='severity-high'; }
            else { severity='MEDIO'; sevClass='medium'; sevColor='severity-medium'; }
            const card = document.createElement('div');
            card.className = 'alert-card ' + sevClass;
            card.innerHTML = '<div class="alert-header"><span class="alert-type">SISMO</span><span class="alert-severity '+sevColor+'">'+severity+'</span></div><div class="alert-title">'+place+'</div><div class="alert-location">📍 '+coords[1].toFixed(2)+', '+coords[0].toFixed(2)+' · Prof: '+depth+' km</div><div class="alert-magnitude">Magnitud: '+mag.toFixed(1)+'</div><div class="alert-footer"><span>'+formatTime(time)+'</span><span>Fuente: USGS</span></div>';
            list.appendChild(card);
        });
    } catch (e) { loading.style.display='none'; error.style.display='block'; error.textContent='⚠️ Error: '+e.message; }
}
async function loadWeather() {
    const loading = document.getElementById('weatherLoading');
    const container = document.getElementById('weatherContainer');
    const error = document.getElementById('weatherError');
    loading.style.display = 'flex'; container.style.display = 'none'; error.style.display = 'none';
    try {
        const pos = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) { reject(new Error('Geolocalización no disponible')); return; }
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy:true, timeout:10000 });
        });
        if (CONFIG.WEATHER_API_KEY === 'TU_API_KEY') {
            loading.style.display='none'; container.style.display='block';
            document.getElementById('wCity').textContent='Tu Ciudad';
            document.getElementById('wTemp').textContent='22°C';
            document.getElementById('wDesc').textContent='Datos de demostración';
            document.getElementById('wHumidity').textContent='55%';
            document.getElementById('wWind').textContent='3.5 m/s';
            document.getElementById('wFeels').textContent='20°C';
            document.getElementById('wPressure').textContent='1013 hPa';
            document.getElementById('wRecommendation').textContent='⚙️ Configura tu API Key de OpenWeatherMap en js/app.js para ver datos reales.';
            return;
        }
        const url = CONFIG.WEATHER_URL+'?lat='+pos.coords.latitude+'&lon='+pos.coords.longitude+'&appid='+CONFIG.WEATHER_API_KEY+'&units=metric&lang=es';
        const res = await fetch(url);
        const data = await res.json();
        loading.style.display='none'; container.style.display='block';
        document.getElementById('wCity').textContent=data.name;
        document.getElementById('wTemp').textContent=Math.round(data.main.temp)+'°C';
        document.getElementById('wDesc').textContent=data.weather[0].description;
        document.getElementById('wHumidity').textContent=data.main.humidity+'%';
        document.getElementById('wWind').textContent=data.wind.speed+' m/s';
        document.getElementById('wFeels').textContent=Math.round(data.main.feels_like)+'°C';
        document.getElementById('wPressure').textContent=data.main.pressure+' hPa';
        const t=data.main.temp; let rec;
        if(t>35)rec='🔥 ¡Extremadamente caluroso! Evita salir entre 11:00 y 16:00. Protector solar SPF 50+.';
        else if(t>30)rec='☀️ Muy caluroso. Mantente hidratado y busca sombra.';
        else if(t>25)rec='🌤️ Caluroso. Usa protector solar y gafas.';
        else if(t>15)rec='🌈 Condiciones agradables. Disfruta tu día.';
        else if(t>10)rec='🍂 Fresco. Lleva chaqueta ligera.';
        else if(t>0)rec='❄️ Frío. Abrígate bien.';
        else rec='🥶 ¡Congelante! Riesgo de hipotermia.';
        document.getElementById('wRecommendation').textContent=rec;
    } catch(e) { loading.style.display='none'; error.style.display='block'; error.textContent=e.code===1?'📍 Permite acceso a ubicación':'⚠️ Error: '+e.message; }
}
function loadTips() {
    const tips = [
        {title:'☀️ Radiación UV Alta',desc:'Usa protector solar SPF 30+, gafas de sol y sombrero. Evita el sol entre 10:00 y 16:00.',cat:'PREVENCIÓN',color:'#FF9800'},
        {title:'🌊 Alerta de Tsunami',desc:'Si sientes un sismo fuerte cerca de la costa, dirígete a zonas altas. Sigue instrucciones oficiales.',cat:'EMERGENCIA',color:'#F44336'},
        {title:'🔥 Incendio Forestal',desc:'Si estás en zona de evacuación, sigue las rutas designadas. Cubre boca y nariz con paño húmedo.',cat:'EMERGENCIA',color:'#F44336'},
        {title:'🌪️ Tormenta Severa',desc:'Refúgiate en interior. Evita ventanas. Desconecta aparatos eléctricos.',cat:'PRECAUCIÓN',color:'#FFEB3B'},
        {title:'🌧️ Lluvias Intensas',desc:'Evita cruzar zonas inundadas. No conduzcas por calles con agua acumulada.',cat:'PRECAUCIÓN',color:'#2196F3'},
        {title:'❄️ Ola de Frío',desc:'Abrígate en capas. Consume alimentos calientes. Revisa a personas mayores y niños.',cat:'PREVENCIÓN',color:'#03A9F4'},
        {title:'🌋 Erupción Volcánica',desc:'Usa mascarilla N95. Mantén puertas y ventanas cerradas si hay ceniza.',cat:'EMERGENCIA',color:'#F44336'},
        {title:'🏜️ Sequía',desc:'Raciona el agua. Reporta fugas. Sigue restricciones municipales.',cat:'PREVENCIÓN',color:'#795548'}
    ];
    const list = document.getElementById('tipsList'); list.innerHTML = '';
    tips.forEach(tip => {
        const card = document.createElement('div');
        card.className = 'tip-card';
        card.style.borderLeft = '4px solid '+tip.color;
        card.innerHTML = '<span class="tip-category" style="color:'+tip.color+';background:'+tip.color+'18">'+tip.cat+'</span><div class="tip-title">'+tip.title+'</div><div class="tip-desc">'+tip.desc+'</div>';
        list.appendChild(card);
    });
}
document.getElementById('btnRefresh').addEventListener('click', () => { loadAlerts(); loadWeather(); showToast('✅ Datos actualizados'); });
document.addEventListener('DOMContentLoaded', () => { loadAlerts(); loadWeather(); loadTips(); setInterval(loadAlerts, CONFIG.REFRESH_INTERVAL); });
