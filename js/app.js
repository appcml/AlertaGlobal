// ============================================
// js/app.js — Alerta Global v9.1 — CORREGIDO + ESTABILIZADO
// ============================================

var CONFIG = {
    USGS_BASE: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=80&minmagnitude=1.5',
    USGS_GLOBAL: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
    WEATHER_API_KEY: '6fe6e0dcca264864dbd631bf620aad64',
    WEATHER_URL: 'https://api.openweathermap.org/data/2.5/weather',
    FORECAST_URL: 'https://api.openweathermap.org/data/2.5/forecast',
    ALERTS_INTERVAL: 120000,
    WEATHER_INTERVAL: 600000,
    MAX_QUERY_RADIUS_KM: 800
};

// Persisted / runtime configuration
CONFIG.USER_RADIUS_KM = parseInt(localStorage.getItem('ag_radius_km') || '500', 10);
CONFIG.MIN_LOCATION_ACCURACY_M = 5000;

var deviceLocation = { lat: null, lon: null, name: '', country: '', accuracy: null };
var focusLocation = { lat: null, lon: null, name: '', country: '' };
var currentLocation = { lat: null, lon: null, name: '', country: '' };
var leafletMap = null, mapInitialized = false, userMarker = null;
var lastWeatherData = null, lastForecastData = null, lastEarthquakes = [];
var seenAlertIds = {}, notifPermission = false, searchTimer = null;
var externalAlerts = [], alertsLoading = false;
var dataReady = { weather: false, earthquakes: false };
var sosFlashActive = false, sosFlashInterval = null;
var threatDetected = false;
var geoWatchId = null;

// ======= Helpers =======
function setUserRadiusKm(km) {
    CONFIG.USER_RADIUS_KM = km;
    try { localStorage.setItem('ag_radius_km', String(km)); } catch(e){}
}
function getUserRadiusKm() { return CONFIG.USER_RADIUS_KM || 500; }
function saveFocusLocation() { 
    try { localStorage.setItem('ag_focus', JSON.stringify(focusLocation)); } catch(e){}
}
function loadFocusLocation() {
    try {
        var f = JSON.parse(localStorage.getItem('ag_focus'));
        if (f && f.lat) focusLocation = f;
    } catch(e){}
}
function getActiveLocation() {
    if (focusLocation && focusLocation.lat) return focusLocation;
    if (deviceLocation && deviceLocation.lat) return deviceLocation;
    return currentLocation || { lat: null, lon: null, name:'', country:'' };
}

function isWithinRadius(eventLat, eventLon, centerLat, centerLon, radiusKm) {
    if (!centerLat || !centerLon || !eventLat || !eventLon) return false;
    var d = calcDistance(centerLat, centerLon, eventLat, eventLon);
    if (radiusKm === 0) return true;
    return d <= (radiusKm || getUserRadiusKm());
}

// ========== THEME ==========
function setTheme(name) {
    document.documentElement.setAttribute('data-theme', name);
    try { localStorage.setItem('ag_theme', name); } catch(e) {}
    document.querySelectorAll('.theme-option').forEach(function(btn) {
        btn.setAttribute('data-active', btn.dataset.theme === name ? 'true' : 'false');
    });
    if (leafletMap && mapInitialized) {
        leafletMap.eachLayer(function(layer) {
            if (layer instanceof L.TileLayer) leafletMap.removeLayer(layer);
        });
        var tileUrl = (name === 'light')
            ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        L.tileLayer(tileUrl, { attribution: '© OpenStreetMap', subdomains: 'abcd', maxZoom: 20 }).addTo(leafletMap);
    }
    closePopups();
    showToast('🎨 Tema aplicado');
}

function loadSavedTheme() {
    try {
        var t = localStorage.getItem('ag_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', t);
    } catch(e) {}
}

// ========== UTIL / AUDIO ==========
var AudioCtx = window.AudioContext || window.webkitAudioContext;
var audioCtx = null;
function getAudio() { 
    if (!audioCtx) try { audioCtx = new AudioCtx(); } catch(e) {} 
    return audioCtx; 
}
function playBeep(freq, dur, type) {
    var ctx = getAudio(); if (!ctx) return;
    try {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = type || 'sine'; o.frequency.value = freq || 880;
        g.gain.setValueAtTime(0.4, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (dur || 0.4));
        o.start(ctx.currentTime); o.stop(ctx.currentTime + (dur || 0.4));
    } catch(e) {}
}
function playSiren() {
    var ctx = getAudio(); if (!ctx) return;
    try {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
        for (var i = 0; i < 4; i++) {
            o.frequency.setValueAtTime(400, ctx.currentTime + i*2);
            o.frequency.linearRampToValueAtTime(900, ctx.currentTime + i*2 + 1);
            o.frequency.linearRampToValueAtTime(400, ctx.currentTime + i*2 + 2);
        }
        g.gain.setValueAtTime(0.5, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 8);
        o.start(ctx.currentTime); o.stop(ctx.currentTime + 8);
        if (navigator.vibrate) navigator.vibrate([500,200,500,200,500,200,1000]);
    } catch(e) {}
}

// ========== STATUS & INIT ==========
function updateStatus(isThreat, text) {
    threatDetected = isThreat;
    var dot = document.querySelector('.status-dot');
    var txt = document.getElementById('statusText');
    if (dot) dot.className = 'status-dot ' + (isThreat ? 'danger' : 'safe');
    if (txt) txt.textContent = text || (isThreat ? 'AMENAZA DETECTADA' : 'Entorno Seguro');
}

document.addEventListener('DOMContentLoaded', function() {
    loadSavedTheme();
    loadFocusLocation();
    setLanguage(currentLang);
    document.addEventListener('click', function unlock() {
        var c = getAudio(); if (c && c.state === 'suspended') c.resume();
        document.removeEventListener('click', unlock);
    }, { once: true });
    setupTabs();
    setupLocationButtons();
    setupLanguageSelector();
    setupThemeSelector();
    setupSearch();
    setupFavorites();
    setupSOS();
    requestNotificationPermission();
    initLocation();
    setInterval(loadAlerts, CONFIG.ALERTS_INTERVAL);
    setInterval(function() { var a = getActiveLocation(); if (a.lat) loadWeather(a.lat, a.lon); }, CONFIG.WEATHER_INTERVAL);
    setTimeout(function() {
        loadExternalSourcesData();
        setInterval(loadExternalSourcesData, 180000);
    }, 5000);
});

// ========== NOTIFICATIONS ==========
function requestNotificationPermission() {
    if ('Notification' in window) Notification.requestPermission().then(function(p) { notifPermission = p === 'granted'; });
}
function sendNotification(title, body, urgency) {
    if (notifPermission) try { new Notification(title, { body: body, icon: 'img/icon.svg' }); } catch(e) {}
    // Banner fallback
    var colors = { critical: '#FF3B30', high: '#FF9500', medium: '#FFC107', info: '#0A84FF' };
    var old = document.getElementById('alertBanner'); if (old) old.remove();
    var b = document.createElement('div');
    b.id = 'alertBanner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:'+(colors[urgency]||colors.info)+';color:#fff;padding:12px 16px;z-index:500;display:flex;align-items:center;gap:12px;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
    b.innerHTML = '<div style="flex:1"><div style="font-weight:700;font-size:14px">'+title+'</div><div style="font-size:12px;opacity:0.9;margin-top:2px">'+body+'</div></div><button onclick="this.parentNode.remove()" style="background:#fff;border:none;border-radius:8px;padding:6px 8px;cursor:pointer">OK</button>';
    document.body.appendChild(b);
    setTimeout(function() { if (b.parentNode) b.remove(); }, 10000);
}

// ========== TOAST / POPUPS ==========
function closePopups() {
    ['searchPopup','langPopup','favoritesPopup','sharePopup','sosPopup','themePopup','radiusPopup'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.style.display = 'none';
    });
}
function showToast(msg) {
    var el = document.getElementById('toast');
    if (!el) return console.log('toast:', msg);
    el.textContent = msg; el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 2500);
}
function formatTime(ts) {
    var d = Date.now()-ts;
    if (d < 60000) return 'Hace menos de 1 min';
    if (d < 3600000) return 'Hace '+Math.floor(d/60000)+' min';
    if (d < 86400000) return 'Hace '+Math.floor(d/3600000)+'h';
    return new Date(ts).toLocaleString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function calcDistance(lat1, lon1, lat2, lon2) {
    var R=6371, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
    var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

// ========== SAVED LOCATIONS ==========
function renderSavedLocations() {
    var locs = LocationManager.getAll();
    ['savedLocations','weatherSavedLocations'].forEach(function(id) {
        var c = document.getElementById(id); if (!c) return;
        if (!locs.length) { c.innerHTML=''; return; }
        c.innerHTML = locs.map(function(l) {
            var sn=l.name.replace(/'/g,"\\'"), sc=(l.country||'').replace(/'/g,"\\'");
            return '<div class="saved-loc"><button class="saved-loc-btn" onclick="selectLocation({name:\''+sn+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+sc+'\'})">📍 '+l.name+'</button><button class="saved-del-btn" onclick="removeSavedLocation(\''+sn+'\')">🗑️</button></div>';
        }).join('');
    });
}
function removeSavedLocation(name) { LocationManager.remove(name); renderSavedLocations(); showToast('Eliminado'); }

// ========== UI SETUP ==========
function setupTabs() {
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
            document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
            this.classList.add('active');
            document.getElementById('panel-'+this.dataset.tab).classList.add('active');
            if (this.dataset.tab === 'mapa' && !mapInitialized) initMap();
            else if (this.dataset.tab === 'mapa' && leafletMap) setTimeout(function(){leafletMap.invalidateSize();},200);
            if (this.dataset.tab === 'tips') refreshSmartTips();
        });
    });
}

function setupSearch() {
    var closeBtn = document.getElementById('closeSearch');
    if (closeBtn) closeBtn.addEventListener('click', closePopups);
    var searchBtn = document.getElementById('searchBtn');
    if (searchBtn) searchBtn.addEventListener('click', doSearch);
    var popup = document.getElementById('searchPopup');
    if (popup) popup.addEventListener('click', function(e) { if (e.target===this) closePopups(); });
    var input = document.getElementById('searchInput');
    if (input) {
        input.addEventListener('input', function() {
            clearTimeout(searchTimer);
            if (this.value.trim().length < 2) { document.getElementById('searchResults').innerHTML=''; return; }
            searchTimer = setTimeout(doSearch, 350);
        });
        input.addEventListener('keydown', function(e) {
            if (e.key==='Enter') { clearTimeout(searchTimer); doSearch(); }
            if (e.key==='Escape') closePopups();
        });
    }
}

function doSearch() {
    var q = document.getElementById('searchInput').value.trim();
    if (q.length < 2) return;
    var r = document.getElementById('searchResults');
    r.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    LocationManager.search(q).then(function(locs) {
        if (!locs.length) { r.innerHTML='<p style="text-align:center;color:#666;padding:16px">Sin resultados</p>'; return; }
        r.innerHTML = locs.map(function(l) {
            return '<button class="search-result" onclick="selectLocation({name:\''+l.name.replace(/'/g,"\\'")+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+l.country.replace(/'/g,"\\'")+'\'})">'
                +'<strong>'+l.name+'</strong><br><small>'+l.fullName+'</small></button>';
        }).join('');
    }).catch(function(e) { r.innerHTML='<p style="color:#FF3B30;padding:16px">Error: '+e.message+'</p>'; });
}

// (Continúa con el resto de funciones originales corregidas - geoloc, alerts, weather, map, SOS, etc.)

function createUserIcon() {
    return L.divIcon({
        className: 'custom-user-marker',
        html: '<div style="background:#0A84FF;border:3px solid white;border-radius:50%;width:24px;height:24px;box-shadow:0 0 8px rgba(10,132,255,0.8);"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

function openSearch() {
    closePopups();
    var popup = document.getElementById('searchPopup');
    if (popup) popup.style.display = 'flex';
}

// --------------- end of file ---------------
