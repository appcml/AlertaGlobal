// ============================================
// js/app.js — Alerta Global v3 — Tiempo Real
// ============================================
var CONFIG = {
    USGS_URL: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=50&minmagnitude=3.5&orderby=time',
    WEATHER_API_KEY: '6fe6e0dcca264864dbd631bf620aad64',
    WEATHER_URL: 'https://api.openweathermap.org/data/2.5/weather',
    FORECAST_URL: 'https://api.openweathermap.org/data/2.5/forecast',
    ALERTS_INTERVAL: 120000,   // 2 min
    WEATHER_INTERVAL: 600000,  // 10 min
    SEARCH_DELAY: 350
};

var currentLocation = { lat: null, lon: null, name: '', country: '' };
var leafletMap = null, mapInitialized = false, userMarker = null;
var lastWeatherData = null, lastForecastData = null, lastEarthquakes = [];
var seenAlertIds = {}, notifPermission = false;
var searchTimer = null;

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function() {
    setLanguage(currentLang);
    setupTabs();
    setupLocationButtons();
    setupLanguageSelector();
    setupSearch();
    requestNotificationPermission();
    initLocation();
    setInterval(function() { loadAlerts(); }, CONFIG.ALERTS_INTERVAL);
    setInterval(function() { if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon); }, CONFIG.WEATHER_INTERVAL);
});

// ========== NOTIFICATIONS ==========
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(function(p) { notifPermission = p === 'granted'; });
    }
}

function sendNotification(title, body, urgency) {
    // Browser notification
    if (notifPermission && 'Notification' in window) {
        try { new Notification(title, { body: body, icon: 'img/icon.svg' }); } catch(e) {}
    }
    // In-app banner
    showAlertBanner(title, body, urgency);
}

function showAlertBanner(title, body, urgency) {
    var existing = document.getElementById('alertBanner');
    if (existing) existing.remove();
    var color = urgency === 'critical' ? '#F44336' : urgency === 'high' ? '#FF5722' : urgency === 'medium' ? '#FF9800' : '#2196F3';
    var banner = document.createElement('div');
    banner.id = 'alertBanner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:' + color + ';color:#fff;padding:12px 16px;z-index:500;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 8px rgba(0,0,0,0.3);animation:slideDown 0.3s ease;';
    banner.innerHTML = '<div style="flex:1"><div style="font-weight:700;font-size:14px">' + title + '</div><div style="font-size:12px;opacity:0.9">' + body + '</div></div><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:0 0 0 12px">✕</button>';
    document.body.appendChild(banner);
    setTimeout(function() { if (banner.parentNode) banner.remove(); }, 8000);
}

// ========== TABS ==========
function setupTabs() {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
            document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
            this.classList.add('active');
            document.getElementById('panel-' + this.dataset.tab).classList.add('active');
            if (this.dataset.tab === 'mapa' && !mapInitialized) initMap();
        });
    }
}

// ========== GEOLOCATION ==========
function initLocation() {
    var saved = LocationManager.getCurrent();
    if (saved && saved.lat) {
        currentLocation = saved;
        updateLocationDisplay(saved.name);
        loadAlerts(); loadWeather(saved.lat, saved.lon); renderSavedLocations();
        return;
    }
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(pos) {
            var lat = pos.coords.latitude, lon = pos.coords.longitude;
            LocationManager.reverseGeocode(lat, lon).then(function(geo) {
                currentLocation = { lat: lat, lon: lon, name: geo.city, country: geo.country };
                LocationManager.setCurrent(currentLocation);
                updateLocationDisplay(currentLocation.name);
                loadWeather(lat, lon); loadAlerts(); renderSavedLocations();
            });
        }, function() {
            updateLocationDisplay(t('allow_location')); loadAlerts(); renderSavedLocations();
        }, { enableHighAccuracy: true, timeout: 10000 });
    } else {
        updateLocationDisplay(t('allow_location')); loadAlerts(); renderSavedLocations();
    }
}

function updateLocationDisplay(name) {
    var e1 = document.getElementById('currentLocationName'), e2 = document.getElementById('weatherLocationName');
    if (e1) e1.textContent = name || 'Global';
    if (e2) e2.textContent = name || t('allow_location');
}

function selectLocation(loc) {
    currentLocation = loc; LocationManager.setCurrent(loc);
    updateLocationDisplay(loc.name); loadWeather(loc.lat, loc.lon); loadAlerts();
    if (leafletMap) {
        leafletMap.setView([loc.lat, loc.lon], 8);
        if (userMarker) { userMarker.setLatLng([loc.lat, loc.lon]); }
        else { userMarker = L.marker([loc.lat, loc.lon], { icon: L.divIcon({ html: '<div style="background:#6200EE;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>', iconSize: [16,16], iconAnchor: [8,8] }) }).addTo(leafletMap).bindPopup('📍 ' + loc.name).openPopup(); }
    }
    closePopups(); showToast('📍 ' + loc.name);
}

// ========== DISTANCE ==========
function calcDistance(lat1, lon1, lat2, lon2) {
    var R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
    var a = Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// ========== SAVED LOCATIONS ==========
function renderSavedLocations() {
    var locs = LocationManager.getAll();
    ['savedLocations','weatherSavedLocations'].forEach(function(id) {
        var c = document.getElementById(id); if (!c) return;
        if (!locs.length) { c.innerHTML = ''; return; }
        c.innerHTML = locs.map(function(l) {
            var sn = l.name.replace(/'/g,"\\'"), sc = (l.country||'').replace(/'/g,"\\'");
            return '<div class="saved-loc"><button class="saved-loc-btn" onclick="selectLocation({name:\''+sn+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+sc+'\'})">📍 '+l.name+'</button><button class="saved-loc-remove" onclick="removeSavedLocation(\''+sn+'\')">✕</button></div>';
        }).join('');
    });
}
function removeSavedLocation(name) { LocationManager.remove(name); renderSavedLocations(); showToast(t('location_removed')); }

// ========== BUTTONS ==========
function setupLocationButtons() {
    var geoLocate = function(callback) {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(function(pos) {
            LocationManager.reverseGeocode(pos.coords.latitude, pos.coords.longitude).then(function(geo) {
                callback({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: geo.city, country: geo.country });
            });
        });
    };
    document.getElementById('btnMyLocation').addEventListener('click', function() { geoLocate(selectLocation); });
    document.getElementById('btnSearchLocation').addEventListener('click', openSearch);
    document.getElementById('btnWeatherLocation').addEventListener('click', function() { geoLocate(selectLocation); });
    document.getElementById('btnWeatherSearch').addEventListener('click', openSearch);
    document.getElementById('btnSaveLocation').addEventListener('click', function() {
        if (currentLocation.lat) { var ok = LocationManager.save(currentLocation); renderSavedLocations(); showToast(ok ? t('location_saved')+': '+currentLocation.name : '⭐ '+currentLocation.name); }
    });
    document.getElementById('btnRefresh').addEventListener('click', function() {
        loadAlerts(); if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon);
        showToast('✅ '+t('updated'));
    });
}

// ========== SEARCH WITH AUTOCOMPLETE ==========
function setupSearch() {
    document.getElementById('closeSearch').addEventListener('click', closePopups);
    document.getElementById('searchBtn').addEventListener('click', doSearch);
    var input = document.getElementById('searchInput');
    // Autocomplete while typing
    input.addEventListener('input', function() {
        clearTimeout(searchTimer);
        var q = this.value.trim();
        if (q.length < 2) { document.getElementById('searchResults').innerHTML = ''; return; }
        searchTimer = setTimeout(function() { doSearch(); }, CONFIG.SEARCH_DELAY);
    });
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') { clearTimeout(searchTimer); doSearch(); } });
}
function openSearch() {
    document.getElementById('searchPopup').style.display = 'flex';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
    setTimeout(function() { document.getElementById('searchInput').focus(); }, 150);
}
function doSearch() {
    var q = document.getElementById('searchInput').value.trim();
    if (q.length < 2) return;
    var results = document.getElementById('searchResults');
    results.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    LocationManager.search(q).then(function(locs) {
        if (!locs.length) { results.innerHTML = '<p style="text-align:center;color:#999;padding:16px">Sin resultados</p>'; return; }
        results.innerHTML = locs.map(function(l) {
            return '<button class="search-result" onclick="selectLocation({name:\''+l.name.replace(/'/g,"\\'")+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+l.country.replace(/'/g,"\\'")+'\'})">'
                + '<strong>'+l.name+'</strong><br><small>'+l.fullName+'</small></button>';
        }).join('');
    }).catch(function(e) { results.innerHTML = '<p style="color:red;padding:16px">Error: '+e.message+'</p>'; });
}
function closePopups() { document.getElementById('searchPopup').style.display='none'; document.getElementById('langPopup').style.display='none'; }

// ========== LANGUAGE ==========
function setupLanguageSelector() {
    document.getElementById('btnLang').addEventListener('click', function() { document.getElementById('langPopup').style.display='flex'; });
    document.getElementById('closeLang').addEventListener('click', closePopups);
    document.querySelectorAll('.lang-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            setLanguage(this.dataset.lang); closePopups(); refreshSmartTips();
            if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon);
            showToast('🌐 '+this.textContent.trim());
        });
    });
}

// ========== UTILS ==========
function showToast(msg) { var el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(function(){el.classList.remove('show');},2500); }
function formatTime(ts) { var d=Date.now()-ts; if(d<3600000) return t('ago_min').replace('{n}',Math.floor(d/60000)); if(d<86400000) return t('ago_hr').replace('{n}',Math.floor(d/3600000)); return new Date(ts).toLocaleString(currentLang,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }

function getRiskLevel(mag) {
    if (mag >= 8) return { label: '⚫ EXTREMO', color: '#000', bg: '#000' };
    if (mag >= 7) return { label: '🔴 CRÍTICO', color: '#F44336', bg: '#F44336' };
    if (mag >= 5) return { label: '🟠 ALTO', color: '#FF5722', bg: '#FF5722' };
    if (mag >= 4) return { label: '🟡 MEDIO', color: '#FF9800', bg: '#FF9800' };
    return { label: '🟢 BAJO', color: '#4CAF50', bg: '#4CAF50' };
}

function getWeatherRisk(data) {
    var main = data.weather[0].main.toLowerCase();
    if (main === 'thunderstorm') return { label: '🔴 EMERGENCIA', color: '#F44336' };
    if (main === 'tornado') return { label: '⚫ EXTREMO', color: '#000' };
    if (data.main.temp > 40 || data.main.temp < -10) return { label: '🔴 CRÍTICO', color: '#F44336' };
    if (main === 'snow' || main === 'rain' || data.wind.speed > 15) return { label: '🟠 ALTO', color: '#FF5722' };
    if (main === 'drizzle' || data.wind.speed > 10) return { label: '🟡 PRECAUCIÓN', color: '#FF9800' };
    return { label: '🟢 NORMAL', color: '#4CAF50' };
}

// ========== ALERTS ==========
function loadAlerts() {
    var loading = document.getElementById('alertsLoading');
    var list = document.getElementById('alertList');
    var error = document.getElementById('alertsError');
    loading.style.display = 'flex'; list.innerHTML = ''; error.style.display = 'none';

    var url = CONFIG.USGS_URL;
    if (currentLocation.lat && currentLocation.lon) {
        url += '&latitude='+currentLocation.lat+'&longitude='+currentLocation.lon+'&maxradiuskm=3000';
    }

    fetch(url).then(function(res){ return res.json(); }).then(function(data) {
        loading.style.display = 'none';
        lastEarthquakes = data.features || [];

        if (!lastEarthquakes.length) {
            list.innerHTML = '<div class="loading"><p>'+t('no_alerts')+'</p></div>';
            refreshSmartTips(); return;
        }

        // Check for new critical events and notify
        var now = Date.now();
        lastEarthquakes.forEach(function(f) {
            var id = f.id, mag = f.properties.mag, time = f.properties.time;
            var isNew = !seenAlertIds[id] && (now - time) < 1800000; // last 30 min
            if (isNew && mag >= 5.5) {
                seenAlertIds[id] = true;
                var place = f.properties.place;
                var urgency = mag >= 7 ? 'critical' : mag >= 6 ? 'high' : 'medium';
                sendNotification('🚨 SISMO M'+mag.toFixed(1), place, urgency);
            } else { seenAlertIds[id] = true; }
        });

        lastEarthquakes.forEach(function(f) {
            var mag = f.properties.mag;
            var place = f.properties.place || '?';
            var time = f.properties.time;
            var coords = f.geometry.coordinates;
            var depth = coords[2].toFixed(1);
            var risk = getRiskLevel(mag);

            var distHtml = '';
            if (currentLocation.lat) {
                var dist = calcDistance(currentLocation.lat, currentLocation.lon, coords[1], coords[0]);
                distHtml = '<span class="alert-dist">📏 '+dist+' km</span>';
            }

            var tsunamiRisk = '';
            if (mag >= 7 && depth < 70 && (place.toLowerCase().indexOf('coast') >= 0 || place.toLowerCase().indexOf('ocean') >= 0 || place.toLowerCase().indexOf('sea') >= 0)) {
                tsunamiRisk = '<div class="tsunami-warning">🌊 Posible riesgo de tsunami — Aléjate de la costa</div>';
            }

            var isRecent = (Date.now() - time) < 3600000;
            var card = document.createElement('div');
            card.className = 'alert-card' + (mag >= 7 ? ' critical' : mag >= 5 ? ' high' : ' medium') + (isRecent ? ' pulse' : '');
            card.innerHTML =
                '<div class="alert-header">'
                    + '<span class="alert-type">🌍 SISMO</span>'
                    + '<span class="alert-severity" style="color:'+risk.color+'">'+risk.label+'</span>'
                + '</div>'
                + '<div class="alert-title">'+place+'</div>'
                + '<div class="alert-location">📍 '+coords[1].toFixed(2)+', '+coords[0].toFixed(2)+'</div>'
                + '<div class="alert-details">'
                    + '<span>💥 M<strong>'+mag.toFixed(1)+'</strong></span>'
                    + '<span>⬇️ '+depth+' km prof.</span>'
                    + distHtml
                + '</div>'
                + tsunamiRisk
                + '<div class="alert-footer"><span>🕐 '+formatTime(time)+'</span><span>📡 USGS</span></div>';
            list.appendChild(card);
        });

        refreshSmartTips();
    }).catch(function(e) {
        loading.style.display='none'; error.style.display='block'; error.textContent='⚠️ '+e.message;
    });
}

// ========== WEATHER ==========
function loadWeather(lat, lon) {
    var loading = document.getElementById('weatherLoading');
    var container = document.getElementById('weatherContainer');
    var error = document.getElementById('weatherError');
    loading.style.display='flex'; container.style.display='none'; error.style.display='none';

    var url = CONFIG.WEATHER_URL+'?lat='+lat+'&lon='+lon+'&appid='+CONFIG.WEATHER_API_KEY+'&units=metric&lang='+currentLang;
    fetch(url).then(function(res){ return res.json(); }).then(function(data) {
        loading.style.display='none'; container.style.display='block';
        lastWeatherData = data;
        var risk = getWeatherRisk(data);

        document.getElementById('wCity').textContent = data.name || currentLocation.name;
        document.getElementById('wTemp').textContent = Math.round(data.main.temp)+'°C';
        document.getElementById('wDesc').textContent = data.weather[0].description;
        document.getElementById('wHumidity').textContent = data.main.humidity+'%';
        document.getElementById('wWind').textContent = data.wind.speed+' m/s';
        document.getElementById('wFeels').textContent = Math.round(data.main.feels_like)+'°C';
        document.getElementById('wPressure').textContent = data.main.pressure+' hPa';

        // Weather notification if dangerous
        var main = data.weather[0].main.toLowerCase();
        if (main === 'thunderstorm') sendNotification('⛈️ Tormenta eléctrica activa', 'En '+data.name+'. Refúgiate en interior.', 'critical');
        else if (data.wind.speed > 15) sendNotification('💨 Viento extremo: '+data.wind.speed+' m/s', 'En '+(data.name||currentLocation.name)+'. Ten precaución.', 'high');
        else if (data.main.temp > 38) sendNotification('🔥 Calor extremo: '+Math.round(data.main.temp)+'°C', 'En '+(data.name||currentLocation.name)+'. Hidrátate.', 'high');

        var temp = data.main.temp, rec;
        if (temp>35) rec=t('rec_extreme'); else if(temp>30) rec=t('rec_hot');
        else if(temp>25) rec=t('rec_warm'); else if(temp>15) rec=t('rec_nice');
        else if(temp>10) rec=t('rec_cool'); else if(temp>0) rec=t('rec_cold');
        else rec=t('rec_freeze');
        document.getElementById('wRecommendation').textContent = rec;

        loadForecast(lat, lon);
    }).catch(function(e) { loading.style.display='none'; error.style.display='block'; error.textContent='⚠️ '+e.message; });
}

function loadForecast(lat, lon) {
    var url = CONFIG.FORECAST_URL+'?lat='+lat+'&lon='+lon+'&appid='+CONFIG.WEATHER_API_KEY+'&units=metric&lang='+currentLang+'&cnt=16';
    fetch(url).then(function(r){ return r.json(); }).then(function(data) { lastForecastData = data; refreshSmartTips(); }).catch(function(){});
}

// ========== SMART TIPS ==========
function refreshSmartTips() {
    var tips = [], now = Date.now();

    // SISMOS CRÍTICOS
    if (lastEarthquakes.length) {
        var recent = lastEarthquakes.filter(function(f){ return (now-f.properties.time)<3600000 && f.properties.mag>=6; });
        if (recent.length) {
            var eq = recent[0], mag = eq.properties.mag, place = eq.properties.place;
            var dist = currentLocation.lat ? calcDistance(currentLocation.lat, currentLocation.lon, eq.geometry.coordinates[1], eq.geometry.coordinates[0]) : null;
            tips.push({ title:'🚨 SISMO M'+mag.toFixed(1)+' — HACE MENOS DE 1 HORA', desc:'Epicentro: '+place+(dist?' ('+dist+' km de ti)':'')+'. Mantén la calma. Aléjate de ventanas. No uses ascensores. Revisa posibles fugas de gas. Ten lista tu mochila de emergencia.', cat:'⚫ EMERGENCIA', color:'#F44336', priority:100 });
            if (mag >= 7 && eq.geometry.coordinates[2] < 70) {
                tips.push({ title:'🌊 RIESGO DE TSUNAMI', desc:'Terremoto M'+mag.toFixed(1)+' en zona costera. Evacúa INMEDIATAMENTE hacia zonas altas. Sigue rutas oficiales. No regreses hasta autorización.', cat:'⚫ EMERGENCIA', color:'#E91E63', priority:99 });
            }
        }
        var mod = lastEarthquakes.filter(function(f){ return (now-f.properties.time)<21600000 && f.properties.mag>=5; });
        if (mod.length && !recent.length) tips.push({ title:'⚠️ '+mod.length+' sismos M5+ en 6h', desc:'Actividad sísmica elevada. Mantente alerta, conoce tu punto de encuentro y rutas de evacuación.', cat:'🟠 PRECAUCIÓN', color:'#FF9800', priority:75 });
    }

    // CLIMA ACTUAL
    if (lastWeatherData) {
        var temp = lastWeatherData.main.temp;
        var wind = lastWeatherData.wind.speed;
        var hum = lastWeatherData.main.humidity;
        var main = lastWeatherData.weather[0].main.toLowerCase();
        var desc = lastWeatherData.weather[0].description;
        var city = lastWeatherData.name || currentLocation.name || '';

        if (main==='thunderstorm') tips.push({ title:'⛈️ Tormenta eléctrica — '+city, desc:'No permanezcas bajo árboles o postes. Desconecta aparatos eléctricos. Evita actividades al aire libre. Refúgiate en interior. No uses teléfono fijo.', cat:'🔴 EMERGENCIA', color:'#F44336', priority:95 });
        if (main==='rain'||main==='drizzle') tips.push({ title:'🌧️ Lluvia: '+desc+' — '+city, desc:'Lleva paraguas. Conduce con precaución. Evita zonas inundables. Protege dispositivos electrónicos. Cuidado con calles resbaladizas.', cat:'🟡 PRECAUCIÓN', color:'#2196F3', priority:85 });
        if (main==='snow') tips.push({ title:'❄️ Nevando: '+desc+' — '+city, desc:'Conduce con cadenas. Abrígate bien. Protege cañerías contra congelamiento. Revisa calefacción.', cat:'🟠 PRECAUCIÓN', color:'#03A9F4', priority:83 });
        if (main==='mist'||main==='fog'||main==='haze') tips.push({ title:'🌫️ Visibilidad reducida — '+city, desc:'Usa luces bajas (no altas). Reduce velocidad. Mantén mayor distancia de frenado.', cat:'🟡 PRECAUCIÓN', color:'#9E9E9E', priority:70 });
        if (wind>15) tips.push({ title:'💨 Viento extremo: '+wind.toFixed(0)+' m/s — '+city, desc:'Viento peligroso. Asegura objetos sueltos. Evita zonas con árboles. Reduce velocidad al conducir. No estaciones bajo árboles grandes.', cat:'🔴 ALTO', color:'#FF5722', priority:88 });
        else if (wind>10) tips.push({ title:'💨 Viento fuerte: '+wind.toFixed(0)+' m/s', desc:'Asegura toldos y objetos exteriores. Ten precaución en puentes y caminos abiertos.', cat:'🟠 PRECAUCIÓN', color:'#FF9800', priority:55 });
        if (temp>38) tips.push({ title:'🔥 Calor extremo: '+Math.round(temp)+'°C — '+city, desc:'Peligroso. Nunca dejes niños o mascotas en vehículos. Hidrátate cada 20 min. Evita actividad física. Usa SPF 50+. Busca aire acondicionado.', cat:'🔴 EMERGENCIA', color:'#F44336', priority:90 });
        else if (temp>30) tips.push({ title:'☀️ Mucho calor: '+Math.round(temp)+'°C', desc:'Bebe agua frecuentemente. Usa ropa ligera. Busca sombra. Aplica protector solar.', cat:'🟡 PRECAUCIÓN', color:'#FF9800', priority:60 });
        if (temp<-5) tips.push({ title:'🥶 Congelante: '+Math.round(temp)+'°C — '+city, desc:'Riesgo de hipotermia. Abrígate en capas. No salgas sin necesidad. Protege cañerías. Revisa a adultos mayores y niños.', cat:'🔴 EMERGENCIA', color:'#1565C0', priority:89 });
        else if (temp<3) tips.push({ title:'❄️ Temperatura bajo 3°C — '+city, desc:'Abrígate bien. Consume alimentos calientes. Protege plantas. Cuidado con escarcha en caminos.', cat:'🟠 PRECAUCIÓN', color:'#03A9F4', priority:65 });
        if (hum>90&&temp>22) tips.push({ title:'💧 Calor húmedo: '+hum+'% humedad', desc:'La combinación calor-humedad aumenta riesgo de golpe de calor. Busca lugares ventilados. Hidrátate constantemente.', cat:'🟡 PRECAUCIÓN', color:'#FF9800', priority:50 });
        if ((main==='clear'||main==='clouds')&&temp>18) tips.push({ title:'☀️ UV alto hoy — '+city, desc:'Usa protector solar SPF 30+, gafas y sombrero. Evita exposición directa entre 10:00-16:00. Hidrátate.', cat:'🟢 PREVENCIÓN', color:'#FF9800', priority:30 });
    }

    // PRONÓSTICO
    if (lastForecastData && lastForecastData.list) {
        var fc = lastForecastData.list, storm=false, rain=false, cold=false;
        for (var i=0; i<Math.min(fc.length,8); i++) {
            var m=fc[i].weather[0].main.toLowerCase();
            if(m==='thunderstorm') storm=true;
            if(m==='rain'||m==='drizzle') rain=true;
            if(fc[i].main.temp<0) cold=true;
        }
        var curMain = lastWeatherData ? lastWeatherData.weather[0].main.toLowerCase() : '';
        if (storm && curMain!=='thunderstorm') tips.push({ title:'⛈️ Tormenta en las próximas horas', desc:'Se pronostican tormentas eléctricas. Recoge ropa tendida. Asegura objetos exteriores. Ten linterna a mano por posibles cortes de luz.', cat:'🟠 PRECAUCIÓN', color:'#FF5722', priority:72 });
        if (rain && ['rain','drizzle'].indexOf(curMain)<0) tips.push({ title:'🌧️ Lluvias próximas horas', desc:'Se esperan lluvias. Lleva paraguas. Revisa canaletas. Evita zonas que se inundan frecuentemente.', cat:'🟡 PREVENCIÓN', color:'#2196F3', priority:45 });
        if (cold && lastWeatherData && lastWeatherData.main.temp>3) tips.push({ title:'🌡️ Descenso de temperatura', desc:'Se esperan temperaturas bajo 0°C. Prepara abrigo extra. Protege plantas y mascotas.', cat:'🟡 PREVENCIÓN', color:'#03A9F4', priority:40 });
    }

    // GENÉRICOS (si hay pocos tips)
    if (tips.length < 2) {
        tips.push({ title:'🎒 Mochila de emergencia', desc:'Ten siempre lista una mochila con: agua (1L/persona), linterna, radio a pilas, documentos, medicamentos y comida no perecedera.', cat:'🟢 PREVENCIÓN', color:'#795548', priority:10 });
        tips.push({ title:'📱 Plan familiar de emergencia', desc:'Define punto de encuentro familiar. Guarda números: Bomberos, Ambulancia, Carabineros, SENAPRED. Practica simulacros.', cat:'🟢 PREVENCIÓN', color:'#607D8B', priority:5 });
    }

    tips.sort(function(a,b){ return b.priority-a.priority; });
    renderTips(tips);
}

function renderTips(tips) {
    var list = document.getElementById('tipsList'); list.innerHTML='';
    var h = document.createElement('div');
    h.style.cssText='padding:8px 12px;font-size:11px;color:#999;text-align:right;';
    h.textContent='🔄 '+new Date().toLocaleTimeString(currentLang,{hour:'2-digit',minute:'2-digit'});
    list.appendChild(h);
    tips.forEach(function(tip) {
        var card = document.createElement('div'); card.className='tip-card'; card.style.borderLeft='4px solid '+tip.color;
        if (tip.priority>=85) { card.style.background=tip.color+'12'; card.style.border='1px solid '+tip.color+'40'; card.style.borderLeft='4px solid '+tip.color; }
        card.innerHTML='<span class="tip-category" style="color:'+tip.color+';background:'+tip.color+'18">'+tip.cat+'</span><div class="tip-title">'+tip.title+'</div><div class="tip-desc">'+tip.desc+'</div>';
        list.appendChild(card);
    });
}

// ========== MAP ==========
function initMap() {
    var lat = currentLocation.lat||-33.45, lon = currentLocation.lon||-70.66;
    leafletMap = L.map('map').setView([lat,lon],5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(leafletMap);

    // User location marker
    if (currentLocation.lat) {
        userMarker = L.marker([currentLocation.lat, currentLocation.lon], {
            icon: L.divIcon({ html:'<div style="background:#6200EE;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 8px rgba(98,0,238,0.6)"></div>', iconSize:[18,18], iconAnchor:[9,9] })
        }).addTo(leafletMap).bindPopup('<b>📍 '+currentLocation.name+'</b>').openPopup();
    }

    // Earthquake markers
    fetch(CONFIG.USGS_URL).then(function(r){return r.json();}).then(function(data){
        data.features.forEach(function(f){
            var c=f.geometry.coordinates, mag=f.properties.mag, place=f.properties.place;
            var color = mag>=7?'#F44336':mag>=5?'#FF5722':mag>=4?'#FF9800':'#FFC107';
            L.circleMarker([c[1],c[0]],{radius:Math.max(mag*2.5,5),color:color,fillColor:color,fillOpacity:0.7,weight:1})
                .addTo(leafletMap).bindPopup('<b>🌍 M'+mag.toFixed(1)+'</b><br>'+place+'<br><small>Prof: '+c[2].toFixed(0)+' km</small>');
        });
    }).catch(function(){});

    mapInitialized=true;
    setTimeout(function(){leafletMap.invalidateSize();},300);
}
