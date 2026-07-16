// ============================================
// js/app.js — Alerta Global v4
// ============================================
var CONFIG = {
    USGS_URL: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=50&minmagnitude=3.5&orderby=time',
    WEATHER_API_KEY: '6fe6e0dcca264864dbd631bf620aad64',
    WEATHER_URL: 'https://api.openweathermap.org/data/2.5/weather',
    FORECAST_URL: 'https://api.openweathermap.org/data/2.5/forecast',
    ALERTS_INTERVAL: 120000,
    WEATHER_INTERVAL: 600000
};

var currentLocation = { lat: null, lon: null, name: '', country: '' };
var leafletMap = null, mapInitialized = false, userMarker = null;
var lastWeatherData = null, lastForecastData = null, lastEarthquakes = [];
var seenAlertIds = {}, notifPermission = false;
var searchTimer = null;
var dataReady = { weather: false, earthquakes: false };

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function() {
    setLanguage(currentLang);
    setupTabs();
    setupLocationButtons();
    setupLanguageSelector();
    setupSearch();
    requestNotificationPermission();
    setupFavorites();
    initLocation();
    setInterval(loadAlerts, CONFIG.ALERTS_INTERVAL);
    setInterval(function() { if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon); }, CONFIG.WEATHER_INTERVAL);
});

// ========== NOTIFICATIONS ==========
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(function(p) { notifPermission = p === 'granted'; });
    }
}
function sendNotification(title, body, urgency) {
    if (notifPermission) {
        try { new Notification(title, { body: body, icon: 'img/icon.svg' }); } catch(e) {}
    }
    showAlertBanner(title, body, urgency);
}
function showAlertBanner(title, body, urgency) {
    var old = document.getElementById('alertBanner');
    if (old) old.remove();
    var colors = { critical: '#B71C1C', high: '#F44336', medium: '#FF9800', info: '#2196F3' };
    var c = colors[urgency] || colors.info;
    var b = document.createElement('div');
    b.id = 'alertBanner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:' + c + ';color:#fff;padding:12px 16px;z-index:500;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 8px rgba(0,0,0,0.4);animation:slideDown 0.3s ease;font-family:inherit;';
    b.innerHTML = '<div style="flex:1;margin-right:8px"><div style="font-weight:700;font-size:14px">' + title + '</div><div style="font-size:12px;opacity:0.95;margin-top:2px">' + body + '</div></div><button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:6px">✕</button>';
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
            document.getElementById('panel-' + this.dataset.tab).classList.add('active');
            if (this.dataset.tab === 'mapa' && !mapInitialized) initMap();
            if (this.dataset.tab === 'tips') refreshSmartTips();
        });
    });
}

// ========== GEOLOCATION ==========
function initLocation() {
    var saved = LocationManager.getCurrent();
    if (saved && saved.lat) {
        currentLocation = saved;
        updateLocationDisplay(saved.name);
        loadWeather(saved.lat, saved.lon);
        loadAlerts();
        renderSavedLocations();
        return;
    }
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(pos) {
            LocationManager.reverseGeocode(pos.coords.latitude, pos.coords.longitude).then(function(geo) {
                currentLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude, name: geo.city, country: geo.country };
                LocationManager.setCurrent(currentLocation);
                updateLocationDisplay(currentLocation.name);
                loadWeather(currentLocation.lat, currentLocation.lon);
                loadAlerts();
                renderSavedLocations();
            });
        }, function() {
            updateLocationDisplay(t('allow_location'));
            loadAlerts();
            renderSavedLocations();
        }, { enableHighAccuracy: true, timeout: 10000 });
    } else {
        updateLocationDisplay(t('allow_location'));
        loadAlerts();
        renderSavedLocations();
    }
}
function updateLocationDisplay(name) {
    var e1 = document.getElementById('currentLocationName'), e2 = document.getElementById('weatherLocationName');
    if (e1) e1.textContent = name || 'Global';
    if (e2) e2.textContent = name || t('allow_location');
}
function selectLocation(loc) {
    currentLocation = loc;
    LocationManager.setCurrent(loc);
    updateLocationDisplay(loc.name);
    dataReady = { weather: false, earthquakes: false };
    loadWeather(loc.lat, loc.lon);
    loadAlerts();
    if (leafletMap) {
        leafletMap.setView([loc.lat, loc.lon], 8);
        if (userMarker) userMarker.setLatLng([loc.lat, loc.lon]).bindPopup('📍 ' + loc.name).openPopup();
        else { userMarker = L.marker([loc.lat, loc.lon], { icon: createUserIcon() }).addTo(leafletMap).bindPopup('📍 ' + loc.name).openPopup(); }
    }
    closePopups();
    showToast('📍 ' + loc.name);
    updateStarButtons();
}
function createUserIcon() {
    return L.divIcon({ html: '<div style="background:#6200EE;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(98,0,238,0.7)"></div>', iconSize: [18,18], iconAnchor: [9,9] });
}

// ========== DISTANCE ==========
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
function removeSavedLocation(name) { LocationManager.remove(name); renderSavedLocations(); showToast(t('location_removed')); }

// ========== BUTTONS ==========
function setupLocationButtons() {
    function geoLocate(cb) {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(function(pos) {
            LocationManager.reverseGeocode(pos.coords.latitude, pos.coords.longitude).then(function(geo) {
                cb({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: geo.city, country: geo.country });
            });
        });
    }
    document.getElementById('btnMyLocation').addEventListener('click', function() { geoLocate(selectLocation); });
    document.getElementById('btnSearchLocation').addEventListener('click', openSearch);
    document.getElementById('btnWeatherLocation').addEventListener('click', function() { geoLocate(selectLocation); });
    document.getElementById('btnWeatherSearch').addEventListener('click', openSearch);
    document.getElementById('btnSaveLocation').addEventListener('click', function() {
        if (currentLocation.lat) { var ok=LocationManager.save(currentLocation); renderSavedLocations(); showToast(ok ? t('location_saved')+': '+currentLocation.name : '⭐ '+currentLocation.name); }
    });
    document.getElementById('btnRefresh').addEventListener('click', function() {
        dataReady = { weather: false, earthquakes: false };
        loadAlerts();
        if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon);
        showToast('✅ '+t('updated'));
    });
}

// ========== SEARCH WITH AUTOCOMPLETE ==========
function setupSearch() {
    document.getElementById('closeSearch').addEventListener('click', closePopups);
    document.getElementById('searchBtn').addEventListener('click', doSearch);
    var input = document.getElementById('searchInput');
    input.addEventListener('input', function() {
        clearTimeout(searchTimer);
        if (this.value.trim().length < 2) { document.getElementById('searchResults').innerHTML=''; return; }
        searchTimer = setTimeout(doSearch, 350);
    });
    input.addEventListener('keydown', function(e) { if (e.key==='Enter') { clearTimeout(searchTimer); doSearch(); } });
}
function openSearch() {
    document.getElementById('searchPopup').style.display='flex';
    document.getElementById('searchInput').value='';
    document.getElementById('searchResults').innerHTML='';
    setTimeout(function() { document.getElementById('searchInput').focus(); }, 150);
}
function doSearch() {
    var q=document.getElementById('searchInput').value.trim();
    if (q.length<2) return;
    var r=document.getElementById('searchResults');
    r.innerHTML='<div class="loading"><div class="spinner"></div></div>';
    LocationManager.search(q).then(function(locs) {
        if (!locs.length) { r.innerHTML='<p style="text-align:center;color:#999;padding:16px">Sin resultados</p>'; return; }
        r.innerHTML=locs.map(function(l) {
            return '<button class="search-result" onclick="selectLocation({name:\''+l.name.replace(/'/g,"\\'")+'\',lat:'+l.lat+',lon:'+l.lon+',country:\''+l.country.replace(/'/g,"\\'")+'\'})">'+'<strong>'+l.name+'</strong><br><small>'+l.fullName+'</small></button>';
        }).join('');
    }).catch(function(e) { r.innerHTML='<p style="color:red;padding:16px">Error: '+e.message+'</p>'; });
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
function formatTime(ts) {
    var d=Date.now()-ts;
    if(d<3600000) return t('ago_min').replace('{n}',Math.floor(d/60000));
    if(d<86400000) return t('ago_hr').replace('{n}',Math.floor(d/3600000));
    return new Date(ts).toLocaleString(currentLang,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function calcRisk(mag) {
    if(mag>=8) return {label:'⚫ EXTREMO',color:'#212121'};
    if(mag>=7) return {label:'🔴 CRÍTICO',color:'#B71C1C'};
    if(mag>=5) return {label:'🟠 ALTO',color:'#E64A19'};
    if(mag>=4) return {label:'🟡 MEDIO',color:'#F57F17'};
    return {label:'🟢 BAJO',color:'#2E7D32'};
}

// ========== ALERTS (sismos + clima) ==========
function loadAlerts() {
    var loading=document.getElementById('alertsLoading'), list=document.getElementById('alertList'), error=document.getElementById('alertsError');
    loading.style.display='flex'; list.innerHTML=''; error.style.display='none';

    var url = CONFIG.USGS_URL;
    if (currentLocation.lat && currentLocation.lon) url += '&latitude='+currentLocation.lat+'&longitude='+currentLocation.lon+'&maxradiuskm=3000';

    fetch(url).then(function(r){return r.json();}).then(function(data) {
        loading.style.display='none';
        lastEarthquakes = data.features||[];
        dataReady.earthquakes = true;

        // Notify new critical events
        var now=Date.now();
        lastEarthquakes.forEach(function(f) {
            if (!seenAlertIds[f.id] && f.properties.mag>=5.5 && (now-f.properties.time)<1800000) {
                seenAlertIds[f.id]=true;
                var urg = f.properties.mag>=7?'critical':f.properties.mag>=6?'high':'medium';
                sendNotification('🚨 SISMO M'+f.properties.mag.toFixed(1), f.properties.place, urg);
            } else seenAlertIds[f.id]=true;
        });

        // --- SISMO CARDS ---
        lastEarthquakes.forEach(function(f) {
            var mag=f.properties.mag, place=f.properties.place||'?', time=f.properties.time;
            var c=f.geometry.coordinates, depth=c[2].toFixed(1);
            var risk=calcRisk(mag);
            var dist='';
            if(currentLocation.lat) dist='<span class="alert-dist">📏 '+calcDistance(currentLocation.lat,currentLocation.lon,c[1],c[0])+' km</span>';
            var tsunami='';
            if(mag>=7&&depth<70) tsunami='<div class="tsunami-warning">🌊 Posible riesgo de tsunami — Aléjate de la costa</div>';
            var isRecent=(now-time)<3600000;
            var card=document.createElement('div');
            card.className='alert-card'+(mag>=7?' critical':mag>=5?' high':' medium')+(isRecent?' pulse':'');
            card.innerHTML='<div class="alert-header"><span class="alert-type">🌍 SISMO</span><span class="alert-severity" style="color:'+risk.color+'">'+risk.label+'</span></div>'
                +'<div class="alert-title">'+place+'</div>'
                +'<div class="alert-details"><span>💥 M<strong>'+mag.toFixed(1)+'</strong></span><span>⬇️ '+depth+' km prof.</span>'+dist+'</div>'
                +tsunami
                +'<div class="alert-footer"><span>🕐 '+formatTime(time)+'</span><span>📡 USGS</span></div>';
            // Add share button to card
            var shareBtn = document.createElement('button');
            shareBtn.className = 'alert-share-btn';
            shareBtn.textContent = '📤 Compartir';
            var _mag = mag, _place = place, _depth = depth, _time = time;
            var _dist = currentLocation.lat ? calcDistance(currentLocation.lat, currentLocation.lon, c[1], c[0]) : null;
            (function(m, pl, d, di, ti) {
                shareBtn.onclick = function() {
                    openShare(buildShareText('earthquake', {mag:m, place:pl, depth:d, dist:di, time:formatTime(ti)}));
                };
            })(_mag, _place, _depth, _dist, _time);
            card.appendChild(shareBtn);
            list.appendChild(card);
        });

        // --- CLIMA ALERTS (added below sismos) ---
        if (lastWeatherData) addWeatherAlerts(list);

        // Refresh tips now that we have earthquake data
        if (dataReady.weather) refreshSmartTips();

    }).catch(function(e) { loading.style.display='none'; error.style.display='block'; error.textContent='⚠️ '+e.message; });
}

function addWeatherAlerts(list) {
    var d=lastWeatherData;
    var main=d.weather[0].main.toLowerCase();
    var desc=d.weather[0].description;
    var temp=d.main.temp, wind=d.wind.speed, hum=d.main.humidity;
    var city=d.name||currentLocation.name||'';
    var weatherAlerts=[];

    if (main==='thunderstorm') weatherAlerts.push({ icon:'⛈️', type:'TORMENTA ELÉCTRICA', title:'Tormenta eléctrica activa en '+city, detail:'Vientos fuertes y rayos. Refúgiate en interior.', color:'#B71C1C', urgency:'critical' });
    if (main==='tornado') weatherAlerts.push({ icon:'🌪️', type:'TORNADO', title:'Tornado detectado', detail:'Busca refugio inmediatamente en sótano o habitación interior.', color:'#000', urgency:'critical' });
    if (main==='rain'||main==='drizzle') weatherAlerts.push({ icon:'🌧️', type:'LLUVIA', title:'Lluvia: '+desc+' en '+city, detail:'Hum. '+hum+'% · Viento '+wind.toFixed(0)+' m/s', color:'#1565C0', urgency:'info' });
    if (main==='snow') weatherAlerts.push({ icon:'❄️', type:'NEVADA', title:'Nevando en '+city, detail:'Temperatura: '+Math.round(temp)+'°C. Cuidado en caminos.', color:'#0277BD', urgency:'medium' });
    if (main==='mist'||main==='fog'||main==='haze') weatherAlerts.push({ icon:'🌫️', type:'NIEBLA', title:'Visibilidad reducida en '+city, detail:'Conduce con luces bajas y reduce velocidad.', color:'#546E7A', urgency:'info' });
    if (wind>15) weatherAlerts.push({ icon:'💨', type:'VIENTO EXTREMO', title:'Viento extremo: '+wind.toFixed(0)+' m/s en '+city, detail:'Asegura objetos. Evita zonas con árboles.', color:'#E64A19', urgency:'high' });
    else if (wind>10) weatherAlerts.push({ icon:'💨', type:'VIENTO FUERTE', title:'Viento fuerte: '+wind.toFixed(0)+' m/s en '+city, detail:'Ten precaución en caminos abiertos y puentes.', color:'#FF6F00', urgency:'medium' });
    if (temp>38) weatherAlerts.push({ icon:'🔥', type:'OLA DE CALOR', title:'Calor extremo: '+Math.round(temp)+'°C en '+city, detail:'Peligroso. Hidrátate. No dejes niños en vehículos.', color:'#B71C1C', urgency:'critical' });
    if (temp<-5) weatherAlerts.push({ icon:'🥶', type:'OLA DE FRÍO', title:'Congelante: '+Math.round(temp)+'°C en '+city, detail:'Riesgo de hipotermia. Abrígate. No salgas sin necesidad.', color:'#0D47A1', urgency:'critical' });
    else if (temp<3) weatherAlerts.push({ icon:'❄️', type:'FRÍO INTENSO', title:'Temperatura bajo 3°C en '+city, detail:'Protege plantas y cañerías. Abrígate bien.', color:'#1565C0', urgency:'medium' });

    weatherAlerts.forEach(function(a) {
        var card=document.createElement('div');
        card.className='alert-card weather-alert-card';
        card.style.borderLeftColor=a.color;
        card.innerHTML='<div class="alert-header"><span class="alert-type" style="background:'+a.color+'">'+a.icon+' '+a.type+'</span></div>'
            +'<div class="alert-title">'+a.title+'</div>'
            +'<div class="alert-location">'+a.detail+'</div>'
            +'<div class="alert-footer"><span>🕐 Ahora</span><span>📡 OpenWeather</span></div>';
        list.appendChild(card);
    });
}

// ========== WEATHER ==========
function loadWeather(lat, lon) {
    var loading=document.getElementById('weatherLoading'), container=document.getElementById('weatherContainer'), error=document.getElementById('weatherError');
    loading.style.display='flex'; container.style.display='none'; error.style.display='none';

    fetch(CONFIG.WEATHER_URL+'?lat='+lat+'&lon='+lon+'&appid='+CONFIG.WEATHER_API_KEY+'&units=metric&lang='+currentLang)
        .then(function(r){return r.json();}).then(function(d) {
            loading.style.display='none'; container.style.display='block';
            lastWeatherData=d;
            dataReady.weather=true;

            document.getElementById('wCity').textContent=d.name||currentLocation.name;
            document.getElementById('wTemp').textContent=Math.round(d.main.temp)+'°C';
            document.getElementById('wDesc').textContent=d.weather[0].description;
            document.getElementById('wHumidity').textContent=d.main.humidity+'%';
            document.getElementById('wWind').textContent=d.wind.speed+' m/s';
            document.getElementById('wFeels').textContent=Math.round(d.main.feels_like)+'°C';
            document.getElementById('wPressure').textContent=d.main.pressure+' hPa';

            var t2=d.main.temp, rec;
            if(t2>35)rec=t('rec_extreme');else if(t2>30)rec=t('rec_hot');
            else if(t2>25)rec=t('rec_warm');else if(t2>15)rec=t('rec_nice');
            else if(t2>10)rec=t('rec_cool');else if(t2>0)rec=t('rec_cold');
            else rec=t('rec_freeze');
            document.getElementById('wRecommendation').textContent=rec;

            // Weather share button
            var wShareBtn = document.getElementById('wShareBtn');
            if (!wShareBtn) {
                wShareBtn = document.createElement('button');
                wShareBtn.id = 'wShareBtn';
                wShareBtn.className = 'alert-share-btn';
                wShareBtn.style.marginTop = '12px';
                wShareBtn.textContent = '📤 Compartir clima';
                document.getElementById('weatherContainer').appendChild(wShareBtn);
            }
            wShareBtn.onclick = function() {
                openShare(buildShareText('weather', {
                    city: d.name||currentLocation.name,
                    temp: Math.round(d.main.temp),
                    feels: Math.round(d.main.feels_like),
                    desc: d.weather[0].description,
                    hum: d.main.humidity,
                    wind: d.wind.speed
                }));
            };

            // Dangerous weather notifications
            var main=d.weather[0].main.toLowerCase();
            if(main==='thunderstorm') sendNotification('⛈️ Tormenta eléctrica','En '+(d.name||currentLocation.name)+'. Refúgiate en interior.','critical');
            else if(d.wind.speed>15) sendNotification('💨 Viento extremo: '+d.wind.speed.toFixed(0)+' m/s','En '+(d.name||currentLocation.name)+'. Ten precaución.','high');
            else if(main==='rain') sendNotification('🌧️ Lluvia ahora','En '+(d.name||currentLocation.name)+'. Lleva paraguas.','info');

            // Update alerts tab weather cards if it's active
            var alertList=document.getElementById('alertList');
            if(alertList && alertList.children.length>0) {
                // Remove old weather cards and re-add
                var oldCards=alertList.querySelectorAll('.weather-alert-card');
                oldCards.forEach(function(c){c.remove();});
                addWeatherAlerts(alertList);
            }

            loadForecast(lat, lon);
        }).catch(function(e) { loading.style.display='none'; error.style.display='block'; error.textContent='⚠️ '+e.message; });
}

function loadForecast(lat, lon) {
    fetch(CONFIG.FORECAST_URL+'?lat='+lat+'&lon='+lon+'&appid='+CONFIG.WEATHER_API_KEY+'&units=metric&lang='+currentLang+'&cnt=16')
        .then(function(r){return r.json();}).then(function(d) {
            lastForecastData=d;
            refreshSmartTips();
        }).catch(function(){
            // Refresh tips even without forecast
            refreshSmartTips();
        });
}

// ========== SMART TIPS (100% TIEMPO REAL) ==========
function refreshSmartTips() {
    // Only generate if we have at least weather data
    if (!dataReady.weather && !dataReady.earthquakes) {
        document.getElementById('tipsList').innerHTML='<div class="loading"><div class="spinner"></div><p>Cargando datos en tiempo real...</p></div>';
        return;
    }

    var tips=[], now=Date.now();

    // === SISMOS CRÍTICOS ===
    if (lastEarthquakes.length) {
        var big=lastEarthquakes.filter(function(f){return (now-f.properties.time)<3600000&&f.properties.mag>=6;});
        if (big.length) {
            var eq=big[0], mag=eq.properties.mag, place=eq.properties.place;
            var dist=currentLocation.lat?calcDistance(currentLocation.lat,currentLocation.lon,eq.geometry.coordinates[1],eq.geometry.coordinates[0]):null;
            tips.push({title:'🚨 SISMO M'+mag.toFixed(1)+' — HACE MENOS DE 1 HORA',desc:'Epicentro: '+place+(dist?' · '+dist+' km de tu ubicación':'')+'. Mantén la calma. Aléjate de ventanas y objetos que puedan caer. No uses ascensores. Revisa posibles fugas de gas. Identifica zona segura.',cat:'⚫ EMERGENCIA',color:'#B71C1C',priority:100});
            if(mag>=7&&eq.geometry.coordinates[2]<70) tips.push({title:'🌊 RIESGO DE TSUNAMI DETECTADO',desc:'Terremoto M'+mag.toFixed(1)+' de profundidad superficial. Evacúa INMEDIATAMENTE hacia zonas altas. Sigue rutas oficiales de evacuación. No regreses hasta autorización de autoridades.',cat:'⚫ EMERGENCIA',color:'#880E4F',priority:99});
        }
        var mod=lastEarthquakes.filter(function(f){return (now-f.properties.time)<21600000&&f.properties.mag>=5;});
        if(mod.length&&!big.length) tips.push({title:'⚠️ '+mod.length+' sismos M5+ en últimas 6h',desc:'Actividad sísmica elevada en tu zona. Conoce tus rutas de evacuación. Asegura objetos que puedan caer en casa.',cat:'🟠 PRECAUCIÓN',color:'#E65100',priority:75});
    }

    // === CLIMA ACTUAL (tiempo real) ===
    if (lastWeatherData) {
        var d=lastWeatherData;
        var temp=d.main.temp, wind=d.wind.speed, hum=d.main.humidity, feels=d.main.feels_like;
        var main=d.weather[0].main.toLowerCase(), desc2=d.weather[0].description;
        var city=d.name||currentLocation.name||'tu zona';

        // Tormenta eléctrica
        if(main==='thunderstorm') {
            tips.push({title:'⛈️ TORMENTA ELÉCTRICA ACTIVA — '+city.toUpperCase(),desc:'No permanezcas bajo árboles, postes ni estructuras metálicas. Desconecta aparatos eléctricos. Evita actividades al aire libre. Refúgiate en interior sólido. No uses teléfono fijo ni bañeras.',cat:'🔴 EMERGENCIA',color:'#B71C1C',priority:95});
        }
        // Lluvia
        if(main==='rain'||main==='drizzle') {
            var intensity=wind>10?'con viento fuerte':'';
            tips.push({title:'🌧️ LLUVIA AHORA: '+desc2+' — '+city,desc:'Lleva paraguas y ropa impermeable. Conduce con luces encendidas y reduce velocidad. Evita cruzar zonas inundables. '+intensity+' Protege dispositivos electrónicos. Cuidado con calles resbaladizas.',cat:'🟡 PRECAUCIÓN',color:'#1565C0',priority:85});
        }
        // Nevada
        if(main==='snow') {
            tips.push({title:'❄️ NEVANDO AHORA — '+city,desc:'Conduce solo si es necesario, usa cadenas. Protege cañerías contra congelamiento. Abrígate en capas. Revisa calefacción. Precaución en aceras y caminos.',cat:'🟠 PRECAUCIÓN',color:'#0277BD',priority:83});
        }
        // Niebla
        if(main==='mist'||main==='fog'||main==='haze') {
            tips.push({title:'🌫️ VISIBILIDAD REDUCIDA — '+city,desc:'Usa luces bajas al conducir (nunca altas en niebla). Reduce velocidad considerablemente. Aumenta la distancia de frenado. Extrema precaución en cruces.',cat:'🟡 PRECAUCIÓN',color:'#546E7A',priority:70});
        }
        // Tornado
        if(main==='tornado') {
            tips.push({title:'🌪️ TORNADO — EMERGENCIA EXTREMA',desc:'Busca refugio INMEDIATO en sótano o habitación interior en planta baja. Aléjate de ventanas. No salgas en vehículo. Si estás al aire libre, tírate al suelo en una zanja.',cat:'⚫ EXTREMO',color:'#000',priority:98});
        }
        // Viento extremo
        if(wind>15) {
            tips.push({title:'💨 VIENTO EXTREMO: '+wind.toFixed(0)+' m/s ('+Math.round(wind*3.6)+' km/h) — '+city,desc:'Asegura objetos sueltos en exteriores. Evita parques y zonas con árboles grandes. Reduce velocidad al conducir, especialmente en puentes. Riesgo de caída de ramas y objetos.',cat:'🔴 ALTO',color:'#E64A19',priority:88});
        } else if(wind>10) {
            tips.push({title:'💨 VIENTO FUERTE: '+wind.toFixed(0)+' m/s — '+city,desc:'Hoy hay '+desc2+' con vientos de '+wind.toFixed(0)+' m/s en '+city+'. Asegura toldos y objetos exteriores. Precaución en caminos abiertos y al abrir puertas.',cat:'🟠 PRECAUCIÓN',color:'#FF6F00',priority:60});
        }
        // Calor extremo
        if(temp>38) {
            tips.push({title:'🔥 OLA DE CALOR: '+Math.round(temp)+'°C (Sensación '+Math.round(feels)+'°C) — '+city,desc:'Situación peligrosa. Evita salir entre 11:00-16:00. Nunca dejes niños o mascotas en vehículos. Hidrátate cada 20 min aunque no tengas sed. Usa SPF 50+. Busca aire acondicionado.',cat:'🔴 EMERGENCIA',color:'#B71C1C',priority:90});
        } else if(temp>30) {
            tips.push({title:'☀️ MUCHO CALOR: '+Math.round(temp)+'°C — '+city,desc:'Bebe agua frecuentemente. Usa ropa ligera y clara. Busca sombra en horario de mayor radiación. Aplica protector solar.',cat:'🟡 PRECAUCIÓN',color:'#FF6F00',priority:65});
        }
        // Frío extremo
        if(temp<-5) {
            tips.push({title:'🥶 CONGELANTE: '+Math.round(temp)+'°C — '+city,desc:'Riesgo de hipotermia. Abrígate en capas (interior, aislante, exterior). No salgas sin necesidad. Protege cañerías. Revisa a adultos mayores y niños de tu entorno.',cat:'🔴 EMERGENCIA',color:'#0D47A1',priority:89});
        } else if(temp<3) {
            tips.push({title:'❄️ TEMPERATURA BAJO 3°C: '+Math.round(temp)+'°C — '+city,desc:'Hoy tienes '+desc2+' con '+Math.round(temp)+'°C en '+city+'. Abrígate bien y en capas. Protege plantas y mascotas del frío. Cuidado con escarcha en caminos y puentes.',cat:'🟠 PRECAUCIÓN',color:'#1565C0',priority:70});
        } else if(temp<10) {
            tips.push({title:'🌬️ DÍA FRÍO: '+Math.round(temp)+'°C — '+city,desc:'Hoy hay '+desc2+' con '+Math.round(temp)+'°C en '+city+'. Lleva chaqueta. Humedad actual: '+hum+'%. Consume alimentos calientes.',cat:'🟢 PREVENCIÓN',color:'#0288D1',priority:35});
        }
        // Humedad alta con calor
        if(hum>85&&temp>22) {
            tips.push({title:'💧 BOCHORNO: '+Math.round(temp)+'°C + '+hum+'% humedad',desc:'La combinación calor-humedad eleva el riesgo de golpe de calor. Sensación térmica: '+Math.round(feels)+'°C. Busca lugares ventilados e hidrátate constantemente.',cat:'🟠 PRECAUCIÓN',color:'#FF6F00',priority:55});
        }
        // Día normal soleado
        if((main==='clear')&&temp>10&&temp<=25&&wind<=10) {
            tips.push({title:'☀️ DÍA DESPEJADO: '+Math.round(temp)+'°C — '+city,desc:'Buenas condiciones hoy. Aun así usa protector solar SPF 30+ si vas a estar al aire libre. Hidrátate regularmente.',cat:'🟢 PREVENCIÓN',color:'#F57F17',priority:25});
        }
        // Nubes + fresco (condición actual de Cañete)
        if((main==='clouds')&&temp>5&&temp<=15) {
            tips.push({title:'☁️ DÍA NUBLADO Y FRESCO: '+Math.round(temp)+'°C — '+city,desc:'Hoy: '+desc2+' con '+Math.round(temp)+'°C en '+city+'. Humedad: '+hum+'%. Lleva chaqueta o polar. Puede haber llovizna.',cat:'🟢 PREVENCIÓN',color:'#0288D1',priority:30});
        }
    }

    // === PRONÓSTICO PRÓXIMAS HORAS ===
    if (lastForecastData && lastForecastData.list) {
        var fc=lastForecastData.list, storm=false, rain=false, coldfc=false, heat=false;
        var curMain=lastWeatherData?lastWeatherData.weather[0].main.toLowerCase():'';
        for(var i=0;i<Math.min(fc.length,8);i++) {
            var m=fc[i].weather[0].main.toLowerCase();
            if(m==='thunderstorm') storm=true;
            if(m==='rain'||m==='drizzle') rain=true;
            if(fc[i].main.temp<1) coldfc=true;
            if(fc[i].main.temp>33) heat=true;
        }
        if(storm&&curMain!=='thunderstorm') tips.push({title:'⛈️ Tormentas eléctricas — próximas horas',desc:'Se pronostican tormentas en '+( currentLocation.name||'tu zona')+'. Recoge ropa tendida. Asegura objetos exteriores. Ten linterna y velas a mano.',cat:'🟠 PRECAUCIÓN',color:'#E64A19',priority:72});
        if(rain&&['rain','drizzle'].indexOf(curMain)<0) tips.push({title:'🌧️ Lluvias — próximas horas',desc:'Se esperan lluvias en '+(currentLocation.name||'tu zona')+'. Lleva paraguas si sales. Revisa canaletas.',cat:'🟡 PREVENCIÓN',color:'#1976D2',priority:45});
        if(coldfc&&lastWeatherData&&lastWeatherData.main.temp>3) tips.push({title:'🌡️ Descenso de temperatura — próximas horas',desc:'Se esperan temperaturas cercanas a 0°C. Prepara abrigo extra y protege plantas.',cat:'🟡 PREVENCIÓN',color:'#0288D1',priority:40});
        if(heat&&lastWeatherData&&lastWeatherData.main.temp<30) tips.push({title:'🌡️ Ola de calor — próximas horas',desc:'Se esperan temperaturas sobre 33°C. Prepara ventilación y agua fría.',cat:'🟡 PREVENCIÓN',color:'#FF6F00',priority:42});
    }

    // === GENÉRICOS solo si hay pocos tips ===
    if (tips.length<2) {
        tips.push({title:'🎒 Mochila de emergencia',desc:'Agua (1L/persona), linterna, radio a pilas, documentos, medicamentos y comida no perecedera.',cat:'🟢 PREVENCIÓN',color:'#795548',priority:10});
        tips.push({title:'📱 Plan familiar de emergencia',desc:'Define punto de encuentro. Guarda: Bomberos 132, Ambulancia 131, Carabineros 133, SENAPRED 1470.',cat:'🟢 PREVENCIÓN',color:'#607D8B',priority:5});
    }

    tips.sort(function(a,b){return b.priority-a.priority;});
    renderTips(tips);
}

function renderTips(tips) {
    var list=document.getElementById('tipsList'); list.innerHTML='';
    var h=document.createElement('div');
    h.style.cssText='padding:8px 12px;font-size:11px;color:#999;text-align:right;';
    var loc=currentLocation.name?(' — '+currentLocation.name):'';
    h.textContent='🔄 '+new Date().toLocaleTimeString(currentLang,{hour:'2-digit',minute:'2-digit'})+loc;
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
    leafletMap=L.map('map').setView([lat,lon],7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(leafletMap);
    if(currentLocation.lat) {
        userMarker=L.marker([currentLocation.lat,currentLocation.lon],{icon:createUserIcon()}).addTo(leafletMap).bindPopup('<b>📍 '+currentLocation.name+'</b>').openPopup();
    }
    fetch(CONFIG.USGS_URL).then(function(r){return r.json();}).then(function(data){
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

// ========== FAVORITES ==========
var currentShareText = '';

function setupFavorites() {
    // Star buttons
    document.getElementById('btnStarAlert').addEventListener('click', toggleFavorite);
    document.getElementById('btnStarWeather').addEventListener('click', toggleFavorite);

    // Favorites popup
    document.getElementById('btnFavorites').addEventListener('click', openFavorites);
    document.getElementById('closeFavorites').addEventListener('click', closePopups);

    // Share popup
    document.getElementById('closeShare').addEventListener('click', closePopups);

    updateStarButtons();
    updateFavBadge();
}

function toggleFavorite() {
    if (!currentLocation.lat) { showToast('📍 Primero detecta tu ubicación'); return; }
    var locs = LocationManager.getAll();
    var exists = locs.find(function(l) { return l.name === currentLocation.name; });
    if (exists) {
        LocationManager.remove(currentLocation.name);
        showToast('⭐ Eliminado de favoritos: ' + currentLocation.name);
    } else {
        LocationManager.save(currentLocation);
        showToast('⭐ Guardado en favoritos: ' + currentLocation.name);
    }
    updateStarButtons();
    updateFavBadge();
}

function updateStarButtons() {
    var locs = LocationManager.getAll();
    var isFav = currentLocation.name && locs.find(function(l) { return l.name === currentLocation.name; });
    var star1 = document.getElementById('btnStarAlert');
    var star2 = document.getElementById('btnStarWeather');
    if (star1) { star1.textContent = isFav ? '★' : '☆'; star1.classList.toggle('active', !!isFav); }
    if (star2) { star2.textContent = isFav ? '★' : '☆'; star2.classList.toggle('active', !!isFav); }
}

function updateFavBadge() {
    var btn = document.getElementById('btnFavorites');
    var count = LocationManager.getAll().length;
    var badge = btn.querySelector('.fav-badge');
    if (count > 0) {
        if (!badge) { badge = document.createElement('span'); badge.className = 'fav-badge'; btn.appendChild(badge); }
        badge.textContent = count;
    } else {
        if (badge) badge.remove();
    }
}

function openFavorites() {
    var locs = LocationManager.getAll();
    var list = document.getElementById('favoritesList');
    var empty = document.getElementById('favoritesEmpty');

    if (!locs.length) {
        list.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        list.innerHTML = locs.map(function(l, i) {
            var sn = l.name.replace(/'/g, "\\'");
            var sc = (l.country || '').replace(/'/g, "\\'");
            return '<div class="fav-item">'
                + '<div class="fav-item-info" onclick="selectLocation({name:\'' + sn + '\',lat:' + l.lat + ',lon:' + l.lon + ',country:\'' + sc + '\'});closePopups()">'
                    + '<div class="fav-item-name">⭐ ' + l.name + '</div>'
                    + '<div class="fav-item-country">' + (l.country || '') + ' · ' + l.lat.toFixed(2) + ', ' + l.lon.toFixed(2) + '</div>'
                + '</div>'
                + '<div class="fav-item-actions">'
                    + '<button class="fav-go-btn" onclick="selectLocation({name:\'' + sn + '\',lat:' + l.lat + ',lon:' + l.lon + ',country:\'' + sc + '\'});closePopups()">Ir →</button>'
                    + '<button class="fav-del-btn" onclick="removeFavorite(\'' + sn + '\')">🗑️</button>'
                + '</div>'
                + '</div>';
        }).join('');
    }

    document.getElementById('favoritesPopup').style.display = 'flex';
}

function removeFavorite(name) {
    LocationManager.remove(name);
    updateStarButtons();
    updateFavBadge();
    openFavorites(); // Refresh list
    showToast('🗑️ Eliminado de favoritos');
}

// ========== SHARE ==========
function openShare(text) {
    currentShareText = text;
    document.getElementById('shareContent').textContent = text;
    var nativeBtn = document.getElementById('shareNative');
    nativeBtn.style.display = navigator.share ? 'flex' : 'none';
    document.getElementById('sharePopup').style.display = 'flex';
    setupShareButtons(text);
}

function setupShareButtons(text) {
    var encoded = encodeURIComponent(text);
    var appUrl = encodeURIComponent('https://appcml.github.io/AlertaGlobal/');

    document.getElementById('shareWhatsapp').onclick = function() {
        window.open('https://wa.me/?text=' + encoded, '_blank');
    };
    document.getElementById('shareTwitter').onclick = function() {
        window.open('https://twitter.com/intent/tweet?text=' + encoded + '&url=' + appUrl, '_blank');
    };
    document.getElementById('shareFacebook').onclick = function() {
        window.open('https://www.facebook.com/sharer/sharer.php?u=' + appUrl + '&quote=' + encoded, '_blank');
    };
    document.getElementById('shareTelegram').onclick = function() {
        window.open('https://t.me/share/url?url=' + appUrl + '&text=' + encoded, '_blank');
    };
    document.getElementById('shareCopy').onclick = function() {
        navigator.clipboard ? navigator.clipboard.writeText(text).then(function() { showToast('📋 Copiado al portapapeles'); }) : (function() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('📋 Copiado'); })();
    };
    document.getElementById('shareNative').onclick = function() {
        if (navigator.share) navigator.share({ title: 'Alerta Global', text: text, url: 'https://appcml.github.io/AlertaGlobal/' });
    };
}

function buildShareText(type, data) {
    var app = '🌍 Alerta Global — appcml.github.io/AlertaGlobal/';
    if (type === 'earthquake') {
        var mag = data.mag, place = data.place, depth = data.depth, dist = data.dist, time = data.time;
        var icon = mag >= 7 ? '🚨' : mag >= 5 ? '⚠️' : '📍';
        return icon + ' SISMO M' + mag.toFixed(1) + '\n'
            + '📍 ' + place + '\n'
            + '⬇️ Profundidad: ' + depth + ' km\n'
            + (dist ? '📏 ' + dist + ' km de ' + (currentLocation.name || 'mi ubicación') + '\n' : '')
            + '🕐 ' + time + '\n'
            + '📡 Fuente: USGS\n\n' + app;
    }
    if (type === 'weather') {
        return '🌤️ CLIMA AHORA — ' + data.city + '\n'
            + '🌡️ Temperatura: ' + data.temp + '°C (Sensación: ' + data.feels + '°C)\n'
            + '☁️ ' + data.desc + '\n'
            + '💧 Humedad: ' + data.hum + '%\n'
            + '💨 Viento: ' + data.wind + ' m/s\n\n' + app;
    }
    return app;
}
