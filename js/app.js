// ============================================
// js/app.js — Alerta Global v6 STABLE
// ============================================
var CONFIG = {
    USGS_URL: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
    WEATHER_API_KEY: '6fe6e0dcca264864dbd631bf620aad64',
    WEATHER_URL: 'https://api.openweathermap.org/data/2.5/weather',
    FORECAST_URL: 'https://api.openweathermap.org/data/2.5/forecast'
};

var currentLocation = { lat: null, lon: null, name: '', country: '' };
var leafletMap = null, mapInitialized = false, userMarker = null;
var lastWeatherData = null, lastForecastData = null, lastEarthquakes = [];
var seenAlertIds = {}, notifPermission = false, searchTimer = null;
var externalAlerts = [], dataReady = { weather: false, earthquakes: false };


// ============================================================
// SISTEMA DE SONIDOS Y ALERTAS CRÍTICAS
// ============================================================
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        try { audioCtx = new AudioContext(); } catch(e) {}
    }
    return audioCtx;
}

// Sonido de notificación normal (beep corto)
function playNotificationSound() {
    var ctx = getAudioCtx(); if (!ctx) return;
    try {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
    } catch(e) {}
}

// Sonido de alerta alta (beep doble)
function playAlertSound() {
    var ctx = getAudioCtx(); if (!ctx) return;
    [0, 0.3].forEach(function(delay) {
        try {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'square'; osc.frequency.value = 660;
            gain.gain.setValueAtTime(0.4, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.25);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.25);
        } catch(e) {}
    });
}

// Sirena de emergencia crítica (M6.5+ o alerta oficial)
// Similar a la señal de alerta nacional SENAPRED
function playSirenSound() {
    var ctx = getAudioCtx(); if (!ctx) return;
    try {
        var duration = 8; // 8 segundos como alerta nacional
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        // Frecuencia que sube y baja — efecto sirena
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        for (var i = 0; i < 4; i++) {
            osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + (i * 2) + 1);
            osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + (i * 2) + 2);
        }
        gain.gain.setValueAtTime(0.6, ctx.currentTime);
        gain.gain.setValueAtTime(0.6, ctx.currentTime + duration - 0.5);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
        // Vibrar dispositivo si disponible
        if (navigator.vibrate) {
            navigator.vibrate([500,200,500,200,500,200,1000,200,1000,200,1000]);
        }
    } catch(e) {}
}

// Escala de alertas sísmicas SENAPRED/ONEMI Chile
// Alerta nacional se emite desde M6.5 superficial en costa
function shouldTriggerNationalAlert(mag, depth, place) {
    var isCoastal = /coast|costa|pacific|océano|ocean|shore|offshore|mar /i.test(place);
    var isChile = /chile|atacama|coquimbo|valparaís|metropolitana|o'higgins|maule|biobío|araucanía|los ríos|los lagos|aysén|magallanes/i.test(place);
    // Criterios SENAPRED para alerta sísmica nacional
    if (mag >= 8.0) return 'ALERTA_ROJA';         // M8+ siempre alerta roja
    if (mag >= 7.0 && isCoastal) return 'ALERTA_TSUNAMI'; // M7+ costa = riesgo tsunami
    if (mag >= 6.5 && isChile) return 'ALERTA_NARANJA';   // M6.5+ en Chile
    if (mag >= 5.5 && isChile) return 'ALERTA_AMARILLA';  // M5.5+ en Chile
    return null;
}

function triggerEmergencyAlert(mag, place, depth, alertLevel) {
    var messages = {
        'ALERTA_ROJA': { title:'🚨 ALERTA ROJA — SISMO M'+mag.toFixed(1), color:'#B71C1C', sound:'siren' },
        'ALERTA_TSUNAMI': { title:'🌊 RIESGO DE TSUNAMI — M'+mag.toFixed(1), color:'#880E4F', sound:'siren' },
        'ALERTA_NARANJA': { title:'🟠 ALERTA NARANJA — SISMO M'+mag.toFixed(1), color:'#E65100', sound:'alert' },
        'ALERTA_AMARILLA': { title:'🟡 ALERTA AMARILLA — SISMO M'+mag.toFixed(1), color:'#F57F17', sound:'notification' }
    };
    var msg = messages[alertLevel];
    if (!msg) return;
    // Reproducir sonido según nivel
    if (msg.sound === 'siren') playSirenSound();
    else if (msg.sound === 'alert') playAlertSound();
    else playNotificationSound();
    // Banner de emergencia
    sendNotification(msg.title, place + ' · Prof: ' + depth + ' km', alertLevel === 'ALERTA_ROJA' ? 'critical' : 'high');
    // Mostrar modal de emergencia para nivel rojo
    if (alertLevel === 'ALERTA_ROJA' || alertLevel === 'ALERTA_TSUNAMI') {
        showEmergencyModal(msg.title, place, mag, depth, alertLevel);
    }
}

function showEmergencyModal(title, place, mag, depth, level) {
    var old = document.getElementById('emergencyModal');
    if (old) old.remove();
    var colors = { 'ALERTA_ROJA':'#B71C1C', 'ALERTA_TSUNAMI':'#880E4F' };
    var modal = document.createElement('div');
    modal.id = 'emergencyModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = '<div style="background:'+(colors[level]||'#B71C1C')+';border-radius:16px;padding:24px;max-width:380px;width:100%;color:#fff;text-align:center;">'
        + '<div style="font-size:48px;margin-bottom:12px">'+(level==='ALERTA_TSUNAMI'?'🌊':'🚨')+'</div>'
        + '<div style="font-size:22px;font-weight:800;margin-bottom:8px">'+title+'</div>'
        + '<div style="font-size:15px;opacity:0.9;margin-bottom:16px">'+place+'</div>'
        + '<div style="display:flex;gap:12px;justify-content:center;margin-bottom:20px">'
        +   '<span style="background:rgba(255,255,255,0.2);padding:8px 14px;border-radius:8px;font-weight:700">M '+mag.toFixed(1)+'</span>'
        +   '<span style="background:rgba(255,255,255,0.2);padding:8px 14px;border-radius:8px">⬇️ '+depth+' km</span>'
        + '</div>'
        + (level==='ALERTA_TSUNAMI'
            ? '<div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:12px;margin-bottom:16px;font-size:14px;text-align:left">🌊 EVACÚA INMEDIATAMENTE hacia zonas altas.<br>📍 Aléjate de la costa y ríos.<br>🚫 No regreses hasta autorización oficial.</div>'
            : '<div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:12px;margin-bottom:16px;font-size:14px;text-align:left">⚠️ Mantén la calma.<br>🪟 Aléjate de ventanas.<br>🚪 No uses ascensores.<br>🔥 Revisa posibles fugas de gas.</div>')
        + '<button onclick="document.getElementById('emergencyModal').remove()" style="background:#fff;color:'+(colors[level]||'#B71C1C')+';border:none;border-radius:10px;padding:12px 24px;font-size:16px;font-weight:800;cursor:pointer;width:100%">ENTENDIDO</button>'
        + '</div>';
    document.body.appendChild(modal);
    // Auto-cerrar en 30 segundos
    setTimeout(function() { if (modal.parentNode) modal.remove(); }, 30000);
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function() {
    setLanguage(currentLang);

    // Unlock AudioContext on first interaction (browser requirement)
    document.addEventListener('click', function unlockAudio() {
        var ctx = getAudioCtx();
        if (ctx && ctx.state === 'suspended') ctx.resume();
        document.removeEventListener('click', unlockAudio);
    }, { once: true });
    setupTabs();
    setupLocationButtons();
    setupLanguageSelector();
    setupSearch();
    setupFavorites();
    requestNotificationPermission();
    initLocation();
    // Refresh alerts every 2 min, weather every 10 min
    setInterval(function() { loadAlerts(); }, 120000);
    setInterval(function() { if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon); }, 600000);
    // External sources after 5s, then every 5 min
    setTimeout(function() {
        loadExternalSourcesData();
        setInterval(loadExternalSourcesData, 300000);
    }, 5000);
});

// ========== GEOLOCATION ==========
// Order: GPS coords → load data → city name in background
function initLocation() {
    // PASO 1: ubicación guardada → set coords PRIMERO, luego cargar filtrado
    var saved = LocationManager.getCurrent();
    if (saved && saved.lat) {
        currentLocation = saved;
        updateLocationDisplay(saved.name);
        loadAlerts();           // ya tiene coords → filtra por zona
        loadWeather(saved.lat, saved.lon);
        renderSavedLocations();
        updateStarButtons();
        return;
    }

    // PASO 2: pedir GPS — cuando llegue, set coords y cargar filtrado
    updateLocationDisplay('Detectando...');
    if (!navigator.geolocation) {
        updateLocationDisplay('🌍 Global');
        loadAlerts(); // sin coords → global
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            var lat = pos.coords.latitude, lon = pos.coords.longitude;
            // Set coords ANTES de loadAlerts para que filtre por zona
            currentLocation = { lat: lat, lon: lon, name: lat.toFixed(2)+', '+lon.toFixed(2), country: '' };
            updateLocationDisplay(currentLocation.name);
            loadAlerts();           // ahora sí filtra por zona del usuario
            loadWeather(lat, lon);
            // Nombre ciudad en background
            LocationManager.reverseGeocode(lat, lon).then(function(geo) {
                currentLocation.name = geo.city || currentLocation.name;
                currentLocation.country = geo.country || '';
                LocationManager.setCurrent(currentLocation);
                updateLocationDisplay(currentLocation.name);
                renderSavedLocations();
                updateStarButtons();
            }).catch(function() {});
        },
        function() {
            // GPS denegado → cargar alertas globales
            updateLocationDisplay('🌍 Global');
            loadAlerts();
            showLocationBanner();
        },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 600000 }
    );
}

// Banner suave invitando a permitir ubicación (no bloquea nada)
function showLocationBanner() {
    var existing = document.getElementById('locBanner');
    if (existing) return;
    var b = document.createElement('div');
    b.id = 'locBanner';
    b.style.cssText = 'background:#f3e5f5;border-left:4px solid #6200EE;padding:10px 14px;margin:8px 10px;border-radius:10px;font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:10px;';
    b.innerHTML = '<span>📍 Permite tu ubicación para ver alertas de tu zona</span>'
        + '<button onclick="requestLocation()" style="background:#6200EE;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">Activar</button>';
    var alertList = document.getElementById('alertList');
    if (alertList) alertList.insertBefore(b, alertList.firstChild);
}

function requestLocation() {
    var banner = document.getElementById('locBanner');
    if (banner) banner.remove();
    navigator.geolocation.getCurrentPosition(
        function(pos) {
            var lat = pos.coords.latitude, lon = pos.coords.longitude;
            currentLocation = { lat: lat, lon: lon, name: '📍 '+lat.toFixed(2)+', '+lon.toFixed(2), country: '' };
            updateLocationDisplay(currentLocation.name);
            loadAlerts();
            loadWeather(lat, lon);
            LocationManager.reverseGeocode(lat, lon).then(function(geo) {
                currentLocation.name = geo.city || currentLocation.name;
                currentLocation.country = geo.country || '';
                LocationManager.setCurrent(currentLocation);
                updateLocationDisplay(currentLocation.name);
                renderSavedLocations();
                updateStarButtons();
            }).catch(function() {});
        },
        function() { showToast('Permiso de ubicación denegado'); },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
    );
}

function updateLocationDisplay(name) {
    var e1 = document.getElementById('currentLocationName');
    var e2 = document.getElementById('weatherLocationName');
    if (e1) e1.textContent = name || 'Global';
    if (e2) e2.textContent = name || 'Detectar';
}

function selectLocation(loc) {
    currentLocation = loc;
    LocationManager.setCurrent(loc);
    updateLocationDisplay(loc.name);
    dataReady = { weather: false, earthquakes: false };
    loadAlerts();
    loadWeather(loc.lat, loc.lon);
    if (leafletMap) {
        leafletMap.setView([loc.lat, loc.lon], 8);
        if (userMarker) userMarker.setLatLng([loc.lat, loc.lon]).bindPopup('📍 '+loc.name).openPopup();
        else userMarker = L.marker([loc.lat, loc.lon], { icon: createUserIcon() }).addTo(leafletMap).bindPopup('📍 '+loc.name).openPopup();
    }
    closePopups();
    showToast('📍 '+loc.name);
    updateStarButtons();
}

function createUserIcon() {
    return L.divIcon({ html:'<div style="background:#6200EE;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(98,0,238,0.7)"></div>', iconSize:[18,18], iconAnchor:[9,9] });
}

// ========== UTILS ==========
function closePopups() {
    ['searchPopup','langPopup','favoritesPopup','sharePopup'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}
function showToast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 2500);
}
function formatTime(ts) {
    var d = Date.now()-ts;
    if (d < 3600000) return 'Hace '+Math.floor(d/60000)+' min';
    if (d < 86400000) return 'Hace '+Math.floor(d/3600000)+'h';
    return new Date(ts).toLocaleString('es-CL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function calcRisk(mag) {
    if (mag>=8) return {label:'⚫ EXTREMO', color:'#212121'};
    if (mag>=7) return {label:'🔴 CRÍTICO', color:'#B71C1C'};
    if (mag>=5) return {label:'🟠 ALTO',    color:'#E64A19'};
    if (mag>=4) return {label:'🟡 MEDIO',   color:'#F57F17'};
    return          {label:'🟢 BAJO',    color:'#2E7D32'};
}
function calcDistance(lat1, lon1, lat2, lon2) {
    var R=6371, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
    var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

// ========== NOTIFICATIONS ==========
function requestNotificationPermission() {
    if ('Notification' in window) Notification.requestPermission().then(function(p) { notifPermission = p==='granted'; });
}
function sendNotification(title, body, urgency) {
    if (notifPermission) try { new Notification(title, { body:body, icon:'img/icon.svg' }); } catch(e) {}
    var colors = {critical:'#B71C1C', high:'#F44336', medium:'#FF9800', info:'#1976D2'};
    var old = document.getElementById('alertBanner');
    if (old) old.remove();
    var b = document.createElement('div');
    b.id = 'alertBanner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:'+(colors[urgency]||colors.info)+';color:#fff;padding:12px 16px;z-index:500;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 8px rgba(0,0,0,0.4);animation:slideDown 0.3s ease;font-family:inherit;';
    b.innerHTML = '<div style="flex:1;margin-right:8px"><div style="font-weight:700;font-size:14px">'+title+'</div><div style="font-size:12px;opacity:0.95;margin-top:2px">'+body+'</div></div><button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,0.25);border:none;color:#fff;font-size:18px;cursor:pointer;padding:4px 10px;border-radius:6px">✕</button>';
    document.body.appendChild(b);
    setTimeout(function() { if (b.parentNode) b.remove(); }, 10000);
}

// ========== TABS ==========
function setupTabs() {
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
            document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
            this.classList.add('active');
            document.getElementById('panel-'+this.dataset.tab).classList.add('active');
            if (this.dataset.tab==='mapa' && !mapInitialized) initMap();
            if (this.dataset.tab==='tips') refreshSmartTips();
        });
    });
}

// ========== LOCATION BUTTONS ==========
function setupLocationButtons() {
    function geoLocate(cb) {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(function(pos) {
            LocationManager.reverseGeocode(pos.coords.latitude, pos.coords.longitude).then(function(geo) {
                cb({ lat:pos.coords.latitude, lon:pos.coords.longitude, name:geo.city, country:geo.country });
            });
        }, function() { showToast('No se pudo obtener ubicación'); });
    }
    document.getElementById('btnMyLocation').addEventListener('click', function() { geoLocate(selectLocation); });
    document.getElementById('btnSearchLocation').addEventListener('click', openSearch);
    document.getElementById('btnWeatherLocation').addEventListener('click', function() { geoLocate(selectLocation); });
    document.getElementById('btnWeatherSearch').addEventListener('click', openSearch);
    document.getElementById('btnRefresh').addEventListener('click', function() {
        loadAlerts();
        if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon);
        showToast('✅ Datos actualizados');
    });
}

// ========== SAVED LOCATIONS ==========
function renderSavedLocations() {
    var locs = LocationManager.getAll();
    ['savedLocations','weatherSavedLocations'].forEach(function(id) {
        var c = document.getElementById(id); if (!c) return;
        if (!locs.length) { c.innerHTML=''; return; }
        c.innerHTML = locs.map(function(l) {
            var sn=l.name.replace(/'/g,"\\'"), sc=(l.country||'').replace(/'/g,"\\'");
            return '<div class="saved-loc"><button class="saved-loc-btn" onclick="selectLocation({name:\''+sn+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+sc+'\'})">📍 '+l.name+'</button><button class="saved-loc-remove" onclick="removeSavedLocation(\''+sn+'\')">✕</button></div>';
        }).join('');
    });
}
function removeSavedLocation(name) { LocationManager.remove(name); renderSavedLocations(); showToast('Eliminado de favoritos'); }

// ========== SEARCH ==========
function setupSearch() {
    document.getElementById('closeSearch').addEventListener('click', closePopups);
    document.getElementById('searchBtn').addEventListener('click', doSearch);
    document.getElementById('searchPopup').addEventListener('click', function(e) { if (e.target===this) closePopups(); });
    var input = document.getElementById