// ============================================
// js/app.js — Alerta Global v7 CLEAN
// ============================================
var CONFIG = {
    // USGS filtered by location when available
    USGS_BASE: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=50&minmagnitude=2.0',
    USGS_GLOBAL: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
    WEATHER_API_KEY: '6fe6e0dcca264864dbd631bf620aad64',
    WEATHER_URL: 'https://api.openweathermap.org/data/2.5/weather',
    FORECAST_URL: 'https://api.openweathermap.org/data/2.5/forecast',
    ALERTS_INTERVAL: 120000,   // 2 min
    WEATHER_INTERVAL: 600000   // 10 min
};

var currentLocation = { lat: null, lon: null, name: '', country: '' };
var leafletMap = null, mapInitialized = false, userMarker = null;
var lastWeatherData = null, lastForecastData = null, lastEarthquakes = [];
var seenAlertIds = {}, notifPermission = false, searchTimer = null;
var externalAlerts = [], alertsLoading = false;
var dataReady = { weather: false, earthquakes: false };

// ========== AUDIO ==========
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
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sawtooth';
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
    var coastal = /coast|ocean|pacific|atlantic|mar |sea /i.test(place);
    if (mag >= 8.0) return 'ROJA';
    if (mag >= 7.0 && coastal && depth < 70) return 'TSUNAMI';
    if (mag >= 6.5) return 'NARANJA';
    if (mag >= 5.5) return 'AMARILLA';
    return null;
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function() {
    setLanguage(currentLang);
    document.addEventListener('click', function unlock() {
        var c = getAudio(); if (c && c.state === 'suspended') c.resume();
        document.removeEventListener('click', unlock);
    }, { once: true });
    setupTabs();
    setupLocationButtons();
    setupLanguageSelector();
    setupSearch();
    setupFavorites();
    requestNotificationPermission();
    initLocation();
    setInterval(function() { loadAlerts(); }, CONFIG.ALERTS_INTERVAL);
    setInterval(function() { if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon); }, CONFIG.WEATHER_INTERVAL);
    setTimeout(function() {
        loadExternalSourcesData();
        setInterval(loadExternalSourcesData, 300000);
    }, 8000);
});

// ========== NOTIFICATIONS ==========
function requestNotificationPermission() {
    if ('Notification' in window) Notification.requestPermission().then(function(p) { notifPermission = p === 'granted'; });
}
function sendNotification(title, body, urgency) {
    if (notifPermission) try { new Notification(title, { body: body, icon: 'img/icon.svg' }); } catch(e) {}
    var colors = { critical: '#B71C1C', high: '#F44336', medium: '#FF9800', info: '#1976D2' };
    var old = document.getElementById('alertBanner'); if (old) old.remove();
    var b = document.createElement('div');
    b.id = 'alertBanner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:'+(colors[urgency]||colors.info)+';color:#fff;padding:12px 16px;z-index:500;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,0.4);animation:slideDown 0.3s ease;font-family:inherit;';
    b.innerHTML = '<div style="flex:1"><div style="font-weight:700;font-size:14px">'+title+'</div><div style="font-size:12px;opacity:0.9;margin-top:2px">'+body+'</div></div><button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,0.25);border:none;color:#fff;font-size:18px;cursor:pointer;padding:4px 10px;border-radius:6px">✕</button>';
    document.body.appendChild(b);
    setTimeout(function() { if (b.parentNode) b.remove(); }, 10000);
}

// ========== EMERGENCY MODAL ==========
function showEmergencyModal(title, place, mag, depth, level) {
    var old = document.getElementById('em_modal'); if (old) old.remove();
    var colors = { ROJA: '#B71C1C', TSUNAMI: '#880E4F', NARANJA: '#E65100', AMARILLA: '#F57F17' };
    var modal = document.createElement('div');
    modal.id = 'em_modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';
    var instrucciones = level === 'TSUNAMI'
        ? '🌊 EVACÚA INMEDIATAMENTE hacia zonas altas.<br>📍 Aléjate de la costa y ríos.<br>🚫 No regreses hasta autorización.'
        : '⚠️ Mantén la calma. Aléjate de ventanas.<br>🚪 No uses ascensores.<br>🔥 Revisa posibles fugas de gas.';
    modal.innerHTML = '<div style="background:'+(colors[level]||colors.ROJA)+';border-radius:16px;padding:24px;max-width:380px;width:100%;color:#fff;text-align:center;">'
        +'<div style="font-size:48px;margin-bottom:12px">'+(level==='TSUNAMI'?'🌊':'🚨')+'</div>'
        +'<div style="font-size:22px;font-weight:800;margin-bottom:8px">'+title+'</div>'
        +'<div style="font-size:15px;opacity:0.9;margin-bottom:16px">'+place+'</div>'
        +'<div style="display:flex;gap:12px;justify-content:center;margin-bottom:16px">'
        +'<span style="background:rgba(255,255,255,0.2);padding:8px 14px;border-radius:8px;font-weight:700">M'+mag.toFixed(1)+'</span>'
        +'<span style="background:rgba(255,255,255,0.2);padding:8px 14px;border-radius:8px">⬇️ '+depth+' km</span>'
        +'</div>'
        +'<div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:12px;margin-bottom:16px;font-size:14px;text-align:left;line-height:1.6">'+instrucciones+'</div>'
        +'<button onclick="document.getElementById(\'em_modal\').remove()" style="background:#fff;color:'+(colors[level]||colors.ROJA)+';border:none;border-radius:10px;padding:12px 24px;font-size:16px;font-weight:800;cursor:pointer;width:100%">ENTENDIDO</button>'
        +'</div>';
    document.body.appendChild(modal);
    setTimeout(function() { if (modal.parentNode) modal.remove(); }, 30000);
}

// ========== TABS ==========
function setupTabs() {
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
            document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
            this.classList.add('active');
            document.getElementById('panel-'+this.dataset.tab).classList.add('active');
            if (this.dataset.tab === 'mapa' && !mapInitialized) initMap();
            if (this.dataset.tab === 'tips') refreshSmartTips();
        });
    });
}

// ========== GEOLOCATION ==========
function initLocation() {
    updateLocationDisplay('Detectando...');

    if (!navigator.geolocation) {
        updateLocationDisplay('Global');
        loadAlerts();
        return;
    }

    // maximumAge:300000 = usa posición cacheada de hasta 5 min → instantáneo
    // Try HIGH accuracy first (real GPS/WiFi positioning)
    // Falls back to low accuracy if fails (cell tower / IP)
    function tryGPS(highAccuracy) {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                var lat = pos.coords.latitude;
                var lon = pos.coords.longitude;
                var accuracy = pos.coords.accuracy; // meters

                currentLocation = { lat: lat, lon: lon, name: lat.toFixed(2)+', '+lon.toFixed(2), country: '' };
                updateLocationDisplay(currentLocation.name);
                loadAlerts();
                loadWeather(lat, lon);
                renderSavedLocations();
                updateStarButtons();

                // Get city name in background
                LocationManager.reverseGeocode(lat, lon).then(function(geo) {
                    if (geo && geo.city && geo.city.length > 1) {
                        currentLocation.name = geo.city;
                        currentLocation.country = geo.country || '';
                    }
                    LocationManager.setCurrent(currentLocation);
                    updateLocationDisplay(currentLocation.name);
                    updateStarButtons();
                    // Show accuracy warning only if very imprecise (IP-based)
                    if (accuracy > 10000) {
                        showLocationAccuracyBanner(currentLocation.name);
                    }
                }).catch(function() {});
            },
            function(err) {
                if (highAccuracy) {
                    // High accuracy failed — try low accuracy as fallback
                    tryGPS(false);
                } else {
                    // Both failed — load global alerts
                    updateLocationDisplay('Global');
                    loadAlerts();
                    renderSavedLocations();
                }
            },
            {
                enableHighAccuracy: highAccuracy,
                timeout: highAccuracy ? 8000 : 5000,
                maximumAge: highAccuracy ? 60000 : 300000
            }
        );
    }
    tryGPS(true); // start with high accuracy (GPS/WiFi)
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

function createUserIcon() {
    return L.divIcon({ html: '<div style="background:#6200EE;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(98,0,238,0.7)"></div>', iconSize: [18,18], iconAnchor: [9,9] });
}

// ========== UTILS ==========
function closePopups() {
    ['searchPopup','langPopup','favoritesPopup','sharePopup'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.style.display = 'none';
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
    return new Date(ts).toLocaleString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function calcRisk(mag) {
    if (mag >= 8) return { label:'⚫ EXTREMO', color:'#212121' };
    if (mag >= 7) return { label:'🔴 CRÍTICO', color:'#B71C1C' };
    if (mag >= 5) return { label:'🟠 ALTO', color:'#E64A19' };
    if (mag >= 4) return { label:'🟡 MEDIO', color:'#F57F17' };
    return { label:'🟢 BAJO', color:'#2E7D32' };
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
            return '<div class="saved-loc"><button class="saved-loc-btn" onclick="selectLocation({name:\''+sn+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+sc+'\'})">📍 '+l.name+'</button><button class="saved-loc-remove" onclick="removeSavedLocation(\''+sn+'\')">✕</button></div>';
        }).join('');
    });
}
function removeSavedLocation(name) { LocationManager.remove(name); renderSavedLocations(); showToast('Eliminado'); }

// ========== BUTTONS ==========
function setupLocationButtons() {
    // 📍 Button: always fresh GPS, clear saved
    document.getElementById('btnMyLocation').addEventListener('click', function() {
        try { localStorage.removeItem('ag_current'); } catch(e) {}
        currentLocation = { lat: null, lon: null, name: '', country: '' };
        updateLocationDisplay('Detectando...');
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(function(pos) {
            var lat = pos.coords.latitude, lon = pos.coords.longitude;
            currentLocation = { lat: lat, lon: lon, name: lat.toFixed(2)+', '+lon.toFixed(2), country: '' };
            updateLocationDisplay(currentLocation.name);
            alertsLoading = false;
            loadAlerts();
            loadWeather(lat, lon);
            LocationManager.reverseGeocode(lat, lon).then(function(geo) {
                if (geo && geo.city) {
                    currentLocation.name = geo.city;
                    currentLocation.country = geo.country || '';
                }
                LocationManager.setCurrent(currentLocation);
                updateLocationDisplay(currentLocation.name);
            }).catch(function(){});
        }, function() { showToast('⚠️ No se pudo obtener ubicación'); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });

    document.getElementById('btnSearchLocation').addEventListener('click', openSearch);

    document.getElementById('btnWeatherLocation').addEventListener('click', function() {
        try { localStorage.removeItem('ag_current'); } catch(e) {}
        document.getElementById('btnMyLocation').click();
    });

    document.getElementById('btnWeatherSearch').addEventListener('click', openSearch);

    document.getElementById('btnSaveLocation').addEventListener('click', function() {
        if (!currentLocation.lat) { showToast('📍 Detecta tu ubicación primero'); return; }
        var ok = LocationManager.save(currentLocation);
        renderSavedLocations();
        showToast(ok ? '⭐ Guardado: '+currentLocation.name : '⭐ '+currentLocation.name);
        updateFavBadge();
    });

    document.getElementById('btnRefresh').addEventListener('click', function() {
        alertsLoading = false;
        loadAlerts();
        if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon);
        showToast('✅ Actualizando...');
    });
}

// ========== SEARCH ==========
function setupSearch() {
    document.getElementById('closeSearch').addEventListener('click', closePopups);
    document.getElementById('searchBtn').addEventListener('click', doSearch);
    document.getElementById('searchPopup').addEventListener('click', function(e) { if (e.target===this) closePopups(); });
    var input = document.getElementById('searchInput');
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
function openSearch() {
    document.getElementById('searchPopup').style.display='flex';
    document.getElementById('searchInput').value='';
    document.getElementById('searchResults').innerHTML='';
    setTimeout(function() { document.getElementById('searchInput').focus(); }, 150);
}
function doSearch() {
    var q = document.getElementById('searchInput').value.trim();
    if (q.length < 2) return;
    var r = document.getElementById('searchResults');
    r.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    LocationManager.search(q).then(function(locs) {
        if (!locs.length) { r.innerHTML='<p style="text-align:center;color:#999;padding:16px">Sin resultados</p>'; return; }
        r.innerHTML = locs.map(function(l) {
            return '<button class="search-result" onclick="selectLocation({name:\''+l.name.replace(/'/g,"\\'")+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+l.country.replace(/'/g,"\\'")+'\'})">'
                +'<strong>'+l.name+'</strong><br><small>'+l.fullName+'</small></button>';
        }).join('');
    }).catch(function(e) { r.innerHTML='<p style="color:red;padding:16px">Error: '+e.message+'</p>'; });
}

// ========== LANGUAGE ==========
function setupLanguageSelector() {
    document.getElementById('btnLang').addEventListener('click', function() {
        var lp = document.getElementById('langPopup');
        lp.style.display='flex';
        lp.onclick = function(e) { if (e.target===lp) closePopups(); };
    });
    document.getElementById('closeLang').addEventListener('click', closePopups);
    document.querySelectorAll('.lang-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            setLanguage(this.dataset.lang); closePopups(); refreshSmartTips();
            if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon);
            showToast('🌐 '+this.textContent.trim());
        });
    });
}

// ========== FAVORITES ==========
function setupFavorites() {
    document.getElementById('btnStarAlert').addEventListener('click', toggleFavorite);
    document.getElementById('btnStarWeather').addEventListener('click', toggleFavorite);
    document.getElementById('btnFavorites').addEventListener('click', openFavorites);
    document.getElementById('closeFavorites').addEventListener('click', closePopups);
    document.getElementById('favoritesPopup').addEventListener('click', function(e) { if (e.target===this) closePopups(); });
    document.getElementById('closeShare').addEventListener('click', closePopups);
    document.getElementById('sharePopup').addEventListener('click', function(e) { if (e.target===this) closePopups(); });
    updateStarButtons(); updateFavBadge();
}
function toggleFavorite() {
    if (!currentLocation.lat) { showToast('📍 Detecta tu ubicación primero'); return; }
    var exists = LocationManager.getAll().find(function(l) { return l.name===currentLocation.name; });
    if (exists) { LocationManager.remove(currentLocation.name); showToast('Eliminado de favoritos'); }
    else { LocationManager.save(currentLocation); showToast('⭐ Guardado: '+currentLocation.name); }
    updateStarButtons(); updateFavBadge();
}
function updateStarButtons() {
    var isFav = currentLocation.name && LocationManager.getAll().find(function(l) { return l.name===currentLocation.name; });
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
            return '<div class="fav-item">'
                +'<div class="fav-item-info" onclick="selectLocation({name:\''+sn+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+sc+'\'});closePopups()">'
                +'<div class="fav-item-name">⭐ '+l.name+'</div>'
                +'<div class="fav-item-country">'+(l.country||'')+' · '+l.lat.toFixed(2)+', '+l.lon.toFixed(2)+'</div></div>'
                +'<div class="fav-item-actions">'
                +'<button class="fav-go-btn" onclick="selectLocation({name:\''+sn+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+sc+'\'});closePopups()">Ir →</button>'
                +'<button class="fav-del-btn" onclick="removeFavorite(\''+sn+'\')">🗑️</button></div></div>';
        }).join('');
    }
    document.getElementById('favoritesPopup').style.display='flex';
}
function removeFavorite(name) { LocationManager.remove(name); updateStarButtons(); updateFavBadge(); openFavorites(); showToast('🗑️ Eliminado'); }

// ========== SHARE ==========
function openShare(text) {
    document.getElementById('shareContent').textContent = text;
    var enc = encodeURIComponent(text), url = encodeURIComponent('https://appcml.github.io/AlertaGlobal/');
    document.getElementById('shareWhatsapp').onclick = function() { window.open('https://wa.me/?text='+enc,'_blank'); };
    document.getElementById('shareTwitter').onclick = function() { window.open('https://twitter.com/intent/tweet?text='+enc+'&url='+url,'_blank'); };
    document.getElementById('shareFacebook').onclick = function() { window.open('https://www.facebook.com/sharer/sharer.php?u='+url+'&quote='+enc,'_blank'); };
    document.getElementById('shareTelegram').onclick = function() { window.open('https://t.me/share/url?url='+url+'&text='+enc,'_blank'); };
    document.getElementById('shareCopy').onclick = function() {
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(function() { showToast('📋 Copiado'); });
        else { var ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('📋 Copiado'); }
    };
    var nb = document.getElementById('shareNative');
    if (nb) { nb.style.display=navigator.share?'flex':'none'; nb.onclick=function() { navigator.share({title:'Alerta Global',text:text,url:'https://appcml.github.io/AlertaGlobal/'}); }; }
    document.getElementById('sharePopup').style.display='flex';
}
function buildShareText(type, data) {
    var app = '\n🌍 Alerta Global — appcml.github.io/AlertaGlobal/';
    if (type==='earthquake') return (data.mag>=7?'🚨':'⚠️')+' SISMO M'+data.mag.toFixed(1)+'\n📍 '+data.place+'\n⬇️ Prof: '+data.depth+' km\n'+(data.dist?'📏 '+data.dist+' km de '+(currentLocation.name||'tu zona')+'\n':'')+'🕐 '+data.time+app;
    if (type==='weather') return '🌤️ CLIMA — '+data.city+'\n🌡️ '+data.temp+'°C\n☁️ '+data.desc+'\n💧 '+data.hum+'%  💨 '+data.wind+' m/s'+app;
    return app;
}


// Show banner when GPS accuracy is low (PC/IP-based location)
function showLocationAccuracyBanner(detectedCity) {
    var old = document.getElementById('locAccBanner');
    if (old) return; // already showing
    var b = document.createElement('div');
    b.id = 'locAccBanner';
    b.style.cssText = 'background:#E8F5E9;border-left:4px solid #4CAF50;padding:10px 14px;margin:6px 10px;border-radius:10px;font-size:13px;display:flex;align-items:center;gap:10px;';
    b.innerHTML = '<div style="flex:1">📍 Detectado: <strong>'+detectedCity+'</strong><br><span style="color:#666;font-size:12px">¿No es tu ubicación real? Búscala manualmente.</span></div>'
        + '<button onclick="openSearch();document.getElementById('locAccBanner').remove()" style="background:#4CAF50;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">Cambiar</button>'
        + '<button onclick="document.getElementById('locAccBanner').remove()" style="background:none;border:none;color:#999;font-size:16px;cursor:pointer;padding:0 4px">✕</button>';
    var alertList = document.getElementById('alertList');
    if (alertList) alertList.insertBefore(b, alertList.firstChild);
}

// ========== ALERTS (TIEMPO REAL) ==========
function loadAlerts() {
    if (alertsLoading) return;
    alertsLoading = true;
    var loading = document.getElementById('alertsLoading');
    var list = document.getElementById('alertList');
    var error = document.getElementById('alertsError');
    loading.style.display='flex'; list.innerHTML=''; error.style.display='none';

    // URL con filtro de ubicación si disponible
    var url;
    if (currentLocation.lat && currentLocation.lon) {
        url = CONFIG.USGS_BASE + '&latitude='+currentLocation.lat+'&longitude='+currentLocation.lon+'&maxradiuskm=2000';
    } else {
        url = CONFIG.USGS_GLOBAL;
    }

    var ctrl = typeof AbortController!=='undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 9000) : null;

    fetch(url, ctrl ? { signal: ctrl.signal } : {})
        .then(function(r) { if (timer) clearTimeout(timer); return r.json(); })
        .then(function(data) {
            alertsLoading = false;
            loading.style.display='none';
            lastEarthquakes = data.features || [];
            dataReady.earthquakes = true;

            // Ordenar más reciente primero
            lastEarthquakes.sort(function(a, b) { return b.properties.time - a.properties.time; });

            var now = Date.now();
            lastEarthquakes.forEach(function(f) {
                if (seenAlertIds[f.id]) return;
                seenAlertIds[f.id] = true;
                var mag = f.properties.mag, place = f.properties.place || '', depth = f.geometry.coordinates[2];
                if ((now - f.properties.time) > 1800000) return; // only notify last 30min
                var level = checkAlertLevel(mag, depth, place);
                if (level === 'ROJA' || level === 'TSUNAMI') {
                    playSiren();
                    showEmergencyModal('🚨 ALERTA '+level+' M'+mag.toFixed(1), place, mag, depth.toFixed(0), level);
                    sendNotification('🚨 ALERTA '+level+' M'+mag.toFixed(1), place, 'critical');
                } else if (level === 'NARANJA') {
                    playBeep(660, 0.5, 'square'); setTimeout(function(){playBeep(660,0.5,'square');},400);
                    sendNotification('🟠 SISMO M'+mag.toFixed(1), place, 'high');
                } else if (level === 'AMARILLA' || mag >= 5.0) {
                    playBeep(880, 0.4);
                    sendNotification('⚠️ SISMO M'+mag.toFixed(1), place, 'medium');
                }
            });

            list.innerHTML = '';
            if (!lastEarthquakes.length) {
                list.innerHTML = '<div class="loading"><p>No hay alertas recientes</p></div>';
            } else {
                lastEarthquakes.forEach(function(f) {
                    var mag=f.properties.mag, place=f.properties.place||'?', time=f.properties.time;
                    var c=f.geometry.coordinates, depth=c[2].toFixed(1);
                    var risk=calcRisk(mag);
                    var dist=currentLocation.lat?calcDistance(currentLocation.lat,currentLocation.lon,c[1],c[0]):null;
                    var tsunami=(mag>=7&&parseFloat(depth)<70)?'<div class="tsunami-warning">🌊 Posible riesgo de tsunami</div>':'';
                    var isRecent=(now-time)<3600000;
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

function addWeatherAlertCards(list) {
    var d=lastWeatherData, main=d.weather[0].main.toLowerCase(), desc=d.weather[0].description;
    var temp=d.main.temp, wind=d.wind.speed, city=d.name||currentLocation.name||'';
    var alerts=[];
    if(main==='thunderstorm') alerts.push({icon:'⛈️',type:'TORMENTA ELÉCTRICA',title:'Tormenta eléctrica — '+city,detail:'Busca refugio interior.',color:'#B71C1C'});
    if(main==='rain'||main==='drizzle') alerts.push({icon:'🌧️',type:'LLUVIA',title:desc+' — '+city,detail:'Hum. '+d.main.humidity+'% · Viento '+wind.toFixed(0)+' m/s',color:'#1565C0'});
    if(main==='snow') alerts.push({icon:'❄️',type:'NEVADA',title:'Nevando — '+city,detail:Math.round(temp)+'°C',color:'#0277BD'});
    if(main==='tornado') alerts.push({icon:'🌪️',type:'TORNADO',title:'Tornado — EMERGENCIA',detail:'Busca refugio inmediato.',color:'#000'});
    if(main==='mist'||main==='fog') alerts.push({icon:'🌫️',type:'NIEBLA',title:'Visibilidad reducida — '+city,detail:'Conduce con luces bajas.',color:'#546E7A'});
    if(wind>15) alerts.push({icon:'💨',type:'VIENTO EXTREMO',title:'Viento '+wind.toFixed(0)+' m/s — '+city,detail:'Asegura objetos sueltos.',color:'#E64A19'});
    else if(wind>10) alerts.push({icon:'💨',type:'VIENTO FUERTE',title:'Viento '+wind.toFixed(0)+' m/s — '+city,detail:'Precaución en caminos.',color:'#FF6F00'});
    if(temp>38) alerts.push({icon:'🔥',type:'OLA DE CALOR',title:Math.round(temp)+'°C — '+city,detail:'Hidrátate. Evita salir.',color:'#B71C1C'});
    if(temp<-5) alerts.push({icon:'🥶',type:'OLA DE FRÍO',title:Math.round(temp)+'°C — '+city,detail:'Riesgo hipotermia.',color:'#0D47A1'});
    else if(temp<3) alerts.push({icon:'❄️',type:'FRÍO INTENSO',title:Math.round(temp)+'°C — '+city,detail:'Protege cañerías y plantas.',color:'#1565C0'});
    alerts.forEach(function(a) {
        var card=document.createElement('div'); card.className='alert-card weather-alert-card'; card.style.borderLeftColor=a.color;
        card.innerHTML='<div class="alert-header"><span class="alert-type" style="background:'+a.color+'">'+a.icon+' '+a.type+'</span></div><div class="alert-title">'+a.title+'</div><div class="alert-location">'+a.detail+'</div><div class="alert-footer"><span>🕐 Ahora</span><span>📡 OpenWeather</span></div>';
        list.appendChild(card);
    });
}

function renderExternalAlerts() {
    var list = document.getElementById('alertList'); if (!list) return;
    list.querySelectorAll('.ext-alert-card').forEach(function(c) { c.remove(); });
    externalAlerts.forEach(function(a) {
        var card=document.createElement('div'); card.className='alert-card ext-alert-card'; card.style.borderLeftColor=a.color;
        card.innerHTML='<div class="alert-header"><span class="alert-type" style="background:'+a.color+'">'+a.icon+' '+a.type+'</span></div><div class="alert-title">'+a.title+'</div>'+(a.description?'<div class="alert-location">'+a.description+'</div>':'')+'<div class="alert-footer"><span>📡 '+a.source+'</span>'+(a.link?'<a href="'+a.link+'" target="_blank" style="color:#6200EE;font-size:11px">Ver más →</a>':'')+'</div>';
        list.appendChild(card);
    });
}

function loadExternalSourcesData() {
    if (typeof loadExternalSources === 'undefined') return;
    loadExternalSources(function(alerts) {
        externalAlerts = alerts;
        externalAlerts.forEach(function(a) {
            var id='ext_'+a.title.substring(0,30);
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

// ========== WEATHER ==========
function loadWeather(lat, lon) {
    var loading=document.getElementById('weatherLoading'), container=document.getElementById('weatherContainer'), error=document.getElementById('weatherError');
    loading.style.display='flex'; container.style.display='none'; error.style.display='none';
    fetch(CONFIG.WEATHER_URL+'?lat='+lat+'&lon='+lon+'&appid='+CONFIG.WEATHER_API_KEY+'&units=metric&lang='+currentLang)
        .then(function(r){return r.json();}).then(function(d) {
            loading.style.display='none'; container.style.display='block';
            lastWeatherData=d; dataReady.weather=true;
            document.getElementById('wCity').textContent=d.name||currentLocation.name;
            document.getElementById('wTemp').textContent=Math.round(d.main.temp)+'°C';
            document.getElementById('wDesc').textContent=d.weather[0].description;
            document.getElementById('wHumidity').textContent=d.main.humidity+'%';
            document.getElementById('wWind').textContent=d.wind.speed+' m/s';
            document.getElementById('wFeels').textContent=Math.round(d.main.feels_like)+'°C';
            document.getElementById('wPressure').textContent=d.main.pressure+' hPa';
            var temp=d.main.temp, rec;
            if(temp>35)rec='🔥 Extremadamente caluroso. Evita salir.';
            else if(temp>30)rec='☀️ Muy caluroso. Hidrátate.';
            else if(temp>25)rec='🌤️ Caluroso. Usa protector solar.';
            else if(temp>15)rec='🌈 Condiciones agradables.';
            else if(temp>10)rec='🍂 Fresco. Lleva chaqueta.';
            else if(temp>0)rec='❄️ Frío. Abrígate bien.';
            else rec='🥶 Congelante. No salgas sin necesidad.';
            document.getElementById('wRecommendation').textContent=rec;
            var wsb=document.getElementById('wShareBtn');
            if (!wsb) { wsb=document.createElement('button'); wsb.id='wShareBtn'; wsb.className='alert-share-btn'; wsb.style.marginTop='12px'; wsb.textContent='📤 Compartir clima'; container.appendChild(wsb); }
            wsb.onclick=function(){ openShare(buildShareText('weather',{city:d.name||currentLocation.name,temp:Math.round(d.main.temp),desc:d.weather[0].description,hum:d.main.humidity,wind:d.wind.speed})); };
            var main=d.weather[0].main.toLowerCase();
            if(main==='thunderstorm') { playSiren(); sendNotification('⛈️ Tormenta eléctrica','En '+(d.name||currentLocation.name)+'. Refúgiate.','critical'); }
            else if(d.wind.speed>15) { playBeep(660,0.5); sendNotification('💨 Viento extremo: '+d.wind.speed.toFixed(0)+' m/s','En '+(d.name||currentLocation.name),'high'); }
            var al=document.getElementById('alertList');
            if(al){al.querySelectorAll('.weather-alert-card').forEach(function(c){c.remove();});addWeatherAlertCards(al);}
            loadForecast(lat, lon);
        }).catch(function(e){loading.style.display='none';error.style.display='block';error.textContent='⚠️ '+e.message;});
}

function loadForecast(lat, lon) {
    fetch(CONFIG.FORECAST_URL+'?lat='+lat+'&lon='+lon+'&appid='+CONFIG.WEATHER_API_KEY+'&units=metric&lang='+currentLang+'&cnt=16')
        .then(function(r){return r.json();}).then(function(d){lastForecastData=d;refreshSmartTips();}).catch(function(){refreshSmartTips();});
}

// ========== SMART TIPS ==========
function refreshSmartTips() {
    if (!dataReady.weather && !dataReady.earthquakes) {
        document.getElementById('tipsList').innerHTML='<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>';
        return;
    }
    var tips=[], now=Date.now();
    if (lastEarthquakes.length) {
        var big=lastEarthquakes.filter(function(f){return (now-f.properties.time)<3600000&&f.properties.mag>=6;});
        if (big.length) {
            var eq=big[0], mag=eq.properties.mag, place=eq.properties.place;
            var dist=currentLocation.lat?calcDistance(currentLocation.lat,currentLocation.lon,eq.geometry.coordinates[1],eq.geometry.coordinates[0]):null;
            tips.push({title:'🚨 SISMO M'+mag.toFixed(1)+' — HACE MENOS DE 1H',desc:'Epicentro: '+place+(dist?' · '+dist+' km de ti':'')+'. Mantén la calma. Aléjate de ventanas.',cat:'⚫ EMERGENCIA',color:'#B71C1C',priority:100});
            if(mag>=7&&eq.geometry.coordinates[2]<70) tips.push({title:'🌊 RIESGO DE TSUNAMI',desc:'Evacúa INMEDIATAMENTE a zonas altas. No regreses hasta autorización.',cat:'⚫ EMERGENCIA',color:'#880E4F',priority:99});
        }
        var mod=lastEarthquakes.filter(function(f){return (now-f.properties.time)<21600000&&f.properties.mag>=5;});
        if(mod.length&&!big.length) tips.push({title:'⚠️ '+mod.length+' sismos M5+ en 6h',desc:'Actividad sísmica elevada. Ten lista tu mochila de emergencia.',cat:'🟠 PRECAUCIÓN',color:'#E65100',priority:75});
    }
    if (lastWeatherData) {
        var d=lastWeatherData, temp=d.main.temp, wind=d.wind.speed, hum=d.main.humidity;
        var main=d.weather[0].main.toLowerCase(), desc2=d.weather[0].description, city=d.name||currentLocation.name||'tu zona';
        if(main==='thunderstorm') tips.push({title:'⛈️ TORMENTA ELÉCTRICA — '+city,desc:'No permanezcas bajo árboles. Desconecta aparatos. Refúgiate.',cat:'🔴 EMERGENCIA',color:'#B71C1C',priority:95});
        if(main==='tornado') tips.push({title:'🌪️ TORNADO',desc:'Busca refugio en sótano. Aléjate de ventanas.',cat:'⚫ EXTREMO',color:'#000',priority:98});
        if(main==='rain'||main==='drizzle') tips.push({title:'🌧️ LLUVIA: '+desc2+' — '+city,desc:'Lleva paraguas. Conduce con precaución. Evita zonas inundables.',cat:'🟡 PRECAUCIÓN',color:'#1565C0',priority:85});
        if(main==='snow') tips.push({title:'❄️ NEVANDO — '+city,desc:'Conduce solo si es necesario. Abrígate en capas.',cat:'🟠 PRECAUCIÓN',color:'#0277BD',priority:83});
        if(main==='mist'||main==='fog') tips.push({title:'🌫️ NIEBLA — '+city,desc:'Usa luces bajas. Reduce velocidad.',cat:'🟡 PRECAUCIÓN',color:'#546E7A',priority:70});
        if(wind>15) tips.push({title:'💨 VIENTO EXTREMO: '+wind.toFixed(0)+' m/s — '+city,desc:'Asegura objetos. Evita zonas con árboles grandes.',cat:'🔴 ALTO',color:'#E64A19',priority:88});
        else if(wind>10) tips.push({title:'💨 VIENTO FUERTE: '+wind.toFixed(0)+' m/s — '+city,desc:desc2+'. Asegura toldos y objetos exteriores.',cat:'🟠 PRECAUCIÓN',color:'#FF6F00',priority:60});
        if(temp>38) tips.push({title:'🔥 CALOR EXTREMO: '+Math.round(temp)+'°C',desc:'Hidrátate cada 20 min. Evita salir al mediodía.',cat:'🔴 EMERGENCIA',color:'#B71C1C',priority:90});
        else if(temp>30) tips.push({title:'☀️ MUCHO CALOR: '+Math.round(temp)+'°C',desc:'Bebe agua. Busca sombra.',cat:'🟡 PRECAUCIÓN',color:'#FF6F00',priority:65});
        if(temp<-5) tips.push({title:'🥶 CONGELANTE: '+Math.round(temp)+'°C',desc:'Riesgo de hipotermia. No salgas sin necesidad.',cat:'🔴 EMERGENCIA',color:'#0D47A1',priority:89});
        else if(temp<3) tips.push({title:'❄️ BAJO 3°C: '+Math.round(temp)+'°C — '+city,desc:desc2+' con '+Math.round(temp)+'°C. Abrígate. Protege plantas.',cat:'🟠 PRECAUCIÓN',color:'#1565C0',priority:70});
        else if(temp<10) tips.push({title:'🌬️ DÍA FRÍO: '+Math.round(temp)+'°C — '+city,desc:desc2+' con '+Math.round(temp)+'°C y '+hum+'% humedad'+(wind>8?' · Viento '+wind.toFixed(0)+' m/s':'')+'. Lleva chaqueta.',cat:'🟢 PREVENCIÓN',color:'#0288D1',priority:35});
        if((main==='clouds')&&temp>5&&temp<=15) tips.push({title:'☁️ NUBLADO Y FRESCO: '+Math.round(temp)+'°C — '+city,desc:desc2+'. Lleva chaqueta o polar.',cat:'🟢 PREVENCIÓN',color:'#0288D1',priority:30});
        if(main==='clear'&&temp>10&&temp<=25) tips.push({title:'☀️ DÍA DESPEJADO: '+Math.round(temp)+'°C — '+city,desc:'Usa protector solar al aire libre.',cat:'🟢 PREVENCIÓN',color:'#F57F17',priority:25});
    }
    if(tips.length<2){
        tips.push({title:'🎒 Mochila de emergencia',desc:'Agua, linterna, radio a pilas, documentos y medicamentos.',cat:'🟢 PREVENCIÓN',color:'#795548',priority:10});
        tips.push({title:'📱 Emergencias Chile',desc:'Bomberos 132 · Ambulancia 131 · Carabineros 133 · SENAPRED 1470',cat:'🟢 PREVENCIÓN',color:'#607D8B',priority:5});
    }
    tips.sort(function(a,b){return b.priority-a.priority;});
    var list=document.getElementById('tipsList'); list.innerHTML='';
    var h=document.createElement('div'); h.style.cssText='padding:8px 12px;font-size:11px;color:#999;text-align:right;';
    h.textContent='🔄 '+new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})+(currentLocation.name?' — '+currentLocation.name:'');
    list.appendChild(h);
    tips.forEach(function(tip){
        var card=document.createElement('div'); card.className='tip-card'; card.style.borderLeft='4px solid '+tip.color;
        if(tip.priority>=85){card.style.background=tip.color+'12';card.style.border='1px solid '+tip.color+'40';card.style.borderLeft='4px solid '+tip.color;}
        card.innerHTML='<span class="tip-category" style="color:'+tip.color+';background:'+tip.color+'18">'+tip.cat+'</span><div class="tip-title">'+tip.title+'</div><div class="tip-desc">'+tip.desc+'</div>';
        list.appendChild(card);
    });
}

// ========== MAP ==========
function initMap() {
    var lat=currentLocation.lat||-37.8, lon=currentLocation.lon||-73.4;
    leafletMap=L.map('map').setView([lat,lon],7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(leafletMap);
    if(currentLocation.lat){
        userMarker=L.marker([currentLocation.lat,currentLocation.lon],{icon:createUserIcon()}).addTo(leafletMap).bindPopup('<b>📍 '+currentLocation.name+'</b>').openPopup();
    }
    fetch(CONFIG.USGS_GLOBAL).then(function(r){return r.json();}).then(function(data){
        data.features.forEach(function(f){
            var c=f.geometry.coordinates, mag=f.properties.mag, place=f.properties.place;
            var color=mag>=7?'#B71C1C':mag>=5?'#E64A19':mag>=4?'#FF9800':'#FFC107';
            L.circleMarker([c[1],c[0]],{radius:Math.max(mag*2.5,5),color:color,fillColor:color,fillOpacity:0.7,weight:1})
                .addTo(leafletMap).bindPopup('<b>🌍 M'+mag.toFixed(1)+'</b><br>'+place+'<br><small>Prof: '+c[2].toFixed(0)+' km</small>');
        });
    }).catch(function(){});
    mapInitialized=true;
    setTimeout(function(){leafletMap.invalidateSize();},300);
}// ============================================
// js/app.js — Alerta Global v7 CLEAN
// ============================================
var CONFIG = {
    // USGS filtered by location when available
    USGS_BASE: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=50&minmagnitude=2.0',
    USGS_GLOBAL: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
    WEATHER_API_KEY: '6fe6e0dcca264864dbd631bf620aad64',
    WEATHER_URL: 'https://api.openweathermap.org/data/2.5/weather',
    FORECAST_URL: 'https://api.openweathermap.org/data/2.5/forecast',
    ALERTS_INTERVAL: 120000,   // 2 min
    WEATHER_INTERVAL: 600000   // 10 min
};

var currentLocation = { lat: null, lon: null, name: '', country: '' };
var leafletMap = null, mapInitialized = false, userMarker = null;
var lastWeatherData = null, lastForecastData = null, lastEarthquakes = [];
var seenAlertIds = {}, notifPermission = false, searchTimer = null;
var externalAlerts = [], alertsLoading = false;
var dataReady = { weather: false, earthquakes: false };

// ========== AUDIO ==========
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
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sawtooth';
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
    var coastal = /coast|ocean|pacific|atlantic|mar |sea /i.test(place);
    if (mag >= 8.0) return 'ROJA';
    if (mag >= 7.0 && coastal && depth < 70) return 'TSUNAMI';
    if (mag >= 6.5) return 'NARANJA';
    if (mag >= 5.5) return 'AMARILLA';
    return null;
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function() {
    setLanguage(currentLang);
    document.addEventListener('click', function unlock() {
        var c = getAudio(); if (c && c.state === 'suspended') c.resume();
        document.removeEventListener('click', unlock);
    }, { once: true });
    setupTabs();
    setupLocationButtons();
    setupLanguageSelector();
    setupSearch();
    setupFavorites();
    requestNotificationPermission();
    initLocation();
    setInterval(function() { loadAlerts(); }, CONFIG.ALERTS_INTERVAL);
    setInterval(function() { if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon); }, CONFIG.WEATHER_INTERVAL);
    setTimeout(function() {
        loadExternalSourcesData();
        setInterval(loadExternalSourcesData, 300000);
    }, 8000);
});

// ========== NOTIFICATIONS ==========
function requestNotificationPermission() {
    if ('Notification' in window) Notification.requestPermission().then(function(p) { notifPermission = p === 'granted'; });
}
function sendNotification(title, body, urgency) {
    if (notifPermission) try { new Notification(title, { body: body, icon: 'img/icon.svg' }); } catch(e) {}
    var colors = { critical: '#B71C1C', high: '#F44336', medium: '#FF9800', info: '#1976D2' };
    var old = document.getElementById('alertBanner'); if (old) old.remove();
    var b = document.createElement('div');
    b.id = 'alertBanner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:'+(colors[urgency]||colors.info)+';color:#fff;padding:12px 16px;z-index:500;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,0.4);animation:slideDown 0.3s ease;font-family:inherit;';
    b.innerHTML = '<div style="flex:1"><div style="font-weight:700;font-size:14px">'+title+'</div><div style="font-size:12px;opacity:0.9;margin-top:2px">'+body+'</div></div><button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,0.25);border:none;color:#fff;font-size:18px;cursor:pointer;padding:4px 10px;border-radius:6px">✕</button>';
    document.body.appendChild(b);
    setTimeout(function() { if (b.parentNode) b.remove(); }, 10000);
}

// ========== EMERGENCY MODAL ==========
function showEmergencyModal(title, place, mag, depth, level) {
    var old = document.getElementById('em_modal'); if (old) old.remove();
    var colors = { ROJA: '#B71C1C', TSUNAMI: '#880E4F', NARANJA: '#E65100', AMARILLA: '#F57F17' };
    var modal = document.createElement('div');
    modal.id = 'em_modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';
    var instrucciones = level === 'TSUNAMI'
        ? '🌊 EVACÚA INMEDIATAMENTE hacia zonas altas.<br>📍 Aléjate de la costa y ríos.<br>🚫 No regreses hasta autorización.'
        : '⚠️ Mantén la calma. Aléjate de ventanas.<br>🚪 No uses ascensores.<br>🔥 Revisa posibles fugas de gas.';
    modal.innerHTML = '<div style="background:'+(colors[level]||colors.ROJA)+';border-radius:16px;padding:24px;max-width:380px;width:100%;color:#fff;text-align:center;">'
        +'<div style="font-size:48px;margin-bottom:12px">'+(level==='TSUNAMI'?'🌊':'🚨')+'</div>'
        +'<div style="font-size:22px;font-weight:800;margin-bottom:8px">'+title+'</div>'
        +'<div style="font-size:15px;opacity:0.9;margin-bottom:16px">'+place+'</div>'
        +'<div style="display:flex;gap:12px;justify-content:center;margin-bottom:16px">'
        +'<span style="background:rgba(255,255,255,0.2);padding:8px 14px;border-radius:8px;font-weight:700">M'+mag.toFixed(1)+'</span>'
        +'<span style="background:rgba(255,255,255,0.2);padding:8px 14px;border-radius:8px">⬇️ '+depth+' km</span>'
        +'</div>'
        +'<div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:12px;margin-bottom:16px;font-size:14px;text-align:left;line-height:1.6">'+instrucciones+'</div>'
        +'<button onclick="document.getElementById(\'em_modal\').remove()" style="background:#fff;color:'+(colors[level]||colors.ROJA)+';border:none;border-radius:10px;padding:12px 24px;font-size:16px;font-weight:800;cursor:pointer;width:100%">ENTENDIDO</button>'
        +'</div>';
    document.body.appendChild(modal);
    setTimeout(function() { if (modal.parentNode) modal.remove(); }, 30000);
}

// ========== TABS ==========
function setupTabs() {
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
            document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
            this.classList.add('active');
            document.getElementById('panel-'+this.dataset.tab).classList.add('active');
            if (this.dataset.tab === 'mapa' && !mapInitialized) initMap();
            if (this.dataset.tab === 'tips') refreshSmartTips();
        });
    });
}

// ========== GEOLOCATION ==========
function initLocation() {
    updateLocationDisplay('Detectando...');

    if (!navigator.geolocation) {
        updateLocationDisplay('Global');
        loadAlerts();
        return;
    }

    // maximumAge:300000 = usa posición cacheada de hasta 5 min → instantáneo
    // Try HIGH accuracy first (real GPS/WiFi positioning)
    // Falls back to low accuracy if fails (cell tower / IP)
    function tryGPS(highAccuracy) {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                var lat = pos.coords.latitude;
                var lon = pos.coords.longitude;
                var accuracy = pos.coords.accuracy; // meters

                currentLocation = { lat: lat, lon: lon, name: lat.toFixed(2)+', '+lon.toFixed(2), country: '' };
                updateLocationDisplay(currentLocation.name);
                loadAlerts();
                loadWeather(lat, lon);
                renderSavedLocations();
                updateStarButtons();

                // Get city name in background
                LocationManager.reverseGeocode(lat, lon).then(function(geo) {
                    if (geo && geo.city && geo.city.length > 1) {
                        currentLocation.name = geo.city;
                        currentLocation.country = geo.country || '';
                    }
                    LocationManager.setCurrent(currentLocation);
                    updateLocationDisplay(currentLocation.name);
                    updateStarButtons();
                    // Show accuracy warning only if very imprecise (IP-based)
                    if (accuracy > 10000) {
                        showLocationAccuracyBanner(currentLocation.name);
                    }
                }).catch(function() {});
            },
            function(err) {
                if (highAccuracy) {
                    // High accuracy failed — try low accuracy as fallback
                    tryGPS(false);
                } else {
                    // Both failed — load global alerts
                    updateLocationDisplay('Global');
                    loadAlerts();
                    renderSavedLocations();
                }
            },
            {
                enableHighAccuracy: highAccuracy,
                timeout: highAccuracy ? 8000 : 5000,
                maximumAge: highAccuracy ? 60000 : 300000
            }
        );
    }
    tryGPS(true); // start with high accuracy (GPS/WiFi)
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

function createUserIcon() {
    return L.divIcon({ html: '<div style="background:#6200EE;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(98,0,238,0.7)"></div>', iconSize: [18,18], iconAnchor: [9,9] });
}

// ========== UTILS ==========
function closePopups() {
    ['searchPopup','langPopup','favoritesPopup','sharePopup'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.style.display = 'none';
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
    return new Date(ts).toLocaleString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function calcRisk(mag) {
    if (mag >= 8) return { label:'⚫ EXTREMO', color:'#212121' };
    if (mag >= 7) return { label:'🔴 CRÍTICO', color:'#B71C1C' };
    if (mag >= 5) return { label:'🟠 ALTO', color:'#E64A19' };
    if (mag >= 4) return { label:'🟡 MEDIO', color:'#F57F17' };
    return { label:'🟢 BAJO', color:'#2E7D32' };
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
            return '<div class="saved-loc"><button class="saved-loc-btn" onclick="selectLocation({name:\''+sn+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+sc+'\'})">📍 '+l.name+'</button><button class="saved-loc-remove" onclick="removeSavedLocation(\''+sn+'\')">✕</button></div>';
        }).join('');
    });
}
function removeSavedLocation(name) { LocationManager.remove(name); renderSavedLocations(); showToast('Eliminado'); }

// ========== BUTTONS ==========
function setupLocationButtons() {
    // 📍 Button: always fresh GPS, clear saved
    document.getElementById('btnMyLocation').addEventListener('click', function() {
        try { localStorage.removeItem('ag_current'); } catch(e) {}
        currentLocation = { lat: null, lon: null, name: '', country: '' };
        updateLocationDisplay('Detectando...');
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(function(pos) {
            var lat = pos.coords.latitude, lon = pos.coords.longitude;
            currentLocation = { lat: lat, lon: lon, name: lat.toFixed(2)+', '+lon.toFixed(2), country: '' };
            updateLocationDisplay(currentLocation.name);
            alertsLoading = false;
            loadAlerts();
            loadWeather(lat, lon);
            LocationManager.reverseGeocode(lat, lon).then(function(geo) {
                if (geo && geo.city) {
                    currentLocation.name = geo.city;
                    currentLocation.country = geo.country || '';
                }
                LocationManager.setCurrent(currentLocation);
                updateLocationDisplay(currentLocation.name);
            }).catch(function(){});
        }, function() { showToast('⚠️ No se pudo obtener ubicación'); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });

    document.getElementById('btnSearchLocation').addEventListener('click', openSearch);

    document.getElementById('btnWeatherLocation').addEventListener('click', function() {
        try { localStorage.removeItem('ag_current'); } catch(e) {}
        document.getElementById('btnMyLocation').click();
    });

    document.getElementById('btnWeatherSearch').addEventListener('click', openSearch);

    document.getElementById('btnSaveLocation').addEventListener('click', function() {
        if (!currentLocation.lat) { showToast('📍 Detecta tu ubicación primero'); return; }
        var ok = LocationManager.save(currentLocation);
        renderSavedLocations();
        showToast(ok ? '⭐ Guardado: '+currentLocation.name : '⭐ '+currentLocation.name);
        updateFavBadge();
    });

    document.getElementById('btnRefresh').addEventListener('click', function() {
        alertsLoading = false;
        loadAlerts();
        if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon);
        showToast('✅ Actualizando...');
    });
}

// ========== SEARCH ==========
function setupSearch() {
    document.getElementById('closeSearch').addEventListener('click', closePopups);
    document.getElementById('searchBtn').addEventListener('click', doSearch);
    document.getElementById('searchPopup').addEventListener('click', function(e) { if (e.target===this) closePopups(); });
    var input = document.getElementById('searchInput');
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
function openSearch() {
    document.getElementById('searchPopup').style.display='flex';
    document.getElementById('searchInput').value='';
    document.getElementById('searchResults').innerHTML='';
    setTimeout(function() { document.getElementById('searchInput').focus(); }, 150);
}
function doSearch() {
    var q = document.getElementById('searchInput').value.trim();
    if (q.length < 2) return;
    var r = document.getElementById('searchResults');
    r.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    LocationManager.search(q).then(function(locs) {
        if (!locs.length) { r.innerHTML='<p style="text-align:center;color:#999;padding:16px">Sin resultados</p>'; return; }
        r.innerHTML = locs.map(function(l) {
            return '<button class="search-result" onclick="selectLocation({name:\''+l.name.replace(/'/g,"\\'")+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+l.country.replace(/'/g,"\\'")+'\'})">'
                +'<strong>'+l.name+'</strong><br><small>'+l.fullName+'</small></button>';
        }).join('');
    }).catch(function(e) { r.innerHTML='<p style="color:red;padding:16px">Error: '+e.message+'</p>'; });
}

// ========== LANGUAGE ==========
function setupLanguageSelector() {
    document.getElementById('btnLang').addEventListener('click', function() {
        var lp = document.getElementById('langPopup');
        lp.style.display='flex';
        lp.onclick = function(e) { if (e.target===lp) closePopups(); };
    });
    document.getElementById('closeLang').addEventListener('click', closePopups);
    document.querySelectorAll('.lang-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            setLanguage(this.dataset.lang); closePopups(); refreshSmartTips();
            if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon);
            showToast('🌐 '+this.textContent.trim());
        });
    });
}

// ========== FAVORITES ==========
function setupFavorites() {
    document.getElementById('btnStarAlert').addEventListener('click', toggleFavorite);
    document.getElementById('btnStarWeather').addEventListener('click', toggleFavorite);
    document.getElementById('btnFavorites').addEventListener('click', openFavorites);
    document.getElementById('closeFavorites').addEventListener('click', closePopups);
    document.getElementById('favoritesPopup').addEventListener('click', function(e) { if (e.target===this) closePopups(); });
    document.getElementById('closeShare').addEventListener('click', closePopups);
    document.getElementById('sharePopup').addEventListener('click', function(e) { if (e.target===this) closePopups(); });
    updateStarButtons(); updateFavBadge();
}
function toggleFavorite() {
    if (!currentLocation.lat) { showToast('📍 Detecta tu ubicación primero'); return; }
    var exists = LocationManager.getAll().find(function(l) { return l.name===currentLocation.name; });
    if (exists) { LocationManager.remove(currentLocation.name); showToast('Eliminado de favoritos'); }
    else { LocationManager.save(currentLocation); showToast('⭐ Guardado: '+currentLocation.name); }
    updateStarButtons(); updateFavBadge();
}
function updateStarButtons() {
    var isFav = currentLocation.name && LocationManager.getAll().find(function(l) { return l.name===currentLocation.name; });
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
            return '<div class="fav-item">'
                +'<div class="fav-item-info" onclick="selectLocation({name:\''+sn+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+sc+'\'});closePopups()">'
                +'<div class="fav-item-name">⭐ '+l.name+'</div>'
                +'<div class="fav-item-country">'+(l.country||'')+' · '+l.lat.toFixed(2)+', '+l.lon.toFixed(2)+'</div></div>'
                +'<div class="fav-item-actions">'
                +'<button class="fav-go-btn" onclick="selectLocation({name:\''+sn+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+sc+'\'});closePopups()">Ir →</button>'
                +'<button class="fav-del-btn" onclick="removeFavorite(\''+sn+'\')">🗑️</button></div></div>';
        }).join('');
    }
    document.getElementById('favoritesPopup').style.display='flex';
}
function removeFavorite(name) { LocationManager.remove(name); updateStarButtons(); updateFavBadge(); openFavorites(); showToast('🗑️ Eliminado'); }

// ========== SHARE ==========
function openShare(text) {
    document.getElementById('shareContent').textContent = text;
    var enc = encodeURIComponent(text), url = encodeURIComponent('https://appcml.github.io/AlertaGlobal/');
    document.getElementById('shareWhatsapp').onclick = function() { window.open('https://wa.me/?text='+enc,'_blank'); };
    document.getElementById('shareTwitter').onclick = function() { window.open('https://twitter.com/intent/tweet?text='+enc+'&url='+url,'_blank'); };
    document.getElementById('shareFacebook').onclick = function() { window.open('https://www.facebook.com/sharer/sharer.php?u='+url+'&quote='+enc,'_blank'); };
    document.getElementById('shareTelegram').onclick = function() { window.open('https://t.me/share/url?url='+url+'&text='+enc,'_blank'); };
    document.getElementById('shareCopy').onclick = function() {
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(function() { showToast('📋 Copiado'); });
        else { var ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('📋 Copiado'); }
    };
    var nb = document.getElementById('shareNative');
    if (nb) { nb.style.display=navigator.share?'flex':'none'; nb.onclick=function() { navigator.share({title:'Alerta Global',text:text,url:'https://appcml.github.io/AlertaGlobal/'}); }; }
    document.getElementById('sharePopup').style.display='flex';
}
function buildShareText(type, data) {
    var app = '\n🌍 Alerta Global — appcml.github.io/AlertaGlobal/';
    if (type==='earthquake') return (data.mag>=7?'🚨':'⚠️')+' SISMO M'+data.mag.toFixed(1)+'\n📍 '+data.place+'\n⬇️ Prof: '+data.depth+' km\n'+(data.dist?'📏 '+data.dist+' km de '+(currentLocation.name||'tu zona')+'\n':'')+'🕐 '+data.time+app;
    if (type==='weather') return '🌤️ CLIMA — '+data.city+'\n🌡️ '+data.temp+'°C\n☁️ '+data.desc+'\n💧 '+data.hum+'%  💨 '+data.wind+' m/s'+app;
    return app;
}


// Show banner when GPS accuracy is low (PC/IP-based location)
function showLocationAccuracyBanner(detectedCity) {
    var old = document.getElementById('locAccBanner');
    if (old) return; // already showing
    var b = document.createElement('div');
    b.id = 'locAccBanner';
    b.style.cssText = 'background:#E8F5E9;border-left:4px solid #4CAF50;padding:10px 14px;margin:6px 10px;border-radius:10px;font-size:13px;display:flex;align-items:center;gap:10px;';
    b.innerHTML = '<div style="flex:1">📍 Detectado: <strong>'+detectedCity+'</strong><br><span style="color:#666;font-size:12px">¿No es tu ubicación real? Búscala manualmente.</span></div>'
        + '<button onclick="openSearch();document.getElementById('locAccBanner').remove()" style="background:#4CAF50;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">Cambiar</button>'
        + '<button onclick="document.getElementById('locAccBanner').remove()" style="background:none;border:none;color:#999;font-size:16px;cursor:pointer;padding:0 4px">✕</button>';
    var alertList = document.getElementById('alertList');
    if (alertList) alertList.insertBefore(b, alertList.firstChild);
}

// ========== ALERTS (TIEMPO REAL) ==========
function loadAlerts() {
    if (alertsLoading) return;
    alertsLoading = true;
    var loading = document.getElementById('alertsLoading');
    var list = document.getElementById('alertList');
    var error = document.getElementById('alertsError');
    loading.style.display='flex'; list.innerHTML=''; error.style.display='none';

    // URL con filtro de ubicación si disponible
    var url;
    if (currentLocation.lat && currentLocation.lon) {
        url = CONFIG.USGS_BASE + '&latitude='+currentLocation.lat+'&longitude='+currentLocation.lon+'&maxradiuskm=2000';
    } else {
        url = CONFIG.USGS_GLOBAL;
    }

    var ctrl = typeof AbortController!=='undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 9000) : null;

    fetch(url, ctrl ? { signal: ctrl.signal } : {})
        .then(function(r) { if (timer) clearTimeout(timer); return r.json(); })
        .then(function(data) {
            alertsLoading = false;
            loading.style.display='none';
            lastEarthquakes = data.features || [];
            dataReady.earthquakes = true;

            // Ordenar más reciente primero
            lastEarthquakes.sort(function(a, b) { return b.properties.time - a.properties.time; });

            var now = Date.now();
            lastEarthquakes.forEach(function(f) {
                if (seenAlertIds[f.id]) return;
                seenAlertIds[f.id] = true;
                var mag = f.properties.mag, place = f.properties.place || '', depth = f.geometry.coordinates[2];
                if ((now - f.properties.time) > 1800000) return; // only notify last 30min
                var level = checkAlertLevel(mag, depth, place);
                if (level === 'ROJA' || level === 'TSUNAMI') {
                    playSiren();
                    showEmergencyModal('🚨 ALERTA '+level+' M'+mag.toFixed(1), place, mag, depth.toFixed(0), level);
                    sendNotification('🚨 ALERTA '+level+' M'+mag.toFixed(1), place, 'critical');
                } else if (level === 'NARANJA') {
                    playBeep(660, 0.5, 'square'); setTimeout(function(){playBeep(660,0.5,'square');},400);
                    sendNotification('🟠 SISMO M'+mag.toFixed(1), place, 'high');
                } else if (level === 'AMARILLA' || mag >= 5.0) {
                    playBeep(880, 0.4);
                    sendNotification('⚠️ SISMO M'+mag.toFixed(1), place, 'medium');
                }
            });

            list.innerHTML = '';
            if (!lastEarthquakes.length) {
                list.innerHTML = '<div class="loading"><p>No hay alertas recientes</p></div>';
            } else {
                lastEarthquakes.forEach(function(f) {
                    var mag=f.properties.mag, place=f.properties.place||'?', time=f.properties.time;
                    var c=f.geometry.coordinates, depth=c[2].toFixed(1);
                    var risk=calcRisk(mag);
                    var dist=currentLocation.lat?calcDistance(currentLocation.lat,currentLocation.lon,c[1],c[0]):null;
                    var tsunami=(mag>=7&&parseFloat(depth)<70)?'<div class="tsunami-warning">🌊 Posible riesgo de tsunami</div>':'';
                    var isRecent=(now-time)<3600000;
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

function addWeatherAlertCards(list) {
    var d=lastWeatherData, main=d.weather[0].main.toLowerCase(), desc=d.weather[0].description;
    var temp=d.main.temp, wind=d.wind.speed, city=d.name||currentLocation.name||'';
    var alerts=[];
    if(main==='thunderstorm') alerts.push({icon:'⛈️',type:'TORMENTA ELÉCTRICA',title:'Tormenta eléctrica — '+city,detail:'Busca refugio interior.',color:'#B71C1C'});
    if(main==='rain'||main==='drizzle') alerts.push({icon:'🌧️',type:'LLUVIA',title:desc+' — '+city,detail:'Hum. '+d.main.humidity+'% · Viento '+wind.toFixed(0)+' m/s',color:'#1565C0'});
    if(main==='snow') alerts.push({icon:'❄️',type:'NEVADA',title:'Nevando — '+city,detail:Math.round(temp)+'°C',color:'#0277BD'});
    if(main==='tornado') alerts.push({icon:'🌪️',type:'TORNADO',title:'Tornado — EMERGENCIA',detail:'Busca refugio inmediato.',color:'#000'});
    if(main==='mist'||main==='fog') alerts.push({icon:'🌫️',type:'NIEBLA',title:'Visibilidad reducida — '+city,detail:'Conduce con luces bajas.',color:'#546E7A'});
    if(wind>15) alerts.push({icon:'💨',type:'VIENTO EXTREMO',title:'Viento '+wind.toFixed(0)+' m/s — '+city,detail:'Asegura objetos sueltos.',color:'#E64A19'});
    else if(wind>10) alerts.push({icon:'💨',type:'VIENTO FUERTE',title:'Viento '+wind.toFixed(0)+' m/s — '+city,detail:'Precaución en caminos.',color:'#FF6F00'});
    if(temp>38) alerts.push({icon:'🔥',type:'OLA DE CALOR',title:Math.round(temp)+'°C — '+city,detail:'Hidrátate. Evita salir.',color:'#B71C1C'});
    if(temp<-5) alerts.push({icon:'🥶',type:'OLA DE FRÍO',title:Math.round(temp)+'°C — '+city,detail:'Riesgo hipotermia.',color:'#0D47A1'});
    else if(temp<3) alerts.push({icon:'❄️',type:'FRÍO INTENSO',title:Math.round(temp)+'°C — '+city,detail:'Protege cañerías y plantas.',color:'#1565C0'});
    alerts.forEach(function(a) {
        var card=document.createElement('div'); card.className='alert-card weather-alert-card'; card.style.borderLeftColor=a.color;
        card.innerHTML='<div class="alert-header"><span class="alert-type" style="background:'+a.color+'">'+a.icon+' '+a.type+'</span></div><div class="alert-title">'+a.title+'</div><div class="alert-location">'+a.detail+'</div><div class="alert-footer"><span>🕐 Ahora</span><span>📡 OpenWeather</span></div>';
        list.appendChild(card);
    });
}

function renderExternalAlerts() {
    var list = document.getElementById('alertList'); if (!list) return;
    list.querySelectorAll('.ext-alert-card').forEach(function(c) { c.remove(); });
    externalAlerts.forEach(function(a) {
        var card=document.createElement('div'); card.className='alert-card ext-alert-card'; card.style.borderLeftColor=a.color;
        card.innerHTML='<div class="alert-header"><span class="alert-type" style="background:'+a.color+'">'+a.icon+' '+a.type+'</span></div><div class="alert-title">'+a.title+'</div>'+(a.description?'<div class="alert-location">'+a.description+'</div>':'')+'<div class="alert-footer"><span>📡 '+a.source+'</span>'+(a.link?'<a href="'+a.link+'" target="_blank" style="color:#6200EE;font-size:11px">Ver más →</a>':'')+'</div>';
        list.appendChild(card);
    });
}

function loadExternalSourcesData() {
    if (typeof loadExternalSources === 'undefined') return;
    loadExternalSources(function(alerts) {
        externalAlerts = alerts;
        externalAlerts.forEach(function(a) {
            var id='ext_'+a.title.substring(0,30);
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

// ========== WEATHER ==========
function loadWeather(lat, lon) {
    var loading=document.getElementById('weatherLoading'), container=document.getElementById('weatherContainer'), error=document.getElementById('weatherError');
    loading.style.display='flex'; container.style.display='none'; error.style.display='none';
    fetch(CONFIG.WEATHER_URL+'?lat='+lat+'&lon='+lon+'&appid='+CONFIG.WEATHER_API_KEY+'&units=metric&lang='+currentLang)
        .then(function(r){return r.json();}).then(function(d) {
            loading.style.display='none'; container.style.display='block';
            lastWeatherData=d; dataReady.weather=true;
            document.getElementById('wCity').textContent=d.name||currentLocation.name;
            document.getElementById('wTemp').textContent=Math.round(d.main.temp)+'°C';
            document.getElementById('wDesc').textContent=d.weather[0].description;
            document.getElementById('wHumidity').textContent=d.main.humidity+'%';
            document.getElementById('wWind').textContent=d.wind.speed+' m/s';
            document.getElementById('wFeels').textContent=Math.round(d.main.feels_like)+'°C';
            document.getElementById('wPressure').textContent=d.main.pressure+' hPa';
            var temp=d.main.temp, rec;
            if(temp>35)rec='🔥 Extremadamente caluroso. Evita salir.';
            else if(temp>30)rec='☀️ Muy caluroso. Hidrátate.';
            else if(temp>25)rec='🌤️ Caluroso. Usa protector solar.';
            else if(temp>15)rec='🌈 Condiciones agradables.';
            else if(temp>10)rec='🍂 Fresco. Lleva chaqueta.';
            else if(temp>0)rec='❄️ Frío. Abrígate bien.';
            else rec='🥶 Congelante. No salgas sin necesidad.';
            document.getElementById('wRecommendation').textContent=rec;
            var wsb=document.getElementById('wShareBtn');
            if (!wsb) { wsb=document.createElement('button'); wsb.id='wShareBtn'; wsb.className='alert-share-btn'; wsb.style.marginTop='12px'; wsb.textContent='📤 Compartir clima'; container.appendChild(wsb); }
            wsb.onclick=function(){ openShare(buildShareText('weather',{city:d.name||currentLocation.name,temp:Math.round(d.main.temp),desc:d.weather[0].description,hum:d.main.humidity,wind:d.wind.speed})); };
            var main=d.weather[0].main.toLowerCase();
            if(main==='thunderstorm') { playSiren(); sendNotification('⛈️ Tormenta eléctrica','En '+(d.name||currentLocation.name)+'. Refúgiate.','critical'); }
            else if(d.wind.speed>15) { playBeep(660,0.5); sendNotification('💨 Viento extremo: '+d.wind.speed.toFixed(0)+' m/s','En '+(d.name||currentLocation.name),'high'); }
            var al=document.getElementById('alertList');
            if(al){al.querySelectorAll('.weather-alert-card').forEach(function(c){c.remove();});addWeatherAlertCards(al);}
            loadForecast(lat, lon);
        }).catch(function(e){loading.style.display='none';error.style.display='block';error.textContent='⚠️ '+e.message;});
}

function loadForecast(lat, lon) {
    fetch(CONFIG.FORECAST_URL+'?lat='+lat+'&lon='+lon+'&appid='+CONFIG.WEATHER_API_KEY+'&units=metric&lang='+currentLang+'&cnt=16')
        .then(function(r){return r.json();}).then(function(d){lastForecastData=d;refreshSmartTips();}).catch(function(){refreshSmartTips();});
}

// ========== SMART TIPS ==========
function refreshSmartTips() {
    if (!dataReady.weather && !dataReady.earthquakes) {
        document.getElementById('tipsList').innerHTML='<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>';
        return;
    }
    var tips=[], now=Date.now();
    if (lastEarthquakes.length) {
        var big=lastEarthquakes.filter(function(f){return (now-f.properties.time)<3600000&&f.properties.mag>=6;});
        if (big.length) {
            var eq=big[0], mag=eq.properties.mag, place=eq.properties.place;
            var dist=currentLocation.lat?calcDistance(currentLocation.lat,currentLocation.lon,eq.geometry.coordinates[1],eq.geometry.coordinates[0]):null;
            tips.push({title:'🚨 SISMO M'+mag.toFixed(1)+' — HACE MENOS DE 1H',desc:'Epicentro: '+place+(dist?' · '+dist+' km de ti':'')+'. Mantén la calma. Aléjate de ventanas.',cat:'⚫ EMERGENCIA',color:'#B71C1C',priority:100});
            if(mag>=7&&eq.geometry.coordinates[2]<70) tips.push({title:'🌊 RIESGO DE TSUNAMI',desc:'Evacúa INMEDIATAMENTE a zonas altas. No regreses hasta autorización.',cat:'⚫ EMERGENCIA',color:'#880E4F',priority:99});
        }
        var mod=lastEarthquakes.filter(function(f){return (now-f.properties.time)<21600000&&f.properties.mag>=5;});
        if(mod.length&&!big.length) tips.push({title:'⚠️ '+mod.length+' sismos M5+ en 6h',desc:'Actividad sísmica elevada. Ten lista tu mochila de emergencia.',cat:'🟠 PRECAUCIÓN',color:'#E65100',priority:75});
    }
    if (lastWeatherData) {
        var d=lastWeatherData, temp=d.main.temp, wind=d.wind.speed, hum=d.main.humidity;
        var main=d.weather[0].main.toLowerCase(), desc2=d.weather[0].description, city=d.name||currentLocation.name||'tu zona';
        if(main==='thunderstorm') tips.push({title:'⛈️ TORMENTA ELÉCTRICA — '+city,desc:'No permanezcas bajo árboles. Desconecta aparatos. Refúgiate.',cat:'🔴 EMERGENCIA',color:'#B71C1C',priority:95});
        if(main==='tornado') tips.push({title:'🌪️ TORNADO',desc:'Busca refugio en sótano. Aléjate de ventanas.',cat:'⚫ EXTREMO',color:'#000',priority:98});
        if(main==='rain'||main==='drizzle') tips.push({title:'🌧️ LLUVIA: '+desc2+' — '+city,desc:'Lleva paraguas. Conduce con precaución. Evita zonas inundables.',cat:'🟡 PRECAUCIÓN',color:'#1565C0',priority:85});
        if(main==='snow') tips.push({title:'❄️ NEVANDO — '+city,desc:'Conduce solo si es necesario. Abrígate en capas.',cat:'🟠 PRECAUCIÓN',color:'#0277BD',priority:83});
        if(main==='mist'||main==='fog') tips.push({title:'🌫️ NIEBLA — '+city,desc:'Usa luces bajas. Reduce velocidad.',cat:'🟡 PRECAUCIÓN',color:'#546E7A',priority:70});
        if(wind>15) tips.push({title:'💨 VIENTO EXTREMO: '+wind.toFixed(0)+' m/s — '+city,desc:'Asegura objetos. Evita zonas con árboles grandes.',cat:'🔴 ALTO',color:'#E64A19',priority:88});
        else if(wind>10) tips.push({title:'💨 VIENTO FUERTE: '+wind.toFixed(0)+' m/s — '+city,desc:desc2+'. Asegura toldos y objetos exteriores.',cat:'🟠 PRECAUCIÓN',color:'#FF6F00',priority:60});
        if(temp>38) tips.push({title:'🔥 CALOR EXTREMO: '+Math.round(temp)+'°C',desc:'Hidrátate cada 20 min. Evita salir al mediodía.',cat:'🔴 EMERGENCIA',color:'#B71C1C',priority:90});
        else if(temp>30) tips.push({title:'☀️ MUCHO CALOR: '+Math.round(temp)+'°C',desc:'Bebe agua. Busca sombra.',cat:'🟡 PRECAUCIÓN',color:'#FF6F00',priority:65});
        if(temp<-5) tips.push({title:'🥶 CONGELANTE: '+Math.round(temp)+'°C',desc:'Riesgo de hipotermia. No salgas sin necesidad.',cat:'🔴 EMERGENCIA',color:'#0D47A1',priority:89});
        else if(temp<3) tips.push({title:'❄️ BAJO 3°C: '+Math.round(temp)+'°C — '+city,desc:desc2+' con '+Math.round(temp)+'°C. Abrígate. Protege plantas.',cat:'🟠 PRECAUCIÓN',color:'#1565C0',priority:70});
        else if(temp<10) tips.push({title:'🌬️ DÍA FRÍO: '+Math.round(temp)+'°C — '+city,desc:desc2+' con '+Math.round(temp)+'°C y '+hum+'% humedad'+(wind>8?' · Viento '+wind.toFixed(0)+' m/s':'')+'. Lleva chaqueta.',cat:'🟢 PREVENCIÓN',color:'#0288D1',priority:35});
        if((main==='clouds')&&temp>5&&temp<=15) tips.push({title:'☁️ NUBLADO Y FRESCO: '+Math.round(temp)+'°C — '+city,desc:desc2+'. Lleva chaqueta o polar.',cat:'🟢 PREVENCIÓN',color:'#0288D1',priority:30});
        if(main==='clear'&&temp>10&&temp<=25) tips.push({title:'☀️ DÍA DESPEJADO: '+Math.round(temp)+'°C — '+city,desc:'Usa protector solar al aire libre.',cat:'🟢 PREVENCIÓN',color:'#F57F17',priority:25});
    }
    if(tips.length<2){
        tips.push({title:'🎒 Mochila de emergencia',desc:'Agua, linterna, radio a pilas, documentos y medicamentos.',cat:'🟢 PREVENCIÓN',color:'#795548',priority:10});
        tips.push({title:'📱 Emergencias Chile',desc:'Bomberos 132 · Ambulancia 131 · Carabineros 133 · SENAPRED 1470',cat:'🟢 PREVENCIÓN',color:'#607D8B',priority:5});
    }
    tips.sort(function(a,b){return b.priority-a.priority;});
    var list=document.getElementById('tipsList'); list.innerHTML='';
    var h=document.createElement('div'); h.style.cssText='padding:8px 12px;font-size:11px;color:#999;text-align:right;';
    h.textContent='🔄 '+new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})+(currentLocation.name?' — '+currentLocation.name:'');
    list.appendChild(h);
    tips.forEach(function(tip){
        var card=document.createElement('div'); card.className='tip-card'; card.style.borderLeft='4px solid '+tip.color;
        if(tip.priority>=85){card.style.background=tip.color+'12';card.style.border='1px solid '+tip.color+'40';card.style.borderLeft='4px solid '+tip.color;}
        card.innerHTML='<span class="tip-category" style="color:'+tip.color+';background:'+tip.color+'18">'+tip.cat+'</span><div class="tip-title">'+tip.title+'</div><div class="tip-desc">'+tip.desc+'</div>';
        list.appendChild(card);
    });
}

// ========== MAP ==========
function initMap() {
    var lat=currentLocation.lat||-37.8, lon=currentLocation.lon||-73.4;
    leafletMap=L.map('map').setView([lat,lon],7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(leafletMap);
    if(currentLocation.lat){
        userMarker=L.marker([currentLocation.lat,currentLocation.lon],{icon:createUserIcon()}).addTo(leafletMap).bindPopup('<b>📍 '+currentLocation.name+'</b>').openPopup();
    }
    fetch(CONFIG.USGS_GLOBAL).then(function(r){return r.json();}).then(function(data){
        data.features.forEach(function(f){
            var c=f.geometry.coordinates, mag=f.properties.mag, place=f.properties.place;
            var color=mag>=7?'#B71C1C':mag>=5?'#E64A19':mag>=4?'#FF9800':'#FFC107';
            L.circleMarker([c[1],c[0]],{radius:Math.max(mag*2.5,5),color:color,fillColor:color,fillOpacity:0.7,weight:1})
                .addTo(leafletMap).bindPopup('<b>🌍 M'+mag.toFixed(1)+'</b><br>'+place+'<br><small>Prof: '+c[2].toFixed(0)+' km</small>');
        });
    }).catch(function(){});
    mapInitialized=true;
    setTimeout(function(){leafletMap.invalidateSize();},300);
}
