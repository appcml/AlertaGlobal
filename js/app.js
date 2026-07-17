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

// (rest of file remains largely unchanged, but a few functions below are adjusted)

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
    loading.style.display='flex'; list.innerHTML=''; error.style.display='none';

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
            loading.style.display='none';
            lastEarthquakes = data.features || [];
            dataReady.earthquakes = true;
            lastEarthquakes.sort(function(a, b) { return b.properties.time - a.properties.time; });

            var now2 = Date.now();
            var hasThreat = false;
            var activeLoc = getActiveLocation();
            lastEarthquakes.forEach(function(f) {
                if (seenAlertIds[f.id]) return;
                seenAlertIds[f.id] = true;
                var mag = f.properties.mag, place = f.properties.place || '', depth = f.geometry.coordinates[2];
                var quakeLat = f.geometry.coordinates[1], quakeLon = f.geometry.coordinates[0];
                if ((now2 - f.properties.time) > 1800000) return; // only 30 min recent for immediate notifs
                var level = checkAlertLevel(mag, depth, place);
                var within = activeLoc.lat ? isWithinRadius(quakeLat, quakeLon, activeLoc.lat, activeLoc.lon, getUserRadiusKm()) : true;

                // Always notify ROJA/TSUNAMI or extreme magnitudes even if outside radius
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

            list.innerHTML = '';
            if (!lastEarthquakes.length) {
                // Fallback: load global M4.5+ feed
                list.innerHTML = '<div class="loading"><div class="spinner"></div><p style="color:var(--text-secondary)">Buscando sismos globales...</p></div>';
                fetch(CONFIG.USGS_GLOBAL)
                    .then(function(r){return r.json();})
                    .then(function(gd){
                        lastEarthquakes = (gd.features||[]).slice(0,30);
                        dataReady.earthquakes = true;
                        list.innerHTML = '';
                        var note = document.createElement('div');
                        note.style.cssText = 'padding:8px 12px;font-size:12px;color:var(--accent);text-align:center;';
                        note.textContent = '📡 Sin sismos locales — Mostrando sismos globales M4.5+';
                        list.appendChild(note);
                        renderEarthquakeCards(list, lastEarthquakes, true);
                        if (lastWeatherData) addWeatherAlertCards(list);
                        if (externalAlerts.length) renderExternalAlerts();
                    }).catch(function(){
                        list.innerHTML = '<div class="loading"><p style="color:var(--text-secondary)">No hay alertas recientes</p></div>';
                    });
                return; // exit early, the fetch callback handles rendering
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
            loading.style.display='none';
            error.style.display='block';
            error.textContent = e.name==='AbortError' ? '⚠️ Sin respuesta. Verifica conexión.' : '⚠️ '+e.message;
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
        var c=f.geometry.coordinates, depth=c[2].toFixed(1);
        var risk=calcRisk(mag);
        var dist=active.lat?calcDistance(active.lat,active.lon,c[1],c[0]):null;
        var tsunami=(mag>=7&&parseFloat(depth)<70)?'<div class="tsunami-warning">🌊 Posible riesgo de tsunami</div>':'';
        var isRecent=(now2-time)<3600000;
        var card=document.createElement('div');
        card.className='alert-card'+(mag>=7?' critical':mag>=5?' high':' medium')+(isRecent?' pulse':'');
        card.innerHTML='<div class="alert-header"><span class="alert-type">🌍 SISMO</span><span class="alert-severity" style="color:'+risk.color+'">'+risk.label+'</span></div>'
            +'<div class="alert-title">'+place+'</div>'
            +'<div class="alert-details"><span>💥 M<strong>'+mag.toFixed(1)+'</strong></span><span>⬇️ '+depth+' km</span>'+(dist?'<span class="alert-dist">📏 '+dist+' km</span>':'')+'</div>'
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

// The rest of file (weather, tips, map, sos, etc.) is unchanged from original

