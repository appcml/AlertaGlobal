// ============================================
// js/app.js — Alerta Global v9 — GEOLOC FIX + REALTIME
// ============================================
var CONFIG = {
    USGS_BASE: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=80&minmagnitude=1.5',
    USGS_GLOBAL: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
    WEATHER_API_KEY: '6fe6e0dcca264864dbd631bf620aad64',
    WEATHER_URL: 'https://api.openweathermap.org/data/2.5/weather',
    FORECAST_URL: 'https://api.openweathermap.org/data/2.5/forecast',
    ALERTS_INTERVAL: 120000,    // 2 min — menos agresivo por defecto
    WEATHER_INTERVAL: 600000,
    MAX_QUERY_RADIUS_KM: 800 // usado para consultas a USGS en vez de 3000
};

// Persisted / runtime configuration
CONFIG.USER_RADIUS_KM = parseInt(localStorage.getItem('ag_radius_km') || '500', 10); // radio por defecto
CONFIG.MIN_LOCATION_ACCURACY_M = 5000; // si accuracy mayor no usaremos para notifs

var deviceLocation = { lat: null, lon: null, name: '', country: '', accuracy: null }; // ubicación real del dispositivo
var focusLocation = { lat: null, lon: null, name: '', country: '' };  // ubicación activa para filtrar/mostrar
var currentLocation = { lat: null, lon: null, name: '', country: '' }; // legacy / compat
var leafletMap = null, mapInitialized = false, userMarker = null;
var lastWeatherData = null, lastForecastData = null, lastEarthquakes = [];
var seenAlertIds = {}, notifPermission = false, searchTimer = null;
var externalAlerts = [], alertsLoading = false;
var dataReady = { weather: false, earthquakes: false };
var sosFlashActive = false, sosFlashInterval = null;
var threatDetected = false;
var geoWatchId = null; // Para watchPosition

// ======= Helpers for radius and active location =======
function setUserRadiusKm(km) {
    CONFIG.USER_RADIUS_KM = km;
    try { localStorage.setItem('ag_radius_km', String(km)); } catch(e){}
}
function getUserRadiusKm() { return CONFIG.USER_RADIUS_KM || 500; }
function saveFocusLocation() { try { localStorage.setItem('ag_focus', JSON.stringify(focusLocation)); } catch(e){} }
function loadFocusLocation() {
    try {
        var f = JSON.parse(localStorage.getItem('ag_focus'));
        if (f && f.lat) focusLocation = f;
    } catch(e){}
}
function getActiveLocation() {
    if (focusLocation && focusLocation.lat) return focusLocation;
    if (deviceLocation && deviceLocation.lat) return { lat: deviceLocation.lat, lon: deviceLocation.lon, name: deviceLocation.name, country: deviceLocation.country };
    return currentLocation || { lat: null, lon: null, name:'', country:'' };
}

// Función para calcular distancia (usa calcDistance existente) y decidir si evento está dentro del radio
function isWithinRadius(eventLat, eventLon, centerLat, centerLon, radiusKm) {
    if (!centerLat || !centerLon || !eventLat || !eventLon) return false;
    var d = calcDistance(centerLat, centerLon, eventLat, eventLon);
    // radius 0 means Global
    if (!radiusKm && radiusKm !== 0) radiusKm = getUserRadiusKm();
    if (radiusKm === 0) return true;
    return d <= (radiusKm || getUserRadiusKm());
}

// ========== THEME ==========
function setTheme(name) {
    document.documentElement.setAttribute('data-theme', name);
    try { localStorage.setItem('ag_theme', name); } catch(e) {}
    // Update active state
    document.querySelectorAll('.theme-option').forEach(function(btn) {
        btn.setAttribute('data-active', btn.dataset.theme === name ? 'true' : 'false');
    });
    // Reinit map tiles if map exists
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
        var t = localStorage.getItem('ag_theme');
        if (t) {
            document.documentElement.setAttribute('data-theme', t);
            document.querySelectorAll('.theme-option').forEach(function(btn) {
                btn.setAttribute('data-active', btn.dataset.theme === t ? 'true' : 'false');
            });
        }
    } catch(e) {}
}

// ========== UTIL / AUDIO / ALERT LEVEL ==========
var AudioCtx = window.AudioContext || window.webkitAudioContext;
var audioCtx = null;
function getAudio() { if (!audioCtx) try { audioCtx = new AudioCtx(); } catch(e) {} return audioCtx; }
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
function checkAlertLevel(mag, depth, place) {
    var coastal = /coast|ocean|pacific|atlantic|mar |sea |pacífico|atlántico/i.test(place);
    if (mag >= 8.0) return 'ROJA';
    if (mag >= 7.0 && coastal && depth < 70) return 'TSUNAMI';
    if (mag >= 6.5) return 'NARANJA';
    if (mag >= 5.5) return 'AMARILLA';
    return null;
}
function calcRisk(mag) {
    if (mag >= 8) return { label:'⚫ EXTREMO', color:'#fff' };
    if (mag >= 7) return { label:'🔴 CRÍTICO', color:'#FF453A' };
    if (mag >= 5) return { label:'🟠 ALTO', color:'#FF9500' };
    if (mag >= 4) return { label:'🟡 MEDIO', color:'#FFC107' };
    return { label:'🟢 BAJO', color:'#00E676' };
}

// ========== STATUS ==========
function updateStatus(isThreat, text) {
    threatDetected = isThreat;
    var dot = document.querySelector('.status-dot');
    var txt = document.getElementById('statusText');
    if (dot) dot.className = 'status-dot ' + (isThreat ? 'danger' : 'safe');
    if (txt) txt.textContent = text || (isThreat ? 'AMENAZA DETECTADA' : 'Entorno Seguro');
}

// ========== INIT ==========
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
    setInterval(function() { loadAlerts(); }, CONFIG.ALERTS_INTERVAL);
    setInterval(function() { var a = getActiveLocation(); if (a.lat) loadWeather(a.lat, a.lon); }, CONFIG.WEATHER_INTERVAL);
    setTimeout(function() {
        loadExternalSourcesData();
        setInterval(loadExternalSourcesData, 180000); // 3 min
    }, 5000);
});

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

// ========== UI: Tabs / Search / Favorites / Theme ==========
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
function setupLanguageSelector() {
    var btnLang = document.getElementById('btnLang');
    if (btnLang) {
        btnLang.addEventListener('click', function() {
            var lp = document.getElementById('langPopup');
            lp.style.display='flex';
            lp.onclick = function(e) { if (e.target===lp) closePopups(); };
        });
    }
    var closeLang = document.getElementById('closeLang');
    if (closeLang) closeLang.addEventListener('click', closePopups);
    document.querySelectorAll('.lang-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            setLanguage(this.dataset.lang); closePopups(); refreshSmartTips();
            if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon);
            showToast('🌐 '+this.textContent.trim());
        });
    });
}
function setupFavorites() {
    var btnStar1 = document.getElementById('btnStarAlert');
    var btnStar2 = document.getElementById('btnStarWeather');
    if (btnStar1) btnStar1.addEventListener('click', toggleFavorite);
    if (btnStar2) btnStar2.addEventListener('click', toggleFavorite);
    var btnFav = document.getElementById('btnFavorites');
    if (btnFav) btnFav.addEventListener('click', openFavorites);
    updateStarButtons(); updateFavBadge();
}
function toggleFavorite() {
    var active = getActiveLocation();
    if (!active.lat) { showToast('📍 Detecta tu ubicación primero'); return; }
    var exists = LocationManager.getAll().find(function(l) { return l.name===active.name; });
    if (exists) { LocationManager.remove(active.name); showToast('Eliminado de favoritos'); }
    else { LocationManager.save({name:active.name,lat:active.lat,lon:active.lon,country:active.country}); showToast('⭐ Guardado: '+active.name); }
    updateStarButtons(); updateFavBadge();
}
function updateStarButtons() {
    var active = getActiveLocation();
    var isFav = active.name && LocationManager.getAll().find(function(l) { return l.name===active.name; });
    ['btnStarAlert','btnStarWeather'].forEach(function(id) {
        var btn = document.getElementById(id);
        if (btn) { btn.textContent=isFav?'★':'☆'; btn.classList.toggle('active', !!isFav); }
    });
}
function updateFavBadge() {
    var btn = document.getElementById('btnFavorites'); if (!btn) return;
    var count = LocationManager.getAll().length;
    var badge = btn.querySelector('.fav-badge');
    if (count>0) { if (!badge) { badge=document.createElement('span'); badge.className='fav-badge'; btn.appendChild(badge); } badge.textContent=count; }
    else if (badge) badge.remove();
}
function openFavorites() {
    var locs = LocationManager.getAll();
    var list = document.getElementById('favoritesList');
    var empty = document.getElementById('favoritesEmpty');
    if (!locs.length) { list.innerHTML=''; empty.style.display='block'; }
    else {
        empty.style.display='none';
        list.innerHTML = locs.map(function(l) {
            var sn=l.name.replace(/'/g,"\\'"), sc=(l.country||'').replace(/'/g,"\\'");
            return '<div class="fav-item"><div class="fav-item-info" onclick="selectLocation({name:\''+sn+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+sc+'\'});closePopups()">'
                +'<div class="fav-item-name">⭐ '+l.name+'</div><div class="fav-item-country">'+(l.country||'')+' · '+l.lat.toFixed(2)+', '+l.lon.toFixed(2)+'</div></div>'
                +'<div class="fav-item-actions"><button class="fav-go-btn" onclick="selectLocation({name:\''+sn+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+sc+'\'});closePopups()">Ir →</button>'
                +'<button class="fav-del-btn" onclick="removeFavorite(\''+sn+'\')">🗑️</button></div></div>';
        }).join('');
    }
    document.getElementById('favoritesPopup').style.display='flex';
}
function removeFavorite(name) { LocationManager.remove(name); updateStarButtons(); updateFavBadge(); openFavorites(); showToast('🗑️ Eliminado'); }

// ========== GEOLOCATION — FIXED with watchPosition ==========
function initLocation() {
    updateLocationDisplay('Detectando GPS...');

    // 1. Try saved location first for instant display
    var saved = LocationManager.getCurrent();
    if (saved && saved.lat) {
        // keep legacy currentLocation for compatibility but prefer device/focus later
        currentLocation = saved;
        updateLocationDisplay(saved.name || 'Cargando...');
        loadAlerts();
        loadWeather(saved.lat, saved.lon);
    }

    if (!navigator.geolocation) {
        updateLocationDisplay('Sin GPS — Busca manual');
        if (!saved) loadAlerts();
        return;
    }

    // 2. getCurrentPosition with HIGH accuracy for immediate fix
    navigator.geolocation.getCurrentPosition(
        function(pos) { handleGeoSuccess(pos, true); },
        function(err) {
            console.log('GPS high accuracy failed:', err.message, '- trying low accuracy');
            // Fallback: low accuracy
            navigator.geolocation.getCurrentPosition(
                function(pos) { handleGeoSuccess(pos, false); },
                function(err2) {
                    console.log('GPS low accuracy also failed:', err2.message);
                    if (!deviceLocation.lat && !currentLocation.lat) {
                        updateLocationDisplay('GPS no disponible');
                        loadAlerts();
                    }
                },
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
            );
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // 3. watchPosition for continuous updates
    geoWatchId = navigator.geolocation.watchPosition(
        function(pos) { handleGeoSuccess(pos, true); },
        function() {},  // silent fail on watch
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
    );
}

function handleGeoSuccess(pos, isHighAccuracy) {
    var lat = pos.coords.latitude;
    var lon = pos.coords.longitude;
    var accuracy = pos.coords.accuracy;

    // Skip very poor accuracy updates
    if (deviceLocation.lat && accuracy > (deviceLocation.accuracy || 1) && accuracy > 50000) return;

    var needsReload = !deviceLocation.lat;
    deviceLocation.lat = lat;
    deviceLocation.lon = lon;
    deviceLocation.accuracy = accuracy;
    if (!deviceLocation.name || deviceLocation.name.indexOf(',') > -1) {
        deviceLocation.name = lat.toFixed(4) + ', ' + lon.toFixed(4);
    }

    // If the user has NOT selected manual focus, keep focus synced with device
    if (!focusLocation || !focusLocation.lat) {
        focusLocation = { lat: lat, lon: lon, name: deviceLocation.name, country: '' };
    }

    updateLocationDisplay(getActiveLocation().name);

    if (needsReload) {
        loadAlerts();
        loadWeather(lat, lon);
    }

    updateStarButtons();

    // Reverse geocode for city name and country
    LocationManager.reverseGeocode(lat, lon).then(function(geo) {
        if (geo && geo.city && geo.city.length > 1) {
            deviceLocation.name = geo.city;
            deviceLocation.country = geo.country || '';
            if (!focusLocation || !focusLocation.lat) {
                focusLocation.name = deviceLocation.name;
                focusLocation.country = deviceLocation.country;
            }
            // keep legacy currentLocation in sync for compatibility
            currentLocation = { lat: deviceLocation.lat, lon: deviceLocation.lon, name: deviceLocation.name, country: deviceLocation.country };
            LocationManager.setCurrent(currentLocation);
        }
        updateLocationDisplay(getActiveLocation().name);
        updateStarButtons();
        if (accuracy > 10000) showLocationAccuracyBanner(getActiveLocation().name);
    }).catch(function() {});
}

function updateLocationDisplay(name) {
    var e1 = document.getElementById('currentLocationName');
    var e2 = document.getElementById('weatherLocationName');
    if (e1) e1.textContent = name || 'Global';
    if (e2) e2.textContent = name || 'Detectar';
}

function selectLocation(loc) {
    // When user selects a saved location, set it as focus (do not overwrite deviceLocation)
    focusLocation = { lat: loc.lat, lon: loc.lon, name: loc.name, country: loc.country||'' };
    saveFocusLocation();
    // keep compatibility
    currentLocation = { lat: loc.lat, lon: loc.lon, name: loc.name, country: loc.country||'' };
    updateLocationDisplay(focusLocation.name);
    alertsLoading = false;
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

// ========== BUTTONS ==========
function setupLocationButtons() {
    var btnMyLoc = document.getElementById('btnMyLocation');
    if (btnMyLoc) {
        btnMyLoc.addEventListener('click', function() {
            try { localStorage.removeItem('ag_current'); } catch(e) {}
            // clear any manual focus to force using device location
            focusLocation = {};
            saveFocusLocation();
            updateLocationDisplay('Buscando GPS...');
            if (geoWatchId) navigator.geolocation.clearWatch(geoWatchId);
            if (!navigator.geolocation) { showToast('⚠️ GPS no disponible'); return; }
            navigator.geolocation.getCurrentPosition(function(pos) {
                handleGeoSuccess(pos, true);
                showToast('📍 Ubicación del dispositivo activada');
            }, function(err) {
                var msg = '⚠️ No se pudo obtener ubicación';
                if (err.code === 1) msg = '⚠️ Permiso de ubicación denegado';
                else if (err.code === 2) msg = '⚠️ GPS no disponible';
                else if (err.code === 3) msg = '⚠️ Tiempo agotado';
                showToast(msg);
                updateLocationDisplay('Busca manualmente');
            }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
            // Restart watch
            geoWatchId = navigator.geolocation.watchPosition(
                function(pos) { handleGeoSuccess(pos, true); },
                function() {},
                { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
            );
        });
    }
    var btnSearch = document.getElementById('btnSearchLocation');
    if (btnSearch) btnSearch.addEventListener('click', openSearch);
    var btnWeatherLoc = document.getElementById('btnWeatherLocation');
    if (btnWeatherLoc) btnWeatherLoc.addEventListener('click', function() {
        var b = document.getElementById('btnMyLocation'); if (b) b.click();
    });
    var btnWeatherSearch = document.getElementById('btnWeatherSearch');
    if (btnWeatherSearch) btnWeatherSearch.addEventListener('click', openSearch);
    var btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) btnRefresh.addEventListener('click', function() {
        alertsLoading = false;
        loadAlerts();
        var a = getActiveLocation(); if (a.lat) loadWeather(a.lat, a.lon);
        showToast('✅ Actualizando...');
    });
}

// ========== ALERTS — REAL TIME with starttime filter ==========
function loadAlerts() {
    if (alertsLoading) return;
    alertsLoading = true;
    var loading = document.getElementById('alertsLoading');
    var list = document.getElementById('alertList');
    var error = document.getElementById('alertsError');
    if (loading) loading.style.display='flex';
    if (list) list.innerHTML='';
    if (error) error.style.display='none';

    // Force TODAY's data with starttime parameter
    var now = new Date();
    var startTime = new Date(now.getTime() - 86400000).toISOString(); // last 24h

    var url;
    var active = getActiveLocation();
    if (active.lat && active.lon) {
        url = CONFIG.USGS_BASE + '&latitude='+active.lat+'&longitude='+active.lon+'&maxradiuskm='+CONFIG.MAX_QUERY_RADIUS_KM+'&starttime='+startTime;
    } else {
        url = CONFIG.USGS_GLOBAL;
    }

    var ctrl = typeof AbortController!=='undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 12000) : null;

    fetch(url, ctrl ? { signal: ctrl.signal } : {})
        .then(function(r) { if (timer) clearTimeout(timer); return r.json(); })
        .then(function(data) {
            alertsLoading = false;
            if (loading) loading.style.display='none';
            lastEarthquakes = data.features || [];
            dataReady.earthquakes = true;
            lastEarthquakes.sort(function(a, b) { return b.properties.time - a.properties.time; });

            var now2 = Date.now();
            var hasThreat = false;
            var activeLoc = getActiveLocation();

            // Process events but suppress notifications when rendering fallback global list (we only notify for local relevant events above)
            lastEarthquakes.forEach(function(f) {
                if (seenAlertIds[f.id]) return;
                seenAlertIds[f.id] = true;
                var mag = f.properties.mag, place = f.properties.place || '', depth = f.geometry.coordinates[2];
                var quakeLat = f.geometry.coordinates[1], quakeLon = f.geometry.coordinates[0];
                if ((now2 - f.properties.time) > 1800000) return; // only 30 min recent for immediate notifs
                var level = checkAlertLevel(mag, depth, place);
                var within = activeLoc.lat ? isWithinRadius(quakeLat, quakeLon, activeLoc.lat, activeLoc.lon, getUserRadiusKm()) : true;

                // Always notify ROJA/TSUNAMI or extreme magnitudes even if outside radius (safety)
                if ((level === 'ROJA' || level === 'TSUNAMI') || Math.abs(mag) >= 8.0) {
                    hasThreat = true; playSiren();
                    showEmergencyModal('🚨 ALERTA '+level+' M'+mag.toFixed(1), place, mag, depth.toFixed(0), level);
                    sendNotification('🚨 ALERTA '+level+' M'+mag.toFixed(1), place, 'critical');
                } else if (level === 'NARANJA' && within) {
                    hasThreat = true; playBeep(660, 0.5, 'square');
                    sendNotification('🟠 SISMO M'+mag.toFixed(1), place, 'high');
                } else if ((level === 'AMARILLA' || mag >= 5.0) && within) {
                    playBeep(880, 0.4);
                    sendNotification('⚠️ SISMO M'+mag.toFixed(1), place, 'medium');
                }
            });
            if (hasThreat) updateStatus(true);
            else if (!threatDetected) updateStatus(false);

            if (!list) return;

            list.innerHTML = '';
            if (!lastEarthquakes.length) {
                // Fallback: DO NOT auto-fetch global feed. Show opt-in UI so user can request global list manually.
                var note = document.createElement('div');
                note.style.cssText = 'padding:12px;text-align:center;color:var(--text-muted);';
                note.innerHTML = '<div>📡 Sin sismos locales dentro de tu radio ('+ (getUserRadiusKm()===0 ? 'Global' : getUserRadiusKm()+' km') +').</div>'
                    +'<div style="margin-top:8px"><button id="btnShowGlobal" class="btn-small">Mostrar sismos globales M4.5+</button></div>';
                list.appendChild(note);

                // Attach handler
                setTimeout(function(){ // ensure DOM
                    var btn = document.getElementById('btnShowGlobal');
                    if (!btn) return;
                    btn.addEventListener('click', function() {
                        btn.disabled = true; btn.textContent = 'Cargando...';
                        // fetch global feed but DO NOT trigger notifications automatically
                        fetch(CONFIG.USGS_GLOBAL).then(function(r){ return r.json(); }).then(function(gd){
                            lastEarthquakes = (gd.features||[]).slice(0,30);
                            dataReady.earthquakes = true;
                            list.innerHTML = '';
                            var note2 = document.createElement('div');
                            note2.style.cssText = 'padding:8px 12px;font-size:12px;color:var(--accent);text-align:center;';
                            note2.textContent = '📡 Mostrando sismos globales M4.5+ (sin notificaciones automáticas)';
                            list.appendChild(note2);
                            renderEarthquakeCards(list, lastEarthquakes, true);
                            if (lastWeatherData) addWeatherAlertCards(list);
                            if (externalAlerts.length) renderExternalAlerts();
                        }).catch(function(){
                            note.innerHTML = '<div style="color:#FF3B30">Error cargando sismos globales</div>';
                        });
                    });
                }, 20);

                return; // stop here
            } else {
                var hdr = document.createElement('div');
                hdr.style.cssText = 'padding:8px 12px;font-size:12px;color:var(--text-muted);display:flex;justify-content:space-between;';
                hdr.innerHTML = '<span>📡 '+lastEarthquakes.length+' sismos (24h)</span><span>🕐 '+new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})+'</span>';
                list.appendChild(hdr);
                renderEarthquakeCards(list, lastEarthquakes, false);
            }
            if (lastWeatherData) addWeatherAlertCards(list);
            if (externalAlerts.length) renderExternalAlerts();
            if (dataReady.weather) refreshSmartTips();
        })
        .catch(function(e) {
            alertsLoading = false;
            if (timer) clearTimeout(timer);
            if (loading) loading.style.display='none';
            if (error) { error.style.display='block'; error.textContent = e.name==='AbortError' ? '⚠️ Sin respuesta. Verifica conexión.' : '⚠️ '+e.message; }
        });
}

function renderEarthquakeCards(list, quakes, showAllFallback) {
    var now2 = Date.now();
    var active = getActiveLocation();
    // Filtrar por distancia si hay active location
    var filtered = quakes.filter(function(f) {
        var c = f.geometry && f.geometry.coordinates;
        if (!c) return showAllFallback;
        if (!active.lat) return true;
        return isWithinRadius(c[1], c[0], active.lat, active.lon, getUserRadiusKm());
    });
    if (!filtered.length && showAllFallback) filtered = quakes.slice(0, 30);

    filtered.forEach(function(f) {
        var mag=f.properties.mag, place=f.properties.place||'?', time=f.properties.time;
        var c=f.geometry.coordinates, depth=(c && c[2])?c[2].toFixed(1):'N/A';
        var risk=calcRisk(mag || 0);
        var dist=active.lat && c ? calcDistance(active.lat,active.lon,c[1],c[0]):null;
        var tsunami=(mag>=7&&parseFloat(depth)<70)?'<div class="tsunami-warning">🌊 Posible riesgo de tsunami</div>':'';
        var isRecent=(now2-time)<3600000;
        var card=document.createElement('div');
        card.className='alert-card'+(mag>=7?' critical':mag>=5?' high':' medium')+(isRecent?' pulse':'');
        card.innerHTML='<div class="alert-header"><span class="alert-type">🌍 SISMO</span><span class="alert-severity" style="color:'+risk.color+'">'+risk.label+'</span></div>'
            +'<div class="alert-title">'+place+'</div>'
            +'<div class="alert-details"><span>💥 M<strong>'+ (mag?mag.toFixed(1):'N/A') +'</strong></span><span>⬇️ '+depth+' km</span>'+(dist?'<span class="alert-dist">📏 '+dist+' km</span>':'')+'</div>'
            +tsunami
            +'<div class="alert-footer"><span>🕐 '+formatTime(time)+'</span><span>📡 USGS</span></div>';
        var sb=document.createElement('button'); sb.className='alert-share-btn'; sb.textContent='📤 Compartir';
        (function(m,pl,d,di,ti){ sb.onclick=function(){ openShare(buildShareText('earthquake',{mag:m,place:pl,depth:d,dist:di,time:formatTime(ti)})); }; })(mag,place,depth,dist,time);
        card.appendChild(sb); list.appendChild(card);
    });
}

function renderExternalAlerts() {
    var list = document.getElementById('alertList'); if (!list) return;
    list.querySelectorAll('.ext-alert-card').forEach(function(c) { c.remove(); });
    var active = getActiveLocation();
    externalAlerts.forEach(function(a) {
        // try to filter external alerts by coords or by country in title when possible
        if (a.lat && a.lon) {
            if (!isWithinRadius(a.lat, a.lon, active.lat, active.lon, getUserRadiusKm()) && getUserRadiusKm()!==0 && active.lat) return; // skip if outside
        } else if (active.country && a.title) {
            var t = (a.title + ' ' + (a.description||'')).toLowerCase();
            if (t.indexOf((active.country||'').toLowerCase()) === -1 && (a.priority||0) < 90) return;
        }
        var card=document.createElement('div'); card.className='alert-card ext-alert-card'; card.style.borderLeftColor=a.color;
        card.innerHTML='<div class="alert-header"><span class="alert-type" style="background:'+a.color+'22;color:'+a.color+'">'+a.icon+' '+a.type+'</span></div><div class="alert-title">'+a.title+'</div>';
        list.appendChild(card);
    });
}

function loadExternalSourcesData() {
    if (typeof loadExternalSources === 'undefined') return;
    loadExternalSources(function(alerts) {
        externalAlerts = alerts || [];
        externalAlerts.forEach(function(a) {
            var id='ext_'+(a.title||'').substring(0,30);
            if (!seenAlertIds[id] && (a.priority||0)>=85) {
                seenAlertIds[id]=true;
                if ((a.priority||0)>=95) playSiren();
                else playBeep(660, 0.5);
                sendNotification(a.icon+' '+a.type, a.title, (a.priority||0)>=95?'critical':'high');
            }
            seenAlertIds[id]=true;
        });
        var al=document.getElementById('alertList');
        if (al && lastEarthquakes.length) renderExternalAlerts();
    });
}

// ========== WEATHER / FORECAST ==========
function loadWeather(lat, lon) {
    if (!lat || !lon) return;
    var loading=document.getElementById('weatherLoading'), container=document.getElementById('weatherContainer'), error=document.getElementById('weatherError');
    if (loading) loading.style.display='flex'; if (container) container.style.display='none'; if (error) error.style.display='none';
    fetch(CONFIG.WEATHER_URL+'?lat='+lat+'&lon='+lon+'&appid='+CONFIG.WEATHER_API_KEY+'&units=metric&lang='+currentLang)
        .then(function(r){ return r.json(); }).then(function(d) {
            if (loading) loading.style.display='none'; if (container) container.style.display='block';
            lastWeatherData=d; dataReady.weather=true;
            var city = d.name || getActiveLocation().name || '';
            if (document.getElementById('wCity')) document.getElementById('wCity').textContent = city;
            if (document.getElementById('wTemp')) document.getElementById('wTemp').textContent = Math.round(d.main.temp)+'°C';
            if (document.getElementById('wDesc')) document.getElementById('wDesc').textContent = d.weather[0].description;
            if (document.getElementById('wHumidity')) document.getElementById('wHumidity').textContent = d.main.humidity+'%';
            if (document.getElementById('wWind')) document.getElementById('wWind').textContent = d.wind.speed+' m/s';
            refreshSmartTips();
            loadForecast(lat, lon);
        }).catch(function(e){ if (loading) loading.style.display='none'; if (error) { error.style.display='block'; error.textContent='⚠️ '+e.message; }});
}
function loadForecast(lat, lon) {
    fetch(CONFIG.FORECAST_URL+'?lat='+lat+'&lon='+lon+'&appid='+CONFIG.WEATHER_API_KEY+'&units=metric&lang='+currentLang+'&cnt=16')
        .then(function(r){return r.json();}).then(function(d){ lastForecastData=d; refreshSmartTips(); }).catch(function(){ refreshSmartTips(); });
}

// ========== SMART TIPS / MAP / SOS (unchanged core functionality) ==========
function refreshSmartTips() {
    if (!dataReady.weather && !dataReady.earthquakes) {
        var tipsEl = document.getElementById('tipsList');
        if (tipsEl) tipsEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>';
        return;
    }
    var tips=[], now=Date.now();
    if (lastEarthquakes.length) {
        var big=lastEarthquakes.filter(function(f){return (now-f.properties.time)<3600000&&f.properties.mag>=6;});
        if (big.length) {
            var eq=big[0], mag=eq.properties.mag, place=eq.properties.place;
            var dist=getActiveLocation().lat?calcDistance(getActiveLocation().lat,getActiveLocation().lon,eq.geometry.coordinates[1],eq.geometry.coordinates[0]):null;
            tips.push({title:'🚨 SISMO M'+mag.toFixed(1)+' — HACE MENOS DE 1H',desc:'Epicentro: '+place+(dist?' · '+dist+' km de ti':''),cat:'⚫ EMERGENCIA',color:'#FF3B30',priority:100});
        }
        var mod=lastEarthquakes.filter(function(f){return (now-f.properties.time)<21600000&&f.properties.mag>=5;});
        if(mod.length&&!big.length) tips.push({title:'⚠️ '+mod.length+' sismos M5+ en 6h',desc:'Actividad sísmica elevada.',cat:'🟠 PRECAUCIÓN',color:'#FF9500',priority:75});
    }
    if (lastWeatherData) {
        var d=lastWeatherData, temp=d.main.temp, wind=d.wind.speed;
        var city = d.name || getActiveLocation().name || 'tu zona';
        if(d.weather && d.weather[0]) {
            var main=d.weather[0].main.toLowerCase(), desc2=d.weather[0].description;
            if(main==='thunderstorm') tips.push({title:'⛈️ TORMENTA — '+city,desc:'Desconecta aparatos. Refúgiate.',cat:'🔴 EMERGENCIA',color:'#FF3B30',priority:95});
            if(main==='rain'||main==='drizzle') tips.push({title:'🌧️ LLUVIA: '+desc2+' — '+city,desc:'Lleva paraguas. Evita zonas inundables.',cat:'🟡 PRECAUCIÓN',color:'#0A84FF',priority:80});
            if(wind>15) tips.push({title:'💨 VIENTO: '+wind.toFixed(0)+' m/s — '+city,desc:'Asegura objetos.',cat:'🔴 ALTO',color:'#FF9500',priority:88});
        }
    }
    if (tips.length<2) {
        tips.push({title:'🎒 Mochila de emergencia',desc:'Agua, linterna, radio, documentos y medicamentos.',cat:'🟢 PREVENCIÓN',color:'#636366',priority:10});
    }
    tips.sort(function(a,b){return (b.priority||0)-(a.priority||0);});
    var list=document.getElementById('tipsList'); if (!list) return;
    list.innerHTML='';
    var h=document.createElement('div'); h.style.cssText='padding:8px 12px;font-size:11px;color:var(--text-muted);text-align:right;';
    h.textContent='🔄 '+new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})+' — '+(getActiveLocation().name||'');
    list.appendChild(h);
    tips.forEach(function(tip){
        var card=document.createElement('div'); card.className='tip-card'; card.style.borderLeft='4px solid '+tip.color;
        card.innerHTML='<span class="tip-category" style="color:'+tip.color+';background:'+tip.color+'18">'+tip.cat+'</span><div class="tip-title">'+tip.title+'</div><div class="tip-desc">'+tip.desc+'</div>';
        list.appendChild(card);
    });
}

function initMap() {
    if (typeof L === 'undefined') {
        var mapEl = document.getElementById('map');
        if (mapEl) mapEl.innerHTML = '<div class="loading"><p style="color:var(--text-secondary)">⚠️ Error cargando mapa. Recarga la página.</p></div>';
        return;
    }
    var lat=getActiveLocation().lat||-33.45, lon=getActiveLocation().lon||-70.65;
    var zoom=getActiveLocation().lat?10:4;
    leafletMap=L.map('map',{zoomControl:false}).setView([lat,lon],zoom);
    L.control.zoom({position:'bottomright'}).addTo(leafletMap);
    var savedTheme = 'dark';
    try { savedTheme = localStorage.getItem('ag_theme') || 'dark'; } catch(e) {}
    var tileUrl = (savedTheme === 'light')
        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    L.tileLayer(tileUrl, { attribution: '© OpenStreetMap', subdomains: 'abcd', maxZoom: 20 }).addTo(leafletMap);
    if(getActiveLocation().lat){
        userMarker=L.marker([getActiveLocation().lat,getActiveLocation().lon],{icon:createUserIcon()}).addTo(leafletMap).bindPopup('<b style="color:#000">📍 '+getActiveLocation().name+'</b>').openPopup();
    }
    fetch(CONFIG.USGS_GLOBAL).then(function(r){return r.json();}).then(function(data){
        data.features.forEach(function(f){
            var c=f.geometry.coordinates, mag=f.properties.mag, place=f.properties.place;
            var color=mag>=7?'#FF3B30':mag>=5?'#FF9500':mag>=4?'#FFC107':'#FFD60A';
            L.circleMarker([c[1],c[0]],{radius:Math.max(mag*2.5,5),color:color,fillColor:color,fillOpacity:0.7,weight:1})
                .addTo(leafletMap).bindPopup('<div style="color:#000"><b>🌍 M'+mag.toFixed(1)+'</b><br>'+place+'<br><small>Prof: '+(c[2]?c[2].toFixed(0):'N/A')+' km</small></div>');
        });
    }).catch(function(){});
    mapInitialized=true;
    setTimeout(function(){ if (leafletMap) leafletMap.invalidateSize(); },300);
}

// ========== SOS KIT ==========
function setupSOS() {
    var closeSos = document.getElementById('closeSos');
    if (closeSos) closeSos.addEventListener('click', closePopups);
    var sosPopup = document.getElementById('sosPopup');
    if (sosPopup) sosPopup.addEventListener('click', function(e) { if (e.target===this) closePopups(); });
}
function sendPanicSMS() {
    var active = getActiveLocation();
    if (!active.lat) { showToast('📍 Necesitamos tu ubicación'); return; }
    var msg = '🆘 EMERGENCIA — Necesito ayuda. Mi ubicación: https://maps.google.com/?q='+active.lat+','+active.lon+' ('+active.name+'). Enviado desde Alerta Global.';
    window.open('sms:?body='+encodeURIComponent(msg));
    showToast('🆘 Abriendo SMS...');
}
function showLocationAccuracyBanner(detectedCity) {
    var old = document.getElementById('locAccBanner'); if (old) return;
    var b = document.createElement('div');
    b.id = 'locAccBanner';
    b.style.cssText = 'background:var(--accent-dim);border:1px solid var(--accent);border-left:4px solid var(--accent);padding:10px 14px;margin:6px 10px;border-radius:10px;font-size:13px;display:flex;gap:12px;align-items:center;';
    b.innerHTML = '<div style="flex:1">📍 Detectado: <strong style="color:var(--accent)">'+detectedCity+'</strong><br><span style="color:var(--text-muted);font-size:12px">¿No es correcto? Búscala manualmente.</span></div>'
        + '<div><button onclick="openSearch();var el=document.getElementById(\\'locAccBanner\\');if(el)el.remove()" style="background:var(--accent);color:#000;border:none;border-radius:8px;padding:6px 12px;cursor:pointer">Cambiar</button>'
        + '<button onclick="var el=document.getElementById(\\'locAccBanner\\');if(el)el.remove()" style="background:none;border:none;color:var(--text-muted);font-size:16px;cursor:pointer;margin-left:8px">✕</button></div>';
    var alertList = document.getElementById('alertList');
    if (alertList) alertList.insertBefore(b, alertList.firstChild);
}

// --------------- end of file ---------------
