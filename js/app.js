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

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function() {
    setLanguage(currentLang);
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
    // PASO 1: cargar alertas globales INMEDIATAMENTE — sin esperar nada
    loadAlerts();

    // PASO 2: ubicación guardada → instantáneo desde localStorage
    var saved = LocationManager.getCurrent();
    if (saved && saved.lat) {
        currentLocation = saved;
        updateLocationDisplay(saved.name);
        loadWeather(saved.lat, saved.lon);
        renderSavedLocations();
        updateStarButtons();
        return;
    }

    // PASO 3: pedir GPS en paralelo — no bloquea la carga de alertas
    updateLocationDisplay('Detectando...');
    if (!navigator.geolocation) {
        updateLocationDisplay('Global');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            var lat = pos.coords.latitude, lon = pos.coords.longitude;
            currentLocation = { lat: lat, lon: lon, name: lat.toFixed(1)+', '+lon.toFixed(1), country: '' };
            updateLocationDisplay(currentLocation.name);
            // Recargar alertas ahora filtradas por ubicación
            loadAlerts();
            loadWeather(lat, lon);
            renderSavedLocations();
            // Nombre de ciudad en background — no bloquea nada
            LocationManager.reverseGeocode(lat, lon).then(function(geo) {
                currentLocation.name = geo.city || currentLocation.name;
                currentLocation.country = geo.country || '';
                LocationManager.setCurrent(currentLocation);
                updateLocationDisplay(currentLocation.name);
                updateStarButtons();
            }).catch(function() {});
        },
        function() {
            updateLocationDisplay('Global');
            // Ya tenemos alertas globales cargadas — no hacer nada más
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
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
            return '<button class="search-result" onclick="selectLocation({name:\''+l.name.replace(/'/g,"\\'")+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+l.country.replace(/'/g,"\\'")+'\'})">'+'<strong>'+l.name+'</strong><br><small>'+l.fullName+'</small></button>';
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
    if (!currentLocation.lat) { showToast('📍 Primero detecta tu ubicación'); return; }
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
            return '<div class="fav-item"><div class="fav-item-info" onclick="selectLocation({name:\''+sn+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+sc+'\'});closePopups()"><div class="fav-item-name">⭐ '+l.name+'</div><div class="fav-item-country">'+(l.country||'')+' · '+l.lat.toFixed(2)+', '+l.lon.toFixed(2)+'</div></div><div class="fav-item-actions"><button class="fav-go-btn" onclick="selectLocation({name:\''+sn+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+sc+'\'});closePopups()">Ir →</button><button class="fav-del-btn" onclick="removeFavorite(\''+sn+'\')">🗑️</button></div></div>';
        }).join('');
    }
    document.getElementById('favoritesPopup').style.display='flex';
}
function removeFavorite(name) { LocationManager.remove(name); updateStarButtons(); updateFavBadge(); openFavorites(); showToast('🗑️ Eliminado'); }

// ========== SHARE ==========
function openShare(text) {
    document.getElementById('shareContent').textContent = text;
    var encoded = encodeURIComponent(text), appUrl = encodeURIComponent('https://appcml.github.io/AlertaGlobal/');
    document.getElementById('shareWhatsapp').onclick = function() { window.open('https://wa.me/?text='+encoded,'_blank'); };
    document.getElementById('shareTwitter').onclick  = function() { window.open('https://twitter.com/intent/tweet?text='+encoded+'&url='+appUrl,'_blank'); };
    document.getElementById('shareFacebook').onclick = function() { window.open('https://www.facebook.com/sharer/sharer.php?u='+appUrl+'&quote='+encoded,'_blank'); };
    document.getElementById('shareTelegram').onclick = function() { window.open('https://t.me/share/url?url='+appUrl+'&text='+encoded,'_blank'); };
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
    if (type==='weather') return '🌤️ CLIMA — '+data.city+'\n🌡️ '+data.temp+'°C (Sensación: '+data.feels+'°C)\n☁️ '+data.desc+'\n💧 '+data.hum+'%  💨 '+data.wind+' m/s'+app;
    return app;
}

// ========== ALERTS ==========
function loadAlerts() {
    var loading = document.getElementById('alertsLoading');
    var list = document.getElementById('alertList');
    var error = document.getElementById('alertsError');
    loading.style.display='flex'; list.innerHTML=''; error.style.display='none';

    var url = CONFIG.USGS_URL; // GeoJSON feed - global, filter client-side

    var ctrl = typeof AbortController!=='undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 8000) : null;

    fetch(url, ctrl?{signal:ctrl.signal}:{})
        .then(function(r) { if (timer) clearTimeout(timer); return r.json(); })
        .then(function(data) {
            loading.style.display='none';
            lastEarthquakes = data.features||[];
            dataReady.earthquakes = true;
            list.innerHTML='';

            var now = Date.now();
            lastEarthquakes.forEach(function(f) {
                if (!seenAlertIds[f.id] && f.properties.mag>=5.5 && (now-f.properties.time)<1800000) {
                    seenAlertIds[f.id]=true;
                    sendNotification('🚨 SISMO M'+f.properties.mag.toFixed(1), f.properties.place, f.properties.mag>=7?'critical':'high');
                } else seenAlertIds[f.id]=true;
            });

            if (!lastEarthquakes.length) {
                list.innerHTML='<div class="loading"><p>No hay alertas recientes</p></div>';
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
            if (timer) clearTimeout(timer);
            loading.style.display='none';
            error.style.display='block';
            error.textContent = e.name==='AbortError' ? '⚠️ Sin respuesta. Verifica tu conexión.' : '⚠️ '+e.message;
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
                sendNotification(a.icon+' '+a.type, a.title, (a.priority||0)>=95?'critical':'high');
            }
            seenAlertIds[id]=true;
        });
        var alertList=document.getElementById('alertList');
        if (alertList && lastEarthquakes.length) renderExternalAlerts();
    });
}

// ========== WEATHER ==========
function loadWeather(lat, lon) {
    var loading=document.getElementById('weatherLoading'), container=document.getElementById('weatherContainer'), error=document.getElementById('weatherError');
    loading.style.display='flex'; container.style.display='none'; error.style.display='none';
    fetch(CONFIG.WEATHER_URL+'?lat='+lat+'&lon='+lon+'&appid='+CONFIG.WEATHER_API_KEY+'&units=metric&lang='+currentLang)
        .then(function(r) { return r.json(); })
        .then(function(d) {
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
            else if(temp>30)rec='☀️ Muy caluroso. Hidrátate y busca sombra.';
            else if(temp>25)rec='🌤️ Caluroso. Usa protector solar.';
            else if(temp>15)rec='🌈 Condiciones agradables.';
            else if(temp>10)rec='🍂 Fresco. Lleva chaqueta.';
            else if(temp>0)rec='❄️ Frío. Abrígate bien.';
            else rec='🥶 Congelante. No salgas sin necesidad.';
            document.getElementById('wRecommendation').textContent=rec;
            var wsb=document.getElementById('wShareBtn');
            if (!wsb) { wsb=document.createElement('button'); wsb.id='wShareBtn'; wsb.className='alert-share-btn'; wsb.style.marginTop='12px'; wsb.textContent='📤 Compartir clima'; container.appendChild(wsb); }
            wsb.onclick=function() { openShare(buildShareText('weather',{city:d.name||currentLocation.name,temp:Math.round(d.main.temp),feels:Math.round(d.main.feels_like),desc:d.weather[0].description,hum:d.main.humidity,wind:d.wind.speed})); };
            var main=d.weather[0].main.toLowerCase();
            if(main==='thunderstorm') sendNotification('⛈️ Tormenta eléctrica','En '+(d.name||currentLocation.name)+'. Refúgiate.','critical');
            else if(d.wind.speed>15) sendNotification('💨 Viento extremo: '+d.wind.speed.toFixed(0)+' m/s','En '+(d.name||currentLocation.name),'high');
            var alertList=document.getElementById('alertList');
            if (alertList) { alertList.querySelectorAll('.weather-alert-card').forEach(function(c){c.remove();}); addWeatherAlertCards(alertList); }
            loadForecast(lat, lon);
        })
        .catch(function(e) { loading.style.display='none'; error.style.display='block'; error.textContent='⚠️ '+e.message; });
}

function loadForecast(lat, lon) {
    fetch(CONFIG.FORECAST_URL+'?lat='+lat+'&lon='+lon+'&appid='+CONFIG.WEATHER_API_KEY+'&units=metric&lang='+currentLang+'&cnt=16')
        .then(function(r){return r.json();}).then(function(d){ lastForecastData=d; refreshSmartTips(); }).catch(function(){ refreshSmartTips(); });
}

// ========== SMART TIPS ==========
function refreshSmartTips() {
    if (!dataReady.weather && !dataReady.earthquakes) {
        document.getElementById('tipsList').innerHTML='<div class="loading"><div class="spinner"></div><p>Cargando datos...</p></div>';
        return;
    }
    var tips=[], now=Date.now();
    if (lastEarthquakes.length) {
        var big=lastEarthquakes.filter(function(f){return (now-f.properties.time)<3600000&&f.properties.mag>=6;});
        if (big.length) {
            var eq=big[0], mag=eq.properties.mag, place=eq.properties.place;
            var dist=currentLocation.lat?calcDistance(currentLocation.lat,currentLocation.lon,eq.geometry.coordinates[1],eq.geometry.coordinates[0]):null;
            tips.push({title:'🚨 SISMO M'+mag.toFixed(1)+' — HACE MENOS DE 1H',desc:'Epicentro: '+place+(dist?' · '+dist+' km de ti':'')+'. Mantén la calma. Aléjate de ventanas. No uses ascensores. Revisa posibles fugas de gas.',cat:'⚫ EMERGENCIA',color:'#B71C1C',priority:100});
            if(mag>=7&&eq.geometry.coordinates[2]<70) tips.push({title:'🌊 RIESGO DE TSUNAMI',desc:'Terremoto superficial M'+mag.toFixed(1)+'. Evacúa INMEDIATAMENTE a zonas altas.',cat:'⚫ EMERGENCIA',color:'#880E4F',priority:99});
        }
        var mod=lastEarthquakes.filter(function(f){return (now-f.properties.time)<21600000&&f.properties.mag>=5;});
        if(mod.length&&!big.length) tips.push({title:'⚠️ '+mod.length+' sismos M5+ en 6h',desc:'Actividad sísmica elevada. Conoce tus rutas de evacuación.',cat:'🟠 PRECAUCIÓN',color:'#E65100',priority:75});
    }
    if (lastWeatherData) {
        var d=lastWeatherData, temp=d.main.temp, wind=d.wind.speed, hum=d.main.humidity, feels=d.main.feels_like;
        var main=d.weather[0].main.toLowerCase(), desc2=d.weather[0].description, city=d.name||currentLocation.name||'tu zona';
        if(main==='thunderstorm') tips.push({title:'⛈️ TORMENTA ELÉCTRICA — '+city,desc:'No permanezcas bajo árboles. Desconecta aparatos. Refúgiate en interior.',cat:'🔴 EMERGENCIA',color:'#B71C1C',priority:95});
        if(main==='tornado') tips.push({title:'🌪️ TORNADO',desc:'Busca refugio en sótano o habitación interior. Aléjate de ventanas.',cat:'⚫ EXTREMO',color:'#000',priority:98});
        if(main==='rain'||main==='drizzle') tips.push({title:'🌧️ LLUVIA: '+desc2+' — '+city,desc:'Lleva paraguas. Conduce con precaución. Evita zonas inundables.',cat:'🟡 PRECAUCIÓN',color:'#1565C0',priority:85});
        if(main==='snow') tips.push({title:'❄️ NEVANDO — '+city,desc:'Conduce solo si es necesario. Protege cañerías. Abrígate.',cat:'🟠 PRECAUCIÓN',color:'#0277BD',priority:83});
        if(main==='mist'||main==='fog') tips.push({title:'🌫️ NIEBLA — '+city,desc:'Usa luces bajas. Reduce velocidad. Aumenta distancia de frenado.',cat:'🟡 PRECAUCIÓN',color:'#546E7A',priority:70});
        if(wind>15) tips.push({title:'💨 VIENTO EXTREMO: '+wind.toFixed(0)+' m/s — '+city,desc:'Asegura objetos. Evita zonas con árboles. Reduce velocidad en puentes.',cat:'🔴 ALTO',color:'#E64A19',priority:88});
        else if(wind>10) tips.push({title:'💨 VIENTO FUERTE: '+wind.toFixed(0)+' m/s — '+city,desc:'Hoy: '+desc2+'. Asegura toldos y objetos exteriores.',cat:'🟠 PRECAUCIÓN',color:'#FF6F00',priority:60});
        if(temp>38) tips.push({title:'🔥 CALOR EXTREMO: '+Math.round(temp)+'°C — '+city,desc:'Nunca dejes niños en vehículos. Hidrátate cada 20 min. SPF 50+.',cat:'🔴 EMERGENCIA',color:'#B71C1C',priority:90});
        else if(temp>30) tips.push({title:'☀️ MUCHO CALOR: '+Math.round(temp)+'°C',desc:'Bebe agua. Usa ropa ligera. Busca sombra.',cat:'🟡 PRECAUCIÓN',color:'#FF6F00',priority:65});
        if(temp<-5) tips.push({title:'🥶 CONGELANTE: '+Math.round(temp)+'°C — '+city,desc:'Riesgo de hipotermia. Abrígate. No salgas sin necesidad.',cat:'🔴 EMERGENCIA',color:'#0D47A1',priority:89});
        else if(temp<3) tips.push({title:'❄️ BAJO 3°C: '+Math.round(temp)+'°C — '+city,desc:'Hoy: '+desc2+'. Abrígate en capas. Protege plantas. Cuidado con escarcha.',cat:'🟠 PRECAUCIÓN',color:'#1565C0',priority:70});
        else if(temp<10) tips.push({title:'🌬️ DÍA FRÍO: '+Math.round(temp)+'°C — '+city,desc:'Hoy: '+desc2+' con '+Math.round(temp)+'°C y '+hum+'% humedad'+(wind>8?' · Viento '+wind.toFixed(0)+' m/s':'')+'. Lleva chaqueta.',cat:'🟢 PREVENCIÓN',color:'#0288D1',priority:35});
        if(hum>85&&temp>22) tips.push({title:'💧 BOCHORNO: '+Math.round(temp)+'°C + '+hum+'%',desc:'Calor húmedo. Sensación: '+Math.round(feels)+'°C. Busca lugares ventilados.',cat:'🟠 PRECAUCIÓN',color:'#FF6F00',priority:55});
        if(main==='clouds'&&temp>5&&temp<=15) tips.push({title:'☁️ NUBLADO Y FRESCO: '+Math.round(temp)+'°C — '+city,desc:'Hoy: '+desc2+' con '+Math.round(temp)+'°C y '+hum+'% humedad. Lleva chaqueta.',cat:'🟢 PREVENCIÓN',color:'#0288D1',priority:30});
        if(main==='clear'&&temp>10&&temp<=25) tips.push({title:'☀️ DÍA DESPEJADO: '+Math.round(temp)+'°C — '+city,desc:'Buenas condiciones. Usa protector solar al aire libre.',cat:'🟢 PREVENCIÓN',color:'#F57F17',priority:25});
    }
    if (lastForecastData&&lastForecastData.list) {
        var fc=lastForecastData.list, storm=false, rain=false, cold=false;
        var curMain=lastWeatherData?lastWeatherData.weather[0].main.toLowerCase():'';
        for(var i=0;i<Math.min(fc.length,8);i++){var m=fc[i].weather[0].main.toLowerCase();if(m==='thunderstorm')storm=true;if(m==='rain'||m==='drizzle')rain=true;if(fc[i].main.temp<1)cold=true;}
        if(storm&&curMain!=='thunderstorm') tips.push({title:'⛈️ Tormenta próximas horas',desc:'Asegura objetos. Ten linterna a mano.',cat:'🟠 PRECAUCIÓN',color:'#E64A19',priority:72});
        if(rain&&['rain','drizzle'].indexOf(curMain)<0) tips.push({title:'🌧️ Lluvias próximas horas',desc:'Lleva paraguas. Revisa canaletas.',cat:'🟡 PREVENCIÓN',color:'#1976D2',priority:45});
        if(cold&&lastWeatherData&&lastWeatherData.main.temp>3) tips.push({title:'🌡️ Descenso de temperatura',desc:'Se esperan temperaturas bajo 0°C. Protege plantas y mascotas.',cat:'🟡 PREVENCIÓN',color:'#0288D1',priority:40});
    }
    if(tips.length<2) {
        tips.push({title:'🎒 Mochila de emergencia',desc:'Agua, linterna, radio a pilas, documentos y medicamentos.',cat:'🟢 PREVENCIÓN',color:'#795548',priority:10});
        tips.push({title:'📱 Emergencias Chile',desc:'Bomberos 132 · Ambulancia 131 · Carabineros 133 · SENAPRED 1470',cat:'🟢 PREVENCIÓN',color:'#607D8B',priority:5});
    }
    tips.sort(function(a,b){return b.priority-a.priority;});
    var list=document.getElementById('tipsList'); list.innerHTML='';
    var h=document.createElement('div'); h.style.cssText='padding:8px 12px;font-size:11px;color:#999;text-align:right;';
    h.textContent='🔄 '+new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})+(currentLocation.name?' — '+currentLocation.name:'');
    list.appendChild(h);
    tips.forEach(function(tip) {
        var card=document.createElement('div'); card.className='tip-card'; card.style.borderLeft='4px solid '+tip.color;
        if(tip.priority>=85){card.style.background=tip.color+'12';card.style.border='1px solid '+tip.color+'40';card.style.borderLeft='4px solid '+tip.color;}
        card.innerHTML='<span class="tip-category" style="color:'+tip.color+';background:'+tip.color+'18">'+tip.cat+'</span><div class="tip-title">'+tip.title+'</div><div class="tip-desc">'+tip.desc+'</div>';
        list.appendChild(card);
    });
}

// ========== MAP ==========
function initMap() {
    var lat=currentLocation.lat||-37.8, lon=currentLocation.lon||-73.4;
    // Load Leaflet lazily only when map tab is opened
    if (typeof L === 'undefined') {
        var css = document.createElement('link');
        css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);
        var script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = function() { buildMap(lat, lon); };
        document.head.appendChild(script);
        return;
    }
    buildMap(lat, lon);
}
function buildMap(lat, lon) {
    leafletMap=L.map('map').setView([lat,lon],7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(leafletMap);
    if(currentLocation.lat) { userMarker=L.marker([currentLocation.lat,currentLocation.lon],{icon:createUserIcon()}).addTo(leafletMap).bindPopup('<b>📍 '+currentLocation.name+'</b>').openPopup(); }
    fetch(CONFIG.USGS_URL).then(function(r){return r.json();}).then(function(data){
        data.features.forEach(function(f){
            var c=f.geometry.coordinates, mag=f.properties.mag, place=f.properties.place;
            var color=mag>=7?'#B71C1C':mag>=5?'#E64A19':mag>=4?'#FF9800':'#FFC107';
            L.circleMarker([c[1],c[0]],{radius:Math.max(mag*2.5,5),color:color,fillColor:color,fillOpacity:0.7,weight:1}).addTo(leafletMap).bindPopup('<b>🌍 M'+mag.toFixed(1)+'</b><br>'+place+'<br><small>Prof: '+c[2].toFixed(0)+' km</small>');
        });
    }).catch(function(){});
    mapInitialized=true;
    setTimeout(function(){leafletMap.invalidateSize();},300);
}
