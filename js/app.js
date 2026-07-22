// ============================================
// js/app.js — Alerta Global v10.0 — COMPLETO
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
var mapMarkers = [];

var currentShareData = null;

// ========== SMART ZOOM FILTERING (ARREGLADO) ==========
/**
 * Filtrado inteligente por ZOOM LEVEL
 * - Zoom bajo (0-6): Solo alertas críticas mundiales
 * - Zoom medio (7-10): Alertas cercanas + críticas globales
 * - Zoom alto (11+): Todas las alertas cercanas a la localidad
 */
function updateMapMarkersSmartZoom(allAlerts, userLocation) {
    if (!mapInitialized || !leafletMap || !allAlerts) return;

    // Limpiar marcadores anteriores
    mapMarkers.forEach(function(m) { leafletMap.removeLayer(m); });
    mapMarkers = [];

    // Actualizar posición usuario
    if (userLocation && userLocation.lat) {
        if (userMarker) {
            userMarker.setLatLng([userLocation.lat, userLocation.lon]);
        } else {
            userMarker = L.marker([userLocation.lat, userLocation.lon], { icon: createUserIcon() })
                .addTo(leafletMap).bindPopup('<b>📍 Tu ubicación</b><br>' + (userLocation.name || ''));
        }
        leafletMap.setView([userLocation.lat, userLocation.lon], leafletMap.getZoom() || 6, { animate: true });
    }

    // Obtener nivel de zoom actual
    var currentZoom = leafletMap.getZoom();
    var radiusKm = getUserRadiusKm();
    
    // LÓGICA DE FILTRADO POR ZOOM
    var filteredAlerts = [];
    
    if (currentZoom <= 6) {
        // ZOOM BAJO: mostrar todas con prioridad mínima baja
        filteredAlerts = allAlerts.filter(function(a) {
            return (a.priority >= 50) || (a.type && a.type.includes('SISMO') && a.magnitude >= 2.0) 
                   || (a.type && (a.type.includes('VOLCÁN') || a.type.includes('ERUPCIÓN')));
        });
    } else if (currentZoom <= 10) {
        // ZOOM MEDIO: Alertas cercanas + alertas globales importantes
        if (userLocation && userLocation.lat) {
            filteredAlerts = allAlerts.filter(function(a) {
                var isNearby = isWithinRadius(a.lat, a.lon, userLocation.lat, userLocation.lon, radiusKm);
                var isImportant = (a.priority >= 50) || (a.magnitude && a.magnitude >= 2.0);
                return isNearby || isImportant;
            });
        } else {
            filteredAlerts = allAlerts.filter(function(a) {
                return (a.priority >= 50) || (a.magnitude && a.magnitude >= 2.0);
            });
        }
    } else {
        // ZOOM ALTO (11+): Mostrar TODAS las alertas cercanas
        if (userLocation && userLocation.lat) {
            filteredAlerts = allAlerts.filter(function(a) {
                return isWithinRadius(a.lat, a.lon, userLocation.lat, userLocation.lon, radiusKm);
            });
        } else {
            filteredAlerts = allAlerts;
        }
    }

    // Dibujar marcadores filtrados
    filteredAlerts.forEach(function(a) {
        if (a.lat == null || a.lon == null) return;
        
        var color = a.color || '#FF9500';
        var distStr = a.distKm != null ? '<br><small>📏 ' + a.distKm + ' km de ti</small>' : '';
        var timeStr = a.time ? '<br><small>🕐 ' + formatTime(a.time) + '</small>' : '';
        
        var popup = '<div style="min-width:200px;font-family:sans-serif">'
            +'<div style="color:'+color+';font-weight:700;font-size:13px">'
            +(a.icon||'')+ ' ' + (a.type||'') + '</div>'
            +'<div style="font-weight:600;font-size:13px;margin:4px 0">' + a.title + '</div>'
            +(a.description ? '<div style="font-size:11px;color:#888;margin-bottom:4px">'
                +a.description.substring(0,150)+'</div>' : '')
            +'<div style="font-size:11px;color:#666">📡 '+a.source+distStr+timeStr+'</div>'
            +(a.link ? '<br><a href="'+a.link+'" target="_blank" style="font-size:11px;color:#0A84FF">Ver más →</a>' : '')
            +'</div>';
        
        var marker = L.marker([a.lat, a.lon], { icon: getMapIcon(a) })
            .addTo(leafletMap)
            .bindPopup(popup, { maxWidth: 250 });
        mapMarkers.push(marker);
    });
    
    // Mostrar indicador de filtrado
    var indicator = document.getElementById('filterIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'filterIndicator';
        indicator.style.cssText = 'position:absolute;bottom:20px;right:20px;background:#1a1a1a;color:#0f0;'
            +'padding:10px 15px;border-radius:8px;font-size:12px;z-index:1000;border:1px solid #0f0;font-family:monospace;';
        document.body.appendChild(indicator);
    }
    
    var zoomLabel = '';
    if (currentZoom <= 6) zoomLabel = 'GLOBAL (críticas)';
    else if (currentZoom <= 10) zoomLabel = 'REGIONAL';
    else zoomLabel = 'DETALLE';
    
    indicator.innerHTML = 'Zoom: ' + zoomLabel + '<br>' + filteredAlerts.length + ' de ' + allAlerts.length + ' alertas';
}

function setupMapZoomListener() {
    if (!leafletMap) return;
    leafletMap.on('zoomend', function() {
        var userLoc = getActiveLocation();
        updateMapMarkersSmartZoom(externalAlerts, userLoc);
    });
}

function startMapAutoRefreshFixed() {
    if (mapRefreshInterval) clearInterval(mapRefreshInterval);
    mapRefreshInterval = setInterval(function() {
        if (mapInitialized && leafletMap && externalAlerts) {
            var userLoc = getActiveLocation();
            updateMapMarkersSmartZoom(externalAlerts, userLoc);
        }
    }, 120000);
}

function updateMapGlobalFixed(allAlerts) {
    if (!mapInitialized || !leafletMap) return;
    var currentZoom = leafletMap.getZoom();
    if (currentZoom <= 6) {
        var globalAlerts = allAlerts.filter(function(a) {
            return (a.priority >= 40) || (a.magnitude && a.magnitude >= 2.0);
        });
        console.log('🌍 Alertas globales visibles:', globalAlerts.length);
    }
}

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
    if (!centerLat || !centerLon || !eventLat || !eventLon) return true;
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
function playWhistle() {
    var ctx = getAudio(); if (!ctx) { showToast('⚠️ Audio no disponible'); return; }
    try {
        [2200, 2200, 2200].forEach(function(f, i) {
            var o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'sine'; o.frequency.value = f;
            g.gain.setValueAtTime(0, ctx.currentTime + i*0.5);
            g.gain.linearRampToValueAtTime(0.7, ctx.currentTime + i*0.5 + 0.05);
            g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i*0.5 + 0.4);
            o.start(ctx.currentTime + i*0.5);
            o.stop(ctx.currentTime + i*0.5 + 0.4);
        });
        showToast('🔊 Silbato SOS emitido');
    } catch(e) {}
}

// ========== STATUS ==========
function updateStatus(isThreat, text) {
    threatDetected = isThreat;
    var dot = document.querySelector('.status-dot');
    var txt = document.getElementById('statusText');
    if (dot) dot.className = 'status-dot ' + (isThreat ? 'danger' : 'safe');
    if (txt) txt.textContent = text || (isThreat ? 'AMENAZA DETECTADA' : 'Entorno Seguro');
}

// ========== LANGUAGE ==========
function changeLanguage(lang) {
    setLanguage(lang);
    closePopups();
    showToast('🌐 Idioma actualizado');
}

// ========== NOTIFICATIONS ==========
function requestNotificationPermission() {
    if ('Notification' in window) Notification.requestPermission().then(function(p) { notifPermission = p === 'granted'; });
}
function sendNotification(title, body, urgency) {
    if (notifPermission) try { new Notification(title, { body: body, icon: 'img/icon.svg' }); } catch(e) {}
    var colors = { critical: '#FF3B30', high: '#FF9500', medium: '#FFC107', info: '#0A84FF' };
    var old = document.getElementById('alertBanner'); if (old) old.remove();
    var b = document.createElement('div');
    b.id = 'alertBanner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:'+(colors[urgency]||colors.info)+';color:#fff;padding:12px 16px;z-index:9999;display:flex;align-items:center;gap:12px;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
    b.innerHTML = '<div style="flex:1"><div style="font-weight:700;font-size:14px">'+title+'</div><div style="font-size:12px;opacity:0.9;margin-top:2px">'+body+'</div></div><button onclick="this.parentNode.remove()" style="background:#fff;border:none;border-radius:8px;padding:6px 8px;cursor:pointer;color:#000;font-weight:700">OK</button>';
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
    if (!el) return;
    el.textContent = msg; el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 2500);
}
function formatTime(ts) {
    if (!ts) return '';
    var t = typeof ts === 'string' ? new Date(ts).getTime() : ts;
    if (isNaN(t)) return ts;
    var d = Date.now() - t;
    var dt = new Date(t);
    var day   = String(dt.getDate()).padStart(2,'0');
    var month = String(dt.getMonth()+1).padStart(2,'0');
    var year  = dt.getFullYear();
    var hour  = String(dt.getHours()).padStart(2,'0');
    var min   = String(dt.getMinutes()).padStart(2,'0');
    var dateStr = day+'/'+month+'/'+year+' '+hour+':'+min;
    if (d < 60000)     return 'Hace menos de 1 min · '+dateStr;
    if (d < 3600000)   return 'Hace '+Math.floor(d/60000)+' min · '+dateStr;
    if (d < 86400000)  return 'Hace '+Math.floor(d/3600000)+'h · '+dateStr;
    if (d < 172800000) return 'Ayer · '+dateStr;
    return dateStr;
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

// ========== RENDER FAVORITES ==========
function renderFavorites() {
    var locs = LocationManager.getAll();
    var list = document.getElementById('favoritesList');
    var empty = document.getElementById('favoritesEmpty');
    if (!list) return;
    if (!locs.length) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';
    list.innerHTML = locs.map(function(l) {
        var sn = l.name.replace(/'/g,"\\'"), sc = (l.country||'').replace(/'/g,"\\'");
        return '<div class="saved-loc">'
            +'<button class="saved-loc-btn" onclick="selectLocation({name:\''+sn+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+sc+'\'});closePopups()">📍 '+l.name+(l.country?' <small style=\'color:var(--text-muted)\'>'+l.country+'</small>':'')+'</button>'
            +'<button class="saved-del-btn" onclick="removeSavedLocation(\''+sn+'\')">🗑️</button>'
            +'</div>';
    }).join('');
}

// ========== UI SETUP ==========
function setupTabs() {
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
            document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
            this.classList.add('active');
            var panel = document.getElementById('panel-'+this.dataset.tab);
            if (panel) panel.classList.add('active');
            if (this.dataset.tab === 'mapa' && !mapInitialized) initMap();
            else if (this.dataset.tab === 'mapa' && leafletMap) setTimeout(function(){leafletMap.invalidateSize();},200);
            if (this.dataset.tab === 'tips') refreshSmartTips();
        });
    });
}

function setupLocationButtons() {
    var btnMyLoc = document.getElementById('btnMyLocation');
    if (btnMyLoc) btnMyLoc.addEventListener('click', function() {
        // Limpiar todo — forzar detección fresca, ignorar última conocida
        focusLocation = { lat: null, lon: null, name: '', country: '' };
        deviceLocation = { lat: null, lon: null, name: '', country: '', accuracy: null };
        try { localStorage.removeItem('ag_last_known'); } catch(e) {}
        saveFocusLocation();
        var el = document.getElementById('currentLocationName');
        if (el) el.textContent = 'Detectando...';
        showToast('📡 Buscando tu ubicación real...');
        // Parar watch anterior si existe
        if (geoWatchId !== null) {
            navigator.geolocation.clearWatch(geoWatchId);
            geoWatchId = null;
        }
        // Siempre re-detectar desde cero
        initLocation();
    });
    var btnSearch = document.getElementById('btnSearchLocation');
    if (btnSearch) btnSearch.addEventListener('click', openSearch);
    var btnWeatherLoc = document.getElementById('btnWeatherLocation');
    if (btnWeatherLoc) btnWeatherLoc.addEventListener('click', function() {
        focusLocation = { lat: null, lon: null, name: '', country: '' };
        saveFocusLocation();
        updateLocationUI();
        if (deviceLocation.lat) loadWeather(deviceLocation.lat, deviceLocation.lon);
        showToast('📍 Usando tu ubicación actual');
    });
    var btnWeatherSearch = document.getElementById('btnWeatherSearch');
    if (btnWeatherSearch) btnWeatherSearch.addEventListener('click', openSearch);

    var btnStarAlert = document.getElementById('btnStarAlert');
    if (btnStarAlert) btnStarAlert.addEventListener('click', function() {
        var loc = getActiveLocation();
        if (!loc.lat) { showToast('⚠️ Sin ubicación para guardar'); return; }
        var saved = LocationManager.save({ name: loc.name||'Mi ubicación', lat: loc.lat, lon: loc.lon, country: loc.country||'' });
        showToast(saved ? '⭐ Guardado en favoritos' : 'Ya está guardado');
        renderFavorites();
    });
    var btnStarWeather = document.getElementById('btnStarWeather');
    if (btnStarWeather) btnStarWeather.addEventListener('click', function() {
        var loc = getActiveLocation();
        if (!loc.lat) { showToast('⚠️ Sin ubicación para guardar'); return; }
        var saved = LocationManager.save({ name: loc.name||'Mi ubicación', lat: loc.lat, lon: loc.lon, country: loc.country||'' });
        showToast(saved ? '⭐ Guardado en favoritos' : 'Ya está guardado');
        renderFavorites();
    });

    // Radius popup
    var lbl = document.getElementById('radiusLabel');
    var sel = document.getElementById('radiusSelect');
    var radiusPopup = document.getElementById('radiusPopup');
    if (lbl) {
        var storedKm = localStorage.getItem('ag_radius_km') || '500';
        lbl.textContent = storedKm === '0' ? 'Global' : storedKm + ' km';
    }
    if (sel) sel.value = String(localStorage.getItem('ag_radius_km') || '500');
    var btnRadius = document.getElementById('btnRadius');
    if (btnRadius && radiusPopup) btnRadius.addEventListener('click', function() { radiusPopup.style.display='flex'; });
    var closeRadius = document.getElementById('closeRadius');
    if (closeRadius && radiusPopup) closeRadius.addEventListener('click', function(){ radiusPopup.style.display='none'; });
    var saveRadius = document.getElementById('saveRadiusBtn');
    if (saveRadius) saveRadius.addEventListener('click', function(){
        var v = document.getElementById('radiusSelect').value;
        setUserRadiusKm(parseInt(v,10));
        if (lbl) lbl.textContent = (v==='0') ? 'Global' : v + ' km';
        if (radiusPopup) radiusPopup.style.display='none';
        loadAlerts();
        showToast('📏 Radio: '+(v==='0'?'Global':v+' km'));
    });
}

function setupLanguageSelector() {
    var btnLang = document.getElementById('btnLang');
    var langPopup = document.getElementById('langPopup');
    if (btnLang && langPopup) btnLang.addEventListener('click', function() { closePopups(); langPopup.style.display='flex'; });
    var closeLang = document.getElementById('closeLang');
    if (closeLang) closeLang.addEventListener('click', closePopups);
    document.querySelectorAll('.lang-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { changeLanguage(this.dataset.lang); });
    });
    if (langPopup) langPopup.addEventListener('click', function(e) { if (e.target===this) closePopups(); });
}

function setupThemeSelector() {
    var btnTheme = document.getElementById('btnTheme');
    var themePopup = document.getElementById('themePopup');
    if (btnTheme && themePopup) btnTheme.addEventListener('click', function() { closePopups(); themePopup.style.display='flex'; });
    var closeTheme = document.getElementById('closeTheme');
    if (closeTheme) closeTheme.addEventListener('click', closePopups);
    if (themePopup) themePopup.addEventListener('click', function(e) { if (e.target===this) closePopups(); });
}

function setupFavorites() {
    var btnFav = document.getElementById('btnFavorites');
    var favPopup = document.getElementById('favoritesPopup');
    if (btnFav && favPopup) btnFav.addEventListener('click', function() { closePopups(); renderFavorites(); favPopup.style.display='flex'; });
    var closeFav = document.getElementById('closeFavorites');
    if (closeFav) closeFav.addEventListener('click', closePopups);
    if (favPopup) favPopup.addEventListener('click', function(e) { if (e.target===this) closePopups(); });
}

function setupSOS() {
    var btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) btnRefresh.addEventListener('click', function() {
        loadAlerts();
        var loc = getActiveLocation();
        if (loc.lat) loadWeather(loc.lat, loc.lon);
        showToast('🔄 Actualizando...');
    });

    // SOS popup close
    var closeSos = document.getElementById('closeSos');
    if (closeSos) closeSos.addEventListener('click', closePopups);
    var sosPopup = document.getElementById('sosPopup');
    if (sosPopup) sosPopup.addEventListener('click', function(e){ if(e.target===this) closePopups(); });

    // Share popup
    setupSharePopup();

    // Online/offline banner
    window.addEventListener('online', function() {
        var t = document.getElementById('sosConnText');
        if (t) t.textContent = 'Modo Online — Datos en tiempo real';
        showToast('📶 Conexión restaurada');
    });
    window.addEventListener('offline', function() {
        var t = document.getElementById('sosConnText');
        if (t) t.textContent = 'Modo Offline — Sin conexión';
        showToast('⚠️ Sin conexión a internet');
    });
}

function setupSharePopup() {
    var closeShare = document.getElementById('closeShare');
    if (closeShare) closeShare.addEventListener('click', closePopups);
    var sharePopup = document.getElementById('sharePopup');
    if (sharePopup) sharePopup.addEventListener('click', function(e){ if(e.target===this) closePopups(); });

    var whatsapp = document.getElementById('shareWhatsapp');
    if (whatsapp) whatsapp.addEventListener('click', function() {
        if (currentShareData) window.open('https://wa.me/?text='+encodeURIComponent(currentShareData), '_blank');
    });
    var twitter = document.getElementById('shareTwitter');
    if (twitter) twitter.addEventListener('click', function() {
        if (currentShareData) window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(currentShareData.substring(0,280)), '_blank');
    });
    var telegram = document.getElementById('shareTelegram');
    if (telegram) telegram.addEventListener('click', function() {
        if (currentShareData) window.open('https://t.me/share/url?url=https://appcml.github.io/AlertaGlobal/&text='+encodeURIComponent(currentShareData), '_blank');
    });
    var copyBtn = document.getElementById('shareCopy');
    if (copyBtn) copyBtn.addEventListener('click', function() {
        if (currentShareData) {
            navigator.clipboard.writeText(currentShareData).then(function(){ showToast('📋 Copiado'); }).catch(function(){
                var ta = document.createElement('textarea');
                ta.value = currentShareData;
                document.body.appendChild(ta); ta.select();
                document.execCommand('copy'); document.body.removeChild(ta);
                showToast('📋 Copiado');
            });
        }
        closePopups();
    });
    var nativeBtn = document.getElementById('shareNative');
    if (navigator.share && nativeBtn) {
        nativeBtn.style.display = 'flex';
        nativeBtn.addEventListener('click', function() {
            if (currentShareData) navigator.share({ title: 'Alerta Global', text: currentShareData, url: 'https://appcml.github.io/AlertaGlobal/' }).catch(function(){});
        });
    }
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
    var q = (document.getElementById('searchInput') || {}).value;
    if (!q || q.trim().length < 2) return;
    q = q.trim();
    var r = document.getElementById('searchResults');
    if (!r) return;
    r.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    LocationManager.search(q).then(function(locs) {
        if (!locs.length) { r.innerHTML='<p style="text-align:center;color:#666;padding:16px">Sin resultados para "'+q+'"</p>'; return; }
        r.innerHTML = locs.map(function(l) {
            return '<button class="search-result" onclick="selectLocation({name:\''+l.name.replace(/'/g,"\\'")+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+l.country.replace(/'/g,"\\'")+'\'})">'
                +'<strong>'+l.name+'</strong><br><small>'+l.fullName+'</small></button>';
        }).join('');
    }).catch(function(e) { r.innerHTML='<p style="color:#FF3B30;padding:16px">Error al buscar: '+e.message+'</p>'; });
}

function openSearch() {
    closePopups();
    var popup = document.getElementById('searchPopup');
    if (popup) popup.style.display = 'flex';
    setTimeout(function() { var inp = document.getElementById('searchInput'); if (inp) inp.focus(); }, 100);
}

function selectLocation(loc) {
    focusLocation = { lat: loc.lat, lon: loc.lon, name: loc.name, country: loc.country||'' };
    saveFocusLocation();
    // Guardar en localStorage para restaurar al reabrir la app
    try {
        localStorage.setItem('ag_last_selected', JSON.stringify({
            lat: loc.lat, lon: loc.lon,
            name: loc.name, country: loc.country||'',
            ts: Date.now()
        }));
    } catch(e) {}
    updateLocationUI();
    closePopups();
    if (typeof resetAICache === 'function') resetAICache();
    loadAlerts();
    loadWeather(loc.lat, loc.lon);
    showToast('📍 '+loc.name);
    var inp = document.getElementById('searchInput');
    if (inp) inp.value = '';
    var res = document.getElementById('searchResults');
    if (res) res.innerHTML = '';
}

function updateLocationUI() {
    var loc = getActiveLocation();
    var el1 = document.getElementById('currentLocationName');
    var el2 = document.getElementById('weatherLocationName');
    var btnMyLoc = document.getElementById('btnMyLocation');
    var btnWeatherLoc = document.getElementById('btnWeatherLocation');

    if (!loc.lat) {
        // Sin ubicación aún → botón invita a detectar
        if (el1) el1.textContent = 'Detectar mi ubicación';
        if (el2) el2.textContent = 'Detectar mi ubicación';
        if (btnMyLoc) btnMyLoc.title = 'Toca para detectar tu ubicación';
    } else {
        // Tenemos ubicación — mostrar nombre + indicador de precisión
        var name = loc.name || (loc.lat.toFixed(3) + ', ' + loc.lon.toFixed(3));
        var precIcon = '';
        if (loc === deviceLocation) {
            var acc = deviceLocation.accuracy || 99999;
            if (acc <= 100)        precIcon = ' 🛰️';   // GPS preciso
            else if (acc <= 2000)  precIcon = ' 📶';   // Red/WiFi
            else if (acc <= 20000) precIcon = ' 📡';   // Torres celulares
            else                   precIcon = ' 🌐';   // IP aproximada
        }
        if (el1) el1.textContent = name + (focusLocation.lat ? '' : precIcon);
        if (el2) el2.textContent = name + (focusLocation.lat ? '' : precIcon);
    }

    // Estrella
    ['btnStarAlert','btnStarWeather'].forEach(function(id) {
        var b = document.getElementById(id);
        if (b) b.textContent = focusLocation.lat ? '⭐' : '☆';
    });
}

// ========== RESTAURAR ÚLTIMA UBICACIÓN ==========
function showLocationRestoreDialog(lastLoc) {
    // Crear banner de restauración
    var banner = document.createElement('div');
    banner.id = 'locationRestoreBanner';
    banner.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);'
        + 'background:var(--surface2);border:1px solid var(--card-border);border-radius:16px;'
        + 'padding:14px 16px;z-index:9990;width:90%;max-width:400px;'
        + 'box-shadow:0 8px 24px rgba(0,0,0,0.4);';
    banner.innerHTML = '<div style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:6px">'
        + '📍 ¿Continuar en ' + lastLoc.name + '?'
        + '</div>'
        + '<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">'
        + 'Tu última ubicación revisada. ¿Deseas continuar aquí o actualizar tu ubicación real?'
        + '</div>'
        + '<div style="display:flex;gap:8px">'
        + '<button onclick="restoreLastLocation()" style="flex:1;background:var(--accent);'
        + 'border:none;border-radius:10px;padding:10px;font-weight:700;cursor:pointer;color:#000;font-size:13px">'
        + '✅ Continuar aquí'
        + '</button>'
        + '<button onclick="updateRealLocation()" style="flex:1;background:var(--surface);'
        + 'border:1px solid var(--card-border);border-radius:10px;padding:10px;'
        + 'font-weight:700;cursor:pointer;color:var(--text);font-size:13px">'
        + '📡 Mi ubicación real'
        + '</button>'
        + '</div>';
    document.body.appendChild(banner);

    // Auto-cerrar después de 15 segundos y usar ubicación real
    setTimeout(function() {
        if (document.getElementById('locationRestoreBanner')) {
            updateRealLocation();
        }
    }, 15000);
}

function restoreLastLocation() {
    var banner = document.getElementById('locationRestoreBanner');
    if (banner) banner.remove();
    try {
        var lastSel = JSON.parse(localStorage.getItem('ag_last_selected'));
        if (lastSel && lastSel.lat) {
            selectLocation(lastSel);
            showToast('📍 Continuando en ' + lastSel.name);
        }
    } catch(e) {}
}

function updateRealLocation() {
    var banner = document.getElementById('locationRestoreBanner');
    if (banner) banner.remove();
    try {
        localStorage.removeItem('ag_last_selected');
        localStorage.removeItem('ag_focus');
    } catch(e) {}
    focusLocation = { lat: null, lon: null, name: '', country: '' };
    initLocation();
    showToast('📡 Detectando tu ubicación real...');
}

// ========== GEOLOCATION ==========
// ============================================================
// GEOLOCALIZACIÓN MULTICAPA — 4 capas de fallback
// Capa 1: WiFi/Red móvil   (enableHighAccuracy: false)
// Capa 2: GPS              (enableHighAccuracy: true)
// Capa 3: IP geolocation   (api sin permisos del navegador)
// Capa 4: Última conocida  (localStorage)
// Para APK nativo: se añaden WiFi Direct y Bluetooth vía hooks
// ============================================================

function saveLastKnownLocation(lat, lon, name, country) {
    try {
        localStorage.setItem('ag_last_known', JSON.stringify({
            lat: lat, lon: lon, name: name, country: country, ts: Date.now()
        }));
    } catch(e) {}
}

function loadLastKnownLocation() {
    try {
        var d = JSON.parse(localStorage.getItem('ag_last_known'));
        // Solo usar si tiene menos de 24 horas
        if (d && d.lat && (Date.now() - d.ts) < 86400000) return d;
    } catch(e) {}
    return null;
}

function applyDeviceLocation(lat, lon, acc, label) {
    deviceLocation.lat = lat;
    deviceLocation.lon = lon;
    deviceLocation.accuracy = acc;
    console.log('📍 Ubicación [' + label + ']:', lat.toFixed(4), lon.toFixed(4), '±' + Math.round(acc) + 'm');

    // Actualizar UI inmediatamente con coordenadas mientras llega el nombre
    updateLocationUI();
    if (!focusLocation.lat) {
        loadAlerts();
        loadWeather(lat, lon);
    }

    // Reverse geocode para obtener nombre de ciudad
    if (typeof LocationManager !== 'undefined' && LocationManager.reverseGeocode) {
        LocationManager.reverseGeocode(lat, lon).then(function(geo) {
            deviceLocation.name = geo.city || (lat.toFixed(2) + ', ' + lon.toFixed(2));
            deviceLocation.country = geo.country || '';
            saveLastKnownLocation(lat, lon, deviceLocation.name, deviceLocation.country);
            updateLocationUI();
        }).catch(function() {
            deviceLocation.name = lat.toFixed(2) + ', ' + lon.toFixed(2);
            updateLocationUI();
        });
    } else {
        // LocationManager aún no cargó — usar BigDataCloud directamente
        fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude='+lat+'&longitude='+lon+'&localityLanguage=es')
            .then(function(r) { return r.json(); })
            .then(function(d) {
                deviceLocation.name = d.city || d.locality || d.principalSubdivision || (lat.toFixed(2)+', '+lon.toFixed(2));
                deviceLocation.country = d.countryName || '';
                saveLastKnownLocation(lat, lon, deviceLocation.name, deviceLocation.country);
                updateLocationUI();
            })
            .catch(function() {
                deviceLocation.name = lat.toFixed(2) + ', ' + lon.toFixed(2);
                updateLocationUI();
            });
    }
}

function startWatchPosition() {
    if (geoWatchId !== null) return;
    geoWatchId = navigator.geolocation.watchPosition(
        function(p) {
            var lat = p.coords.latitude;
            var lon = p.coords.longitude;
            var acc = p.coords.accuracy;
            var prevAcc = deviceLocation.accuracy || 99999;
            // Actualizar si mejoró la precisión 30%+ o nos movimos >500m
            if (acc < prevAcc * 0.7 || !deviceLocation.lat ||
                calcDistance(lat, lon, deviceLocation.lat || lat, deviceLocation.lon || lon) > 0.5) {
                applyDeviceLocation(lat, lon, acc, 'watch');
            }
        },
        function(err) {
            if (err.code === err.TIMEOUT) {
                navigator.geolocation.clearWatch(geoWatchId);
                geoWatchId = null;
                setTimeout(startWatchPosition, 5000);
            }
        },
        { enableHighAccuracy: false, timeout: Infinity, maximumAge: 10000 } // Cell ID + WiFi, bajo consumo
    );
}

function initLocation() {
    var el = document.getElementById('currentLocationName');
    if (el) el.textContent = 'Detectando...';
    var el2 = document.getElementById('weatherLocationName');
    if (el2) el2.textContent = 'Detectando...';

    var bestAccuracy = 99999;
    var geoTimeout = null;

    function applyIfBetter(lat, lon, acc, label) {
        if (acc < bestAccuracy) {
            bestAccuracy = acc;
            console.log('✅ [' + label + ']:', lat.toFixed(4), lon.toFixed(4), '±' + Math.round(acc) + 'm');
            applyDeviceLocation(lat, lon, acc, label);
            if (geoTimeout) { clearTimeout(geoTimeout); geoTimeout = null; }
        }
    }

    // ── CAPA 4: Última conocida — solo texto visual ──
    var last = loadLastKnownLocation();
    if (last) {
        var elL = document.getElementById('currentLocationName');
        if (elL) elL.textContent = '⏳ ' + last.name + '...';
        var elL2 = document.getElementById('weatherLocationName');
        if (elL2) elL2.textContent = '⏳ ' + last.name + '...';
    }

    // Si en 20s no hay señal → modo global
    geoTimeout = setTimeout(function() {
        if (!deviceLocation.lat) showNoGPSMessage();
    }, 20000);

    // ── CAPA 3: IP — inmediata, en paralelo, sin permisos ──
    geolocByIP(function(lat, lon, acc, label) {
        applyIfBetter(lat, lon, acc, label);
    });

    if (!navigator.geolocation) return;

    // ── CAPA 1: Antenas celulares (Cell ID) + WiFi ──
    // enableHighAccuracy:false → navegador consulta:
    //   • Torres celulares cercanas (MCC+MNC+LAC+CellID)
    //   • Redes WiFi cercanas (BSSID del router)
    // Responde en 1-3s, precisión 50m-2km, bajo consumo batería
    navigator.geolocation.getCurrentPosition(
        function(pos) {
            var acc = pos.coords.accuracy;
            console.log('📶 Antenas/WiFi: ±' + Math.round(acc) + 'm');
            applyIfBetter(pos.coords.latitude, pos.coords.longitude, acc, 'Antenas/WiFi');
            startWatchPosition();
            // ── CAPA 2: GPS — si precisión de antenas es >300m ──
            if (acc > 300) tryGPS(applyIfBetter);
        },
        function(err) {
            console.log('Antenas/WiFi falló (code ' + err.code + ')');
            // ── CAPA 2: GPS directo ──
            tryGPS(applyIfBetter);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
}

function tryGPS(applyIfBetter) {
    if (!navigator.geolocation) return;
    console.log('🛰️ Intentando GPS...');
    navigator.geolocation.getCurrentPosition(
        function(pos) {
            var acc = pos.coords.accuracy;
            console.log('🛰️ GPS:', pos.coords.latitude, pos.coords.longitude, '±' + Math.round(acc) + 'm');
            if (applyIfBetter) applyIfBetter(pos.coords.latitude, pos.coords.longitude, acc, 'GPS ±' + Math.round(acc) + 'm');
            else applyDeviceLocation(pos.coords.latitude, pos.coords.longitude, acc, 'GPS');
            startWatchPosition();
        },
        function(err) {
            console.log('GPS falló (code ' + err.code + '):', err.message);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

function geolocByIP(callback) {
    // APIs que soportan CORS nativo — no necesitan proxy
    // Se intentan en orden hasta que una responda
    var apis = [
        {
            // geojs.io — CORS nativo, muy confiable
            url: 'https://get.geojs.io/v1/ip/geo.json',
            direct: true,
            parse: function(d) {
                return (d.latitude) ? {
                    lat: parseFloat(d.latitude),
                    lon: parseFloat(d.longitude),
                    city: d.city || d.region
                } : null;
            }
        },
        {
            // geolocation-db.com — CORS nativo
            url: 'https://geolocation-db.com/json/',
            direct: true,
            parse: function(d) {
                return (d.latitude && d.latitude !== 'Not found') ? {
                    lat: d.latitude,
                    lon: d.longitude,
                    city: d.city || d.state
                } : null;
            }
        },
        {
            // ipapi.co — via proxy allorigins
            url: 'https://ipapi.co/json/',
            direct: false,
            parse: function(d) {
                return d.latitude ? {
                    lat: d.latitude, lon: d.longitude,
                    city: d.city || d.region
                } : null;
            }
        }
    ];

    function tryApi(i) {
        if (i >= apis.length) return;
        var api = apis[i];
        var fetchUrl = api.direct
            ? api.url
            : 'https://api.allorigins.win/get?url=' + encodeURIComponent(api.url);

        fetch(fetchUrl, { signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined })
            .then(function(r) { return r.json(); })
            .then(function(raw) {
                // allorigins envuelve en { contents: "..." }
                if (!api.direct && raw.contents) {
                    try { raw = JSON.parse(raw.contents); } catch(e) {}
                }
                var result = api.parse(raw);
                if (result && result.lat) {
                    console.log('📡 IP geoloc [' + api.url.split('/')[2] + ']:', result.city, result.lat, result.lon);
                    if (callback) callback(result.lat, result.lon, 50000, 'IP:' + (result.city || ''));
                    else applyDeviceLocation(result.lat, result.lon, 50000, 'IP');
                } else {
                    tryApi(i + 1);
                }
            })
            .catch(function() { tryApi(i + 1); });
    }
    tryApi(0);
}

// ── HOOKS PARA APK NATIVO (WiFi Direct + Bluetooth) ──
// Cuando la app se empaquete como APK con Capacitor/Cordova,
// estos hooks serán reemplazados por los plugins nativos.
var NativeLocation = {
    // WiFi Direct: dispositivos cercanos comparten ubicación entre sí
    // En APK: usa plugin cordova-plugin-wifidirect
    startWifiDirect: function() {
        if (window.WifiDirect) {
            // Nativo: busca dispositivos cercanos con la app
            window.WifiDirect.discoverPeers(function(peers) {
                peers.forEach(function(peer) {
                    // Solicitar ubicación a cada peer
                    window.WifiDirect.connect(peer.deviceAddress, function() {
                        console.log('WiFi Direct conectado a:', peer.deviceName);
                    });
                });
            });
        } else {
            console.log('WiFi Direct no disponible (requiere APK nativo)');
        }
    },
    // Bluetooth: red mesh de hasta 7 dispositivos encadenados
    // En APK: usa plugin cordova-plugin-bluetooth-serial
    startBluetooth: function() {
        if (window.bluetoothSerial) {
            window.bluetoothSerial.enable(function() {
                window.bluetoothSerial.discoverUnpaired(function(devices) {
                    devices.forEach(function(d) {
                        console.log('BT dispositivo cercano:', d.name, d.address);
                    });
                });
            });
        } else {
            console.log('Bluetooth no disponible (requiere APK nativo)');
        }
    }
};

// ── WebRTC P2P — comunicación entre dispositivos sin internet ──
// Permite que dispositivos en la misma red WiFi local compartan alertas
var MeshNetwork = {
    peers: {},
    localId: 'ag_' + Math.random().toString(36).substr(2, 8),

    // Iniciar cuando la app detecta WiFi local sin internet
    init: function() {
        if (typeof RTCPeerConnection === 'undefined') return;
        console.log('🌐 Mesh local ID:', MeshNetwork.localId);
        // En modo offline, usar BroadcastChannel para tabs del mismo navegador
        if (typeof BroadcastChannel !== 'undefined') {
            MeshNetwork.channel = new BroadcastChannel('alerta_global_mesh');
            MeshNetwork.channel.onmessage = function(e) {
                MeshNetwork.onPeerMessage(e.data);
            };
        }
    },

    broadcast: function(data) {
        data.from = MeshNetwork.localId;
        data.ts = Date.now();
        // BroadcastChannel: comparte entre tabs del mismo navegador
        if (MeshNetwork.channel) {
            MeshNetwork.channel.postMessage(data);
        }
        // localStorage: persiste para otros dispositivos en la misma app
        try {
            var msgs = JSON.parse(localStorage.getItem('ag_mesh_msgs') || '[]');
            msgs.push(data);
            if (msgs.length > 50) msgs = msgs.slice(-50);
            localStorage.setItem('ag_mesh_msgs', JSON.stringify(msgs));
        } catch(e) {}
    },

    onPeerMessage: function(data) {
        if (!data || data.from === MeshNetwork.localId) return;
        console.log('🌐 Mesh mensaje de', data.from, ':', data.type);
        if (data.type === 'location') {
            // Otro dispositivo compartió su ubicación
            showToast('📍 Dispositivo cercano: ' + (data.name || data.from));
        }
        if (data.type === 'alert') {
            // Otro dispositivo recibió una alerta — replicar
            showToast('🚨 Alerta recibida por red local: ' + data.title);
        }
    },

    shareMyLocation: function() {
        var loc = getActiveLocation();
        if (!loc.lat) return;
        MeshNetwork.broadcast({
            type: 'location',
            lat: loc.lat, lon: loc.lon,
            name: loc.name, country: loc.country,
            accuracy: deviceLocation.accuracy
        });
    }
};

function showNoGPSMessage() {
    var el = document.getElementById('currentLocationName');
    if (el) el.textContent = '🌐 Global — usa Buscar para tu zona';
    var el2 = document.getElementById('weatherLocationName');
    if (el2) el2.textContent = '🌐 Global — usa Buscar';
    showToast('🌐 Mostrando alertas globales. Usa 🔍 para tu ciudad.');
    loadAlerts();
}

// ========== ALERTS ==========
function loadAlerts() {
    if (alertsLoading) return;
    var loc = getActiveLocation();

    // Si aún no tenemos ubicación, esperar hasta 8s antes de cargar global
    if (!loc.lat && !deviceLocation.lat) {
        var waited = (loadAlerts._waitCount || 0);
        if (waited < 8) {
            loadAlerts._waitCount = waited + 1;
            setTimeout(loadAlerts, 1000);
            return;
        }
    }
    loadAlerts._waitCount = 0;
    alertsLoading = true;

    var loading = document.getElementById('alertsLoading');
    var list = document.getElementById('alertList');
    var errEl = document.getElementById('alertsError');
    if (loading) loading.style.display = 'flex';
    if (list) list.innerHTML = '';
    if (errEl) errEl.style.display = 'none';

    if (typeof loadExternalSources !== 'function') {
        // Reintentar hasta 10 veces con 500ms entre intentos
        var retries = (loadAlerts._srcRetry || 0);
        if (retries < 10) {
            loadAlerts._srcRetry = retries + 1;
            alertsLoading = false;
            if (loading) loading.style.display = 'flex';
            setTimeout(loadAlerts, 500);
            console.warn('sources.js aún no cargó, reintento', retries + 1);
            return;
        }
        loadAlerts._srcRetry = 0;
        alertsLoading = false;
        if (loading) loading.style.display = 'none';
        if (list) list.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Error cargando fuentes. Recarga la página.</p><button onclick="location.reload()" style="margin-top:12px;padding:8px 16px;background:var(--accent);border:none;border-radius:8px;color:#000;font-weight:700;cursor:pointer">🔄 Recargar</button></div>';
        return;
    }
    loadAlerts._srcRetry = 0;

    // Si tenemos coordenadas → escaneo directo por ubicación (más preciso)
    // Si no → fetch global con filtro posterior
    var scanFn = (loc.lat && typeof scanByCoords === 'function')
        ? function(cb) { scanByCoords(loc.lat, loc.lon, getUserRadiusKm() || 500, cb); }
        : loadExternalSources;

    scanFn(function(alerts) {
        alertsLoading = false;
        externalAlerts = alerts || [];
        if (loading) loading.style.display = 'none';

        // ── FILTRO INTELIGENTE POR PROXIMIDAD ──
        // Orden: localidad → comuna → provincia → país → global
        var userRegion = (typeof getRegionFromLocation === 'function')
            ? getRegionFromLocation(loc) : null;
        var userInChile = userRegion !== null ||
            (loc.country && /chile/i.test(loc.country));

        // Radios por nivel de filtro
        var RADIO_LOCAL    = 50;    // localidad (50km)
        var RADIO_COMUNA   = 150;   // comuna (150km)
        var RADIO_PROV     = 300;   // provincia (300km)
        var RADIO_PAIS     = getUserRadiusKm() || 500; // país

        function alertScore(a) {
            // Puntaje: cuánto es local para el usuario
            if (!loc.lat || a.lat == null) return 0;
            var d = calcDistance(loc.lat, loc.lon, a.lat, a.lon);
            if (d <= RADIO_LOCAL)  return 4; // localidad
            if (d <= RADIO_COMUNA) return 3; // comuna
            if (d <= RADIO_PROV)   return 2; // provincia
            if (d <= RADIO_PAIS)   return 1; // país
            return 0;
        }

        var radius = getUserRadiusKm() || 500;

        var filtered = externalAlerts.filter(function(a) {
            // Sin ubicación del usuario → mostrar todo
            if (!loc.lat) return true;
            // Radio global → mostrar todo
            if (radius === 0) return true;

            // ── Alertas CON coordenadas → filtrar por distancia real ──
            if (a.lat != null && a.lon != null) {
                var d = calcDistance(loc.lat, loc.lon, a.lat, a.lon);
                a.distKm = d;
                return d <= radius;
            }

            // ── Alertas SIN coordenadas — incluir por tipo ──
            var src = a.source || '';
            var type = a.type || '';

            // Fuentes chilenas: solo si usuario está en Chile
            if (/SENAPRED|CONAF|SHOA|CSN/i.test(src)) return userInChile;

            // MET Norway: ya filtrada por coords en la API → siempre incluir
            if (/MET Norway/i.test(src)) return true;

            // Open-Meteo: clima de las coords exactas → siempre incluir
            if (/Open-Meteo/i.test(src)) return true;

            // NASA EONET: eventos globales por satélite → incluir si alta prioridad
            if (/NASA EONET/i.test(src)) return a.priority >= 40;

            // VolcanoDiscovery: volcanes globales → incluir si moderada prioridad
            if (/VolcanoDiscovery/i.test(src)) return a.priority >= 40;

            // PTWC: tsunamis Pacífico → siempre incluir (afecta costas lejanas)
            if (/PTWC/i.test(src)) return true;

            // NHC Huracanes: incluir si son importantes
            if (/NHC/i.test(src)) return a.priority >= 50;

            // ReliefWeb: desastres declarados → incluir si son urgentes
            if (/ReliefWeb/i.test(src)) return a.priority >= 50;

            // GDACS: incluir si tiene prioridad suficiente
            if (/GDACS/i.test(src)) return a.priority >= 50;

            // NOAA Clima Espacial: siempre incluir
            if (/NOAA.*Espac|Space Weather/i.test(src)) return true;

            // Resto sin coords: prioridad mínima baja
            return a.priority >= 50;
        });

        // ── FILTRO POR TIPO Y MAGNITUD (desde UI) ──
        var uiType = (document.getElementById('filterType') || {}).value || 'todos';
        var uiMag  = parseFloat((document.getElementById('filterMagnitude') || {}).value || '0');

        var typeMap = {
            'earthquake': ['SISMO'],
            'tsunami':    ['TSUNAMI'],
            'hurricane':  ['HURACÁN','CICLÓN','TIFÓN'],
            'volcano':    ['VOLCÁN','ERUPCIÓN'],
            'storm':      ['TORMENTA','ALERTA CLIMÁTICA','VIENTO FUERTE','LLUVIA INTENSA'],
            'flood':      ['INUNDACIÓN'],
            'landslide':  ['DESLIZAMIENTO'],
            'fire':       ['INCENDIO']
        };

        if (uiType !== 'todos') {
            var allowed = typeMap[uiType] || [];
            filtered = filtered.filter(function(a) {
                return allowed.some(function(t) {
                    return (a.type || '').toUpperCase().includes(t);
                });
            });
        }

        if (uiMag > 0) {
            filtered = filtered.filter(function(a) {
                if ((a.type || '').toUpperCase().includes('SISMO')) {
                    return (a.magnitude || 0) >= uiMag;
                }
                return true;
            });
        }

        // Ordenar: prioridad crítica primero, luego más reciente
        filtered.sort(function(a, b) {
            // 1. Emergencias críticas siempre arriba (tsunami, M7+)
            var aCrit = a.priority >= 90 ? 1 : 0;
            var bCrit = b.priority >= 90 ? 1 : 0;
            if (bCrit !== aCrit) return bCrit - aCrit;
            // 2. Más reciente primero
            var tA = a.time ? new Date(a.time).getTime() : 0;
            var tB = b.time ? new Date(b.time).getTime() : 0;
            if (tB !== tA) return tB - tA;
            // 3. Mayor magnitud/prioridad como desempate
            return b.priority - a.priority;
        });

        // Mostrar indicador de localidad en las cards
        filtered.forEach(function(a) {
            if (!loc.lat || a.lat == null) return;
            var d = calcDistance(loc.lat, loc.lon, a.lat, a.lon);
            if (d <= RADIO_LOCAL)       a._localLabel = '📍 En tu zona';
            else if (d <= RADIO_COMUNA) a._localLabel = '🏘️ Cercano';
            else if (d <= RADIO_PROV)   a._localLabel = '🌐 Tu provincia';
        });

        if (!filtered.length) {
            if (list) list.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>Sin alertas activas en tu zona</p><small>Radio: '+(getUserRadiusKm()===0?'Global':getUserRadiusKm()+' km')+'</small></div>';
            updateStatus(false, 'Entorno Seguro');
            return;
        }

        var hasCritical = filtered.some(function(a) { return a.priority >= 90; });
        if (hasCritical) {
            updateStatus(true, 'AMENAZA DETECTADA');
            // Check for new alerts
            filtered.filter(function(a) { return a.priority >= 85; }).forEach(function(a) {
                var id = (a.source_id || a.title || '').substring(0,50);
                if (!seenAlertIds[id]) {
                    seenAlertIds[id] = true;
                    sendNotification('🚨 '+a.title, a.description||'', 'critical');
                    if (a.priority >= 95) playSiren();
                }
            });
        } else {
            updateStatus(false, 'Alertas activas');
        }

        if (list) list.innerHTML = filtered.map(function(a) { return renderAlertCard(a, loc); }).join('');
        updateMapMarkers(filtered);
        updateMapGlobal(externalAlerts);
        refreshSmartTips();

        // ── Análisis IA — solo si hay eventos y hay ubicación ──
        if (filtered.length > 0 && typeof analyzeAlerts === 'function') {
            var lang = (typeof currentLang !== 'undefined') ? currentLang : 'es';
            analyzeAlerts(filtered, loc, lang, function(result) {
                if (result) console.log('🤖 Análisis IA completado:', result.nivelRiesgo);
            });
        }
    });
}

function renderAlertCard(a, loc) {
    var dist = '';
    if (loc && loc.lat && a.lat != null && a.lon != null) {
        var d = calcDistance(loc.lat, loc.lon, a.lat, a.lon);
        dist = '<span class="alert-dist">📏 '+d+' km</span>';
    }
    var levelClass = a.priority >= 90 ? 'critical' : a.priority >= 70 ? 'high' : 'medium';
    var timeStr = a.time ? formatTime(a.time) : '';
    var localLabel = a._localLabel ? '<span class="alert-local-label">'+a._localLabel+'</span>' : '';
    var shareBtn = '<button class="share-alert-btn" onclick="shareAlert('+JSON.stringify(a).replace(/"/g,"'")+')">📤</button>';
    return '<div class="alert-card '+levelClass+'" style="border-left-color:'+a.color+'">'
        +'<div class="alert-header">'
        +'<span class="alert-type" style="color:'+a.color+'">'+a.icon+' '+a.type+'</span>'
        +'<div style="display:flex;align-items:center;gap:6px">'+localLabel+dist+'<span class="alert-time">'+timeStr+'</span>'+shareBtn+'</div>'
        +'</div>'
        +'<div class="alert-title">'+a.title+'</div>'
        +(a.description ? '<div class="alert-desc">'+a.description+'</div>' : '')
        +'<div class="alert-source">📡 '+a.source+'</div>'
        +'</div>';
}

function loadExternalSourcesData() {
    loadAlerts();
}

function shareAlert(alertData) {
    var text = '🚨 ALERTA: '+alertData.title+'\n'+
        (alertData.description||'')+'\n'+
        '📡 Fuente: '+alertData.source;
    currentShareData = text;
    var content = document.getElementById('shareContent');
    if (content) content.textContent = text;
    closePopups();
    var popup = document.getElementById('sharePopup');
    if (popup) popup.style.display = 'flex';
}

// ========== WEATHER ==========
function loadWeather(lat, lon) {
    var loading = document.getElementById('weatherLoading');
    var container = document.getElementById('weatherContainer');
    var errEl = document.getElementById('weatherError');
    if (loading) loading.style.display = 'flex';
    if (container) container.style.display = 'none';
    if (errEl) errEl.style.display = 'none';

    var url = CONFIG.WEATHER_URL+'?lat='+lat+'&lon='+lon+'&appid='+CONFIG.WEATHER_API_KEY+'&units=metric&lang='+(currentLang==='es'?'es':currentLang==='pt'?'pt':'en');
    fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            lastWeatherData = data;
            if (loading) loading.style.display = 'none';
            if (container) container.style.display = 'block';
            renderWeather(data);
            dataReady.weather = true;
            refreshSmartTips();
            return fetch(CONFIG.FORECAST_URL+'?lat='+lat+'&lon='+lon+'&appid='+CONFIG.WEATHER_API_KEY+'&units=metric&lang='+(currentLang==='es'?'es':'en'));
        })
        .then(function(r) { if (r) return r.json(); })
        .then(function(fc) { if (fc) { lastForecastData = fc; renderForecast(fc); } })
        .catch(function(e) {
            if (loading) loading.style.display = 'none';
            if (errEl) { errEl.textContent = '⚠️ Error al obtener el clima: '+e.message; errEl.style.display = 'block'; }
        });
}

function renderWeather(d) {
    var wCity = document.getElementById('wCity');
    var wTemp = document.getElementById('wTemp');
    var wDesc = document.getElementById('wDesc');
    var wHumidity = document.getElementById('wHumidity');
    var wWind = document.getElementById('wWind');
    var wFeels = document.getElementById('wFeels');
    var wPressure = document.getElementById('wPressure');
    var wRec = document.getElementById('wRecommendation');

    var icon = d.weather && d.weather[0] ? getWeatherIcon(d.weather[0].id) : '🌤️';
    var desc = d.weather && d.weather[0] ? d.weather[0].description : '';
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);

    if (wCity) wCity.textContent = icon+' '+(d.name||'')+' '+(d.sys&&d.sys.country?'('+d.sys.country+')':'');
    if (wTemp) wTemp.textContent = Math.round(d.main.temp)+'°C';
    if (wDesc) wDesc.textContent = desc;
    if (wHumidity) wHumidity.textContent = d.main.humidity+'%';
    if (wWind) wWind.textContent = Math.round((d.wind&&d.wind.speed||0)*3.6)+' km/h';
    if (wFeels) wFeels.textContent = Math.round(d.main.feels_like)+'°C';
    if (wPressure) wPressure.textContent = (d.main.pressure||'—')+' hPa';
    if (wRec) wRec.innerHTML = getWeatherRecommendation(d);
}

function getWeatherIcon(id) {
    if (id >= 200 && id < 300) return '⛈️';
    if (id >= 300 && id < 400) return '🌧️';
    if (id >= 500 && id < 600) return '🌧️';
    if (id >= 600 && id < 700) return '❄️';
    if (id >= 700 && id < 800) return '🌫️';
    if (id === 800) return '☀️';
    if (id === 801) return '🌤️';
    if (id >= 802) return '☁️';
    return '🌡️';
}

function getWeatherRecommendation(d) {
    var recs = [];
    var id = d.weather && d.weather[0] ? d.weather[0].id : 800;
    var temp = d.main ? d.main.temp : 20;
    var wind = d.wind ? d.wind.speed * 3.6 : 0;

    if (id >= 200 && id < 300) recs.push('⚡ Tormenta eléctrica: Evita espacios abiertos y árboles.');
    else if (id >= 500 && id < 600) recs.push('☔ Lluvia: Lleva paraguas y maneja con precaución.');
    else if (id >= 600 && id < 700) recs.push('❄️ Nevada: Usa cadenas, ropa abrigada y evita manejar.');
    else if (id >= 700 && id < 800) recs.push('🌫️ Niebla: Reduce velocidad y usa luces de cruce.');

    if (temp >= 35) recs.push('🥵 Calor extremo: Mantente hidratado y evita el sol directo.');
    else if (temp >= 30) recs.push('☀️ Calor: Bebe agua frecuentemente y usa protector solar.');
    else if (temp <= 0) recs.push('🥶 Temperatura bajo cero: Abrígate bien y cuidado con el hielo.');
    else if (temp <= 5) recs.push('🧥 Frío: Usa ropa abrigada por capas.');

    if (wind >= 60) recs.push('💨 Vientos fuertes: Evita áreas con árboles y objetos sueltos.');
    else if (wind >= 40) recs.push('🌬️ Viento moderado-fuerte: Ten cuidado al manejar.');

    if (!recs.length) recs.push('✅ Condiciones normales. Buen día.');
    return recs.map(function(r) { return '<div class="weather-rec-item">'+r+'</div>'; }).join('');
}

function renderForecast(fc) {
    var cont = document.getElementById('weatherContainer');
    if (!cont) return;
    var old = document.getElementById('wForecast');
    if (old) old.remove();

    // Take one reading per day (every 8 entries = 24h for 3h intervals)
    var days = {};
    (fc.list || []).forEach(function(item) {
        var d = new Date(item.dt * 1000);
        var key = d.toLocaleDateString('es-CL', { weekday:'short', day:'2-digit', month:'2-digit' });
        if (!days[key]) days[key] = item;
    });

    var keys = Object.keys(days).slice(0, 5);
    if (!keys.length) return;

    var html = '<div id="wForecast" style="margin-top:16px">'
        +'<div style="font-weight:700;font-size:13px;color:var(--text-secondary);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Próximos días</div>'
        +'<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">';
    keys.forEach(function(key) {
        var item = days[key];
        var icon = getWeatherIcon(item.weather[0].id);
        html += '<div style="background:var(--surface2);border-radius:10px;padding:10px 8px;text-align:center;min-width:70px;flex-shrink:0">'
            +'<div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">'+key+'</div>'
            +'<div style="font-size:20px">'+icon+'</div>'
            +'<div style="font-size:13px;font-weight:700;margin-top:4px">'+Math.round(item.main.temp)+'°</div>'
            +'</div>';
    });
    html += '</div></div>';
    cont.insertAdjacentHTML('beforeend', html);
}

// ========== SMART TIPS ==========
function refreshSmartTips() {
    var el = document.getElementById('tipsList');
    if (!el) return;
    var tips = generateTips();
    el.innerHTML = tips.map(function(t) {
        return '<div class="tip-card" style="border-left-color:'+t.color+'">'
            +'<div class="tip-header"><span class="tip-icon">'+t.icon+'</span><span class="tip-title">'+t.title+'</span></div>'
            +'<div class="tip-body">'+t.tips.map(function(tip) { return '<div class="tip-item">• '+tip+'</div>'; }).join('')+'</div>'
            +'</div>';
    }).join('');
}

function generateTips() {
    var tips = [];
    var hasEq = false, hasFlood = false, hasFire = false, hasTsunami = false, hasStorm = false, hasCyclone = false, hasVolcano = false;

    externalAlerts.forEach(function(a) {
        var t = (a.type||'').toLowerCase();
        var title = (a.title||'').toLowerCase();
        if (t.includes('sismo') || t.includes('terremoto') || title.includes('earthquake')) hasEq = true;
        if (t.includes('tsunami') || title.includes('tsunami')) hasTsunami = true;
        if (t.includes('inundac') || title.includes('flood')) hasFlood = true;
        if (t.includes('incendio') || title.includes('fire') || title.includes('wildfire')) hasFire = true;
        if (t.includes('tormenta') || t.includes('storm') || t.includes('lluvia')) hasStorm = true;
        if (t.includes('ciclón') || t.includes('huracán') || t.includes('typhoon') || t.includes('hurricane')) hasCyclone = true;
        if (t.includes('volcán') || t.includes('eruption') || title.includes('volcano')) hasVolcano = true;
    });

    if (hasTsunami) {
        tips.push({ icon:'🌊', title:'ALERTA DE TSUNAMI — ACCIÓN INMEDIATA', color:'#FF2D55', tips:[
            'EVACÚA INMEDIATAMENTE hacia zonas elevadas (sobre 30m)',
            'Sigue SOLO las rutas de evacuación oficiales señalizadas',
            'No regreses a la costa hasta que las autoridades lo autoricen',
            'Aléjate de puentes, ríos y desembocaduras',
            'No intentes ver el tsunami — su velocidad supera los 800 km/h',
            'Lleva tu mochila de emergencia si está a mano, si no sal YA'
        ]});
    }
    if (hasCyclone) {
        tips.push({ icon:'🌀', title:'Ciclón / Huracán activo', color:'#7B1FA2', tips:[
            'Sigue las instrucciones de evacuación oficiales',
            'Refuerza puertas, ventanas y objetos al aire libre',
            'Prepara suministros para 72 horas (agua, comida, medicamentos)',
            'Permanece lejos de ventanas durante el paso',
            'No salgas durante el ojo del huracán — el peligro continúa'
        ]});
    }
    if (hasEq) {
        tips.push({ icon:'🌍', title:'Actividad sísmica detectada', color:'#FF3B30', tips:[
            'Durante el sismo: Cúbrete bajo una mesa sólida o en el marco de una puerta',
            'Aléjate de ventanas, espejos y objetos que puedan caer',
            'Si estás afuera, aléjate de edificios y postes',
            'No uses ascensores tras un sismo',
            'Después: revisa fugas de gas, corta la llave maestra si hueles gas',
            'Prepárate para réplicas — pueden durar días o semanas'
        ]});
    }
    if (hasVolcano) {
        tips.push({ icon:'🌋', title:'Actividad volcánica', color:'#FF6D00', tips:[
            'Sigue las zonas de evacuación definidas por las autoridades',
            'Usa mascarilla N95 para protegerte de cenizas volcánicas',
            'Protege ojos con gafas herméticas',
            'Cubre depósitos de agua y alimentos de ceniza',
            'Mantén ventanas y puertas cerradas'
        ]});
    }
    if (hasFire) {
        tips.push({ icon:'🔥', title:'Incendio forestal', color:'#D84315', tips:[
            'Si hay orden de evacuación: sal INMEDIATAMENTE',
            'Cierra todas las puertas y ventanas',
            'Evita zonas con humo — el humo puede ser letal',
            'Humedece techos y muros si tienes tiempo y agua',
            'Prepara tu mochila de emergencia: documentos, agua, medicamentos',
            'Sigue instrucciones de Protección Civil / Bomberos'
        ]});
    }
    if (hasFlood) {
        tips.push({ icon:'🌊', title:'Riesgo de inundación', color:'#0A84FF', tips:[
            'Muévete a pisos superiores o zonas elevadas',
            'Evita caminar o manejar en agua corriente',
            'No cruces puentes si el caudal está alto',
            'Desconecta aparatos eléctricos si el agua sube',
            'Guarda documentos en bolsas impermeables'
        ]});
    }

    // Weather tips
    if (lastWeatherData) {
        var id = lastWeatherData.weather && lastWeatherData.weather[0] ? lastWeatherData.weather[0].id : 800;
        var temp = lastWeatherData.main ? lastWeatherData.main.temp : 20;
        var wind = lastWeatherData.wind ? lastWeatherData.wind.speed * 3.6 : 0;

        if (id >= 200 && id < 300 && !hasStorm) {
            tips.push({ icon:'⛈️', title:'Tormenta eléctrica', color:'#7B1FA2', tips:[
                'No te refugies bajo árboles ni postes',
                'Desconecta aparatos eléctricos y antenas',
                'Evita actividades al aire libre',
                'Si estás al aire libre, agáchate con pies juntos y manos en orejas',
                'Evita cuerpos de agua abiertos'
            ]});
        } else if (id >= 500 && id < 600) {
            tips.push({ icon:'🌧️', title:'Lluvia', color:'#0A84FF', tips:[
                'Lleva paraguas y ropa impermeable',
                'Maneja con más distancia de frenado',
                'Evita calles con riesgo de anegamiento',
                'Protege dispositivos electrónicos',
                'Cuidado con techos y drenajes tapados'
            ]});
        } else if (id >= 600 && id < 700) {
            tips.push({ icon:'❄️', title:'Nieve / Hielo', color:'#64B5F6', tips:[
                'Usa cadenas en el vehículo o neumáticos de invierno',
                'Camina despacio y con calzado antideslizante',
                'Calienta tu hogar antes de dormir',
                'Ten cuidado con estufas a combustión (ventila bien)',
                'Protege tuberías del congelamiento'
            ]});
        }

        if (temp >= 35) {
            tips.push({ icon:'🥵', title:'Ola de calor', color:'#FF9500', tips:[
                'Bebe agua cada 30 minutos aunque no sientas sed',
                'Evita salir entre 12:00 y 17:00',
                'Usa ropa suelta, ligera y de colores claros',
                'Protege a niños, ancianos y mascotas',
                'Refrésca tu hogar con ventilación cruzada por la noche',
                'Nunca dejes personas o animales en vehículos'
            ]});
        } else if (temp <= 2) {
            tips.push({ icon:'🥶', title:'Frío extremo', color:'#64B5F6', tips:[
                'Viste por capas: interior térmico, aislante y exterior impermeable',
                'Cubre cabeza, manos y pies — pierdes el 40% del calor por la cabeza',
                'Protege especialmente a niños, adultos mayores y personas sin hogar',
                'Ventila aunque haga frío (monóxido de carbono)',
                'Evita el alcohol — da sensación de calor pero baja la temperatura corporal'
            ]});
        }

        if (wind >= 60) {
            tips.push({ icon:'💨', title:'Viento fuerte', color:'#FF9500', tips:[
                'Asegura objetos al aire libre: mesas, sombrillas, macetas',
                'Evita estar bajo árboles o cerca de cornisas',
                'Maneja con precaución — los vehículos altos son más vulnerables',
                'Reporta cables caídos o daños en postes',
                'Cierra ventanas que dan al viento'
            ]});
        }
    }

    if (!tips.length) {
        tips.push({ icon:'✅', title:'Sin alertas activas', color:'#00E676', tips:[
            'No hay fenómenos naturales significativos en tu zona',
            'Igual mantén tu mochila de emergencia lista',
            'Revisa que tu familia sepa el plan de evacuación',
            'Guarda los números de emergencia en tu teléfono',
            'Sigue las alertas para mantenerte informado'
        ]});
    }
    return tips;
}

// ========== MAP ==========
function createUserIcon() {
    return L.divIcon({
        className: 'custom-user-marker',
        html: '<div style="background:#0A84FF;border:3px solid white;border-radius:50%;width:24px;height:24px;box-shadow:0 0 8px rgba(10,132,255,0.8);"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

function initMap() {
    if (mapInitialized || !window.L) return;
    var theme = document.documentElement.getAttribute('data-theme') || 'dark';
    var tileUrl = (theme === 'light')
        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    var loc = getActiveLocation();
    var lat = loc.lat || -33.4489;
    var lon = loc.lon || -70.6693;
    leafletMap = L.map('map', { zoomControl: true, attributionControl: true }).setView([lat, lon], 6);
    L.tileLayer(tileUrl, { attribution: '© OpenStreetMap', subdomains: 'abcd', maxZoom: 20 }).addTo(leafletMap);
    if (loc.lat) {
        userMarker = L.marker([loc.lat, loc.lon], { icon: createUserIcon() }).addTo(leafletMap).bindPopup('📍 Tu ubicación');
    }
    mapInitialized = true;
    updateMapMarkers(externalAlerts);
    startMapAutoRefresh();
}

function getMapIcon(alert) {
    // Icono según tipo de evento — clima, sismos, incendios, etc.
    var type = (alert.type || '').toLowerCase();
    var src  = (alert.source || '').toLowerCase();
    var title = (alert.title || '').toLowerCase();
    var color = alert.color || '#FF9500';
    var size  = alert.priority >= 90 ? 28 : alert.priority >= 70 ? 22 : 16;
    var pulse = alert.priority >= 90 ?
        'animation:pulse 1.5s infinite;' : '';

    // Seleccionar emoji según tipo
    var emoji = alert.icon || '⚠️';

    // Iconos especiales por condición climática
    if (/lluvia|rain|precip/i.test(type + title))      emoji = '🌧️';
    if (/tormenta|storm|thunder/i.test(type + title))  emoji = '⛈️';
    if (/viento|wind|gale/i.test(type + title))        emoji = '💨';
    if (/nieve|snow|blizzard/i.test(type + title))     emoji = '❄️';
    if (/niebla|fog/i.test(type + title))              emoji = '🌫️';
    if (/calor|heat/i.test(type + title))              emoji = '🥵';
    if (/frío|cold|frost/i.test(type + title))         emoji = '🥶';
    if (/sismo|earthquake/i.test(type + title))        emoji = '🌍';
    if (/tsunami/i.test(type + title))                 emoji = '🌊';
    if (/volcán|volcano|erupc/i.test(type + title))    emoji = '🌋';
    if (/incendio|fire|wildfire/i.test(type + title))  emoji = '🔥';
    if (/inundac|flood/i.test(type + title))           emoji = '🌊';
    if (/huracán|hurricane|ciclón|cyclone/i.test(type + title)) emoji = '🌀';
    if (/aire|air quality|aqi/i.test(type + title))    emoji = '💨';
    if (/marejada|tide/i.test(type + title))           emoji = '🌊';
    if (/sequía|drought/i.test(type + title))          emoji = '🏜️';

    return L.divIcon({
        className: '',
        html: '<div style="background:'+color+';border:2px solid rgba(255,255,255,0.9);'
            +'border-radius:50%;width:'+size+'px;height:'+size+'px;'
            +'display:flex;align-items:center;justify-content:center;'
            +'font-size:'+(size-8)+'px;'+pulse
            +'box-shadow:0 2px 8px '+color+'80;cursor:pointer;">'
            +emoji+'</div>',
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
        popupAnchor: [0, -size/2]
    });
}


// ========== ACTUALIZADO: updateMapMarkers con filtrado inteligente ==========
function updateMapMarkers(alerts) {
    updateMapMarkersSmartZoom(alerts, getActiveLocation());
}

// Auto-refresh del mapa cada 2 minutos (CORREGIDO)
var mapRefreshInterval = null;
function startMapAutoRefresh() {
    startMapAutoRefreshFixed();
}

// Manejo de eventos globales (CORREGIDO)
function updateMapGlobal(allAlerts) {
    updateMapGlobalFixed(allAlerts);
}

// ========== SOS TOOLS ==========
function toggleFlashSOS() {
    if (sosFlashActive) {
        sosFlashActive = false;
        if (sosFlashInterval) { clearInterval(sosFlashInterval); sosFlashInterval = null; }
        document.body.style.background = '';
        document.getElementById('sosFlashlight').classList.remove('active');
        showToast('🔦 Linterna SOS desactivada');
        return;
    }
    sosFlashActive = true;
    document.getElementById('sosFlashlight').classList.add('active');
    showToast('🔦 Linterna SOS activada — SOS Morse');
    // SOS Morse: ... --- ...
    var pattern = [1,0,1,0,1,0,0,1,1,0,1,1,0,1,1,0,0,1,0,1,0,1,0,0];
    var i = 0;
    sosFlashInterval = setInterval(function() {
        document.body.style.background = pattern[i % pattern.length] ? '#ffffff' : '';
        i++;
    }, 200);
}

function sendPanicSMS() {
    var loc = getActiveLocation();
    var msg = '🆘 SOS - EMERGENCIA 🆘\n';
    if (loc.lat) msg += '📍 Mi ubicación: https://maps.google.com/?q='+loc.lat+','+loc.lon+'\n';
    msg += '⚠️ Necesito ayuda urgente\n🌍 Alerta Global App';
    if (navigator.share) {
        navigator.share({ title: 'SOS EMERGENCIA', text: msg }).catch(function(){});
    } else {
        window.open('sms:?body='+encodeURIComponent(msg));
    }
}

function showFirstAid() {
    var content = document.getElementById('sosPopupContent');
    if (content) content.innerHTML = '<h3>🩹 Primeros Auxilios Rápidos</h3>'
        +'<div class="sos-guide"><h4>🫀 RCP Básico</h4><ol><li>Llama al 131 (emergencias)</li><li>Recuesta a la persona boca arriba</li><li>30 compresiones en el centro del pecho (5-6 cm profundidad, 100-120/min)</li><li>2 respiraciones de rescate</li><li>Repite hasta que llegue la ayuda</li></ol></div>'
        +'<div class="sos-guide"><h4>🩸 Hemorragias</h4><ul><li>Presiona la herida con tela limpia</li><li>Mantén la presión sin levantar el paño</li><li>Eleva la extremidad lesionada</li><li>No apliques torniquete salvo que sea necesario</li></ul></div>'
        +'<div class="sos-guide"><h4>🔥 Quemaduras</h4><ul><li>Enfriar con agua fría 10-20 min</li><li>No usar hielo, cremas ni pasta dental</li><li>Cubrir con gasa estéril limpia</li><li>No reventar ampollas</li></ul></div>';
    closePopups();
    var sosPopup = document.getElementById('sosPopup');
    if (sosPopup) sosPopup.style.display = 'flex';
}

function showEmergencyNumbers() {
    var content = document.getElementById('sosPopupContent');
    if (content) content.innerHTML = '<h3>📞 Números de Emergencia</h3>'
        +'<div class="emergency-numbers">'
        +'<div class="em-num"><a href="tel:133">🚒 Bomberos: 133</a></div>'
        +'<div class="em-num"><a href="tel:131">🚑 Ambulancia: 131</a></div>'
        +'<div class="em-num"><a href="tel:132">🚓 Carabineros: 132</a></div>'
        +'<div class="em-num"><a href="tel:130">⚡ Emergencias gas/agua: 130</a></div>'
        +'<div class="em-num"><a href="tel:800730000">🌊 SHOA (Tsunamis): 800-730-000</a></div>'
        +'<div class="em-num"><a href="tel:1455">🌡️ SAPU: 1455</a></div>'
        +'<div class="em-num"><a href="tel:149">🧯 Municipalidad: 149</a></div>'
        +'</div>'
        +'<p style="color:var(--text-muted);font-size:12px;margin-top:12px">* Números válidos para Chile. Ajusta según tu país.</p>';
    closePopups();
    var sosPopup = document.getElementById('sosPopup');
    if (sosPopup) sosPopup.style.display = 'flex';
}

function showChecklist() {
    var content = document.getElementById('sosPopupContent');
    var items = [
        ['💧','Agua (2L/persona/día x3 días)'],
        ['🥫','Alimentos no perecibles (3 días)'],
        ['💊','Medicamentos esenciales + botiquín'],
        ['📄','Documentos importantes en bolsa impermeable'],
        ['🔦','Linterna + pilas de repuesto'],
        ['🔋','Power bank cargado'],
        ['🧥','Ropa abrigada y ropa de repuesto'],
        ['💵','Efectivo en billetes pequeños'],
        ['🗺️','Mapa impreso de tu ciudad'],
        ['📻','Radio a pilas o manivela'],
        ['🪣','Recipiente para agua extra'],
        ['🧴','Artículos de higiene personal'],
        ['🐾','Provisiones para mascotas'],
        ['🔑','Llave de gas extra y herramientas básicas'],
        ['📞','Lista de contactos de emergencia impresa']
    ];
    if (content) {
        content.innerHTML = '<h3>🎒 Mochila de 72 Horas</h3><div class="checklist">'
            + items.map(function(item) {
                var id = 'chk_'+Math.random().toString(36).substr(2,6);
                var saved = localStorage.getItem('ag_chk_'+item[1]) === '1';
                return '<label class="chk-item'+(saved?' checked':'')+'"><input type="checkbox" id="'+id+'" '+(saved?'checked':'')+' onchange="toggleCheck(this,\''+item[1].replace(/'/g,"\\'")+'\')"><span>'+item[0]+' '+item[1]+'</span></label>';
            }).join('')+'</div>';
    }
    closePopups();
    var sosPopup = document.getElementById('sosPopup');
    if (sosPopup) sosPopup.style.display = 'flex';
}

function toggleCheck(el, label) {
    try { localStorage.setItem('ag_chk_'+label, el.checked ? '1' : '0'); } catch(e) {}
    el.parentNode.classList.toggle('checked', el.checked);
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function() {
    loadSavedTheme();
    // Limpiar ubicacion guardada — siempre usar GPS real al abrir la app
    try {
        localStorage.removeItem('ag_focus');
        localStorage.removeItem('ag_current');
    } catch(e) {}
    focusLocation = { lat: null, lon: null, name: '', country: '' };
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
    MeshNetwork.init();
    // Cargar alertas globales de inmediato sin esperar ubicación
    loadAlerts();
    initLocation();
    setInterval(loadAlerts, CONFIG.ALERTS_INTERVAL);
    setInterval(function() { var a = getActiveLocation(); if (a.lat) loadWeather(a.lat, a.lon); }, CONFIG.WEATHER_INTERVAL);
    setTimeout(function() {
        setInterval(loadExternalSourcesData, 180000);
    }, 5000);
});
