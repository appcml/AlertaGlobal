// ============================================
// js/app.js — Alerta Global - App Principal
// ============================================
var CONFIG = {
    USGS_URL: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=30&minmagnitude=4.0&orderby=time',
    WEATHER_API_KEY: '6fe6e0dcca264864dbd631bf620aad64',
    WEATHER_URL: 'https://api.openweathermap.org/data/2.5/weather',
    REFRESH_INTERVAL: 300000
};

var currentLocation = { lat: null, lon: null, name: '', country: '' };
var leafletMap = null;
var mapInitialized = false;

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function() {
    setLanguage(currentLang);
    setupTabs();
    setupLocationButtons();
    setupLanguageSelector();
    setupSearch();
    loadTips();
    initLocation();
    setInterval(function() { loadAlerts(); }, CONFIG.REFRESH_INTERVAL);
});

// ========== TABS ==========
function setupTabs() {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener('click', function() {
            var target = this.dataset.tab;
            var allTabs = document.querySelectorAll('.tab');
            var allPanels = document.querySelectorAll('.tab-panel');
            for (var j = 0; j < allTabs.length; j++) allTabs[j].classList.remove('active');
            for (var j = 0; j < allPanels.length; j++) allPanels[j].classList.remove('active');
            this.classList.add('active');
            document.getElementById('panel-' + target).classList.add('active');
            if (target === 'mapa' && !mapInitialized) initMap();
        });
    }
}

// ========== GEOLOCATION ==========
function initLocation() {
    // Try saved location first
    var saved = LocationManager.getCurrent();
    if (saved && saved.lat) {
        currentLocation = saved;
        updateLocationDisplay(saved.name);
        loadAlerts();
        loadWeather(saved.lat, saved.lon);
        renderSavedLocations();
        return;
    }

    // Try browser geolocation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                var lat = pos.coords.latitude;
                var lon = pos.coords.longitude;
                LocationManager.reverseGeocode(lat, lon).then(function(geo) {
                    currentLocation = { lat: lat, lon: lon, name: geo.city, country: geo.country };
                    LocationManager.setCurrent(currentLocation);
                    updateLocationDisplay(currentLocation.name);
                    loadWeather(lat, lon);
                    loadAlerts();
                    renderSavedLocations();
                });
            },
            function() {
                // Geolocation denied — load global alerts anyway
                updateLocationDisplay(t('allow_location'));
                loadAlerts();
                renderSavedLocations();
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    } else {
        // No geolocation support — load global alerts
        updateLocationDisplay(t('allow_location'));
        loadAlerts();
        renderSavedLocations();
    }
}

function updateLocationDisplay(name) {
    var e1 = document.getElementById('currentLocationName');
    var e2 = document.getElementById('weatherLocationName');
    if (e1) e1.textContent = name || t('global_alerts');
    if (e2) e2.textContent = name || t('allow_location');
}

function selectLocation(loc) {
    currentLocation = loc;
    LocationManager.setCurrent(loc);
    updateLocationDisplay(loc.name);
    loadWeather(loc.lat, loc.lon);
    loadAlerts();
    if (leafletMap) leafletMap.setView([loc.lat, loc.lon], 8);
    closePopups();
    showToast('📍 ' + loc.name);
}

// ========== SAVED LOCATIONS ==========
function renderSavedLocations() {
    var locs = LocationManager.getAll();
    var ids = ['savedLocations', 'weatherSavedLocations'];
    for (var k = 0; k < ids.length; k++) {
        var c = document.getElementById(ids[k]);
        if (!c) continue;
        if (!locs.length) { c.innerHTML = ''; continue; }
        var html = '';
        for (var i = 0; i < locs.length; i++) {
            var l = locs[i];
            var safeName = l.name.replace(/'/g, "\\'");
            var safeCountry = (l.country || '').replace(/'/g, "\\'");
            html += '<div class="saved-loc">';
            html += '<button class="saved-loc-btn" onclick="selectLocation({name:\'' + safeName + '\',lat:' + l.lat + ',lon:' + l.lon + ',country:\'' + safeCountry + '\'})">📍 ' + l.name + '</button>';
            html += '<button class="saved-loc-remove" onclick="removeSavedLocation(\'' + safeName + '\')">✕</button>';
            html += '</div>';
        }
        c.innerHTML = html;
    }
}

function removeSavedLocation(name) {
    LocationManager.remove(name);
    renderSavedLocations();
    showToast(t('location_removed'));
}

// ========== BUTTONS ==========
function setupLocationButtons() {
    document.getElementById('btnMyLocation').addEventListener('click', function() {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(function(pos) {
            LocationManager.reverseGeocode(pos.coords.latitude, pos.coords.longitude).then(function(geo) {
                selectLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: geo.city, country: geo.country });
            });
        });
    });

    document.getElementById('btnSearchLocation').addEventListener('click', openSearch);

    document.getElementById('btnWeatherLocation').addEventListener('click', function() {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(function(pos) {
            LocationManager.reverseGeocode(pos.coords.latitude, pos.coords.longitude).then(function(geo) {
                selectLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: geo.city, country: geo.country });
            });
        });
    });

    document.getElementById('btnWeatherSearch').addEventListener('click', openSearch);

    document.getElementById('btnSaveLocation').addEventListener('click', function() {
        if (currentLocation.lat) {
            var ok = LocationManager.save(currentLocation);
            renderSavedLocations();
            showToast(ok ? t('location_saved') + ': ' + currentLocation.name : '⭐ ' + currentLocation.name);
        }
    });

    document.getElementById('btnRefresh').addEventListener('click', function() {
        loadAlerts();
        if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon);
        showToast('✅ ' + t('updated'));
    });
}

// ========== SEARCH ==========
function setupSearch() {
    document.getElementById('closeSearch').addEventListener('click', closePopups);
    document.getElementById('searchBtn').addEventListener('click', doSearch);
    document.getElementById('searchInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') doSearch();
    });
}

function openSearch() {
    document.getElementById('searchPopup').style.display = 'flex';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
    setTimeout(function() { document.getElementById('searchInput').focus(); }, 150);
}

function doSearch() {
    var q = document.getElementById('searchInput').value.trim();
    if (!q) return;
    var results = document.getElementById('searchResults');
    results.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    LocationManager.search(q).then(function(locs) {
        if (!locs.length) {
            results.innerHTML = '<p style="text-align:center;color:#999;padding:16px">Sin resultados</p>';
            return;
        }
        var html = '';
        for (var i = 0; i < locs.length; i++) {
            var l = locs[i];
            var safeName = l.name.replace(/'/g, "\\'");
            var safeCountry = l.country.replace(/'/g, "\\'");
            html += '<button class="search-result" onclick="selectLocation({name:\'' + safeName + '\',lat:' + l.lat + ',lon:' + l.lon + ',country:\'' + safeCountry + '\'})">';
            html += '<strong>' + l.name + '</strong><br><small>' + l.fullName + '</small>';
            html += '</button>';
        }
        results.innerHTML = html;
    }).catch(function(e) {
        results.innerHTML = '<p style="color:red;padding:16px">Error: ' + e.message + '</p>';
    });
}

function closePopups() {
    document.getElementById('searchPopup').style.display = 'none';
    document.getElementById('langPopup').style.display = 'none';
}

// ========== LANGUAGE ==========
function setupLanguageSelector() {
    document.getElementById('btnLang').addEventListener('click', function() {
        document.getElementById('langPopup').style.display = 'flex';
    });
    document.getElementById('closeLang').addEventListener('click', closePopups);

    var btns = document.querySelectorAll('.lang-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function() {
            setLanguage(this.dataset.lang);
            closePopups();
            loadTips();
            if (currentLocation.lat) loadWeather(currentLocation.lat, currentLocation.lon);
            showToast('🌐 ' + this.textContent.trim());
        });
    }
}

// ========== TOAST ==========
function showToast(msg) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function() { toast.classList.remove('show'); }, 2500);
}

// ========== FORMAT TIME ==========
function formatTime(ts) {
    var diff = Date.now() - ts;
    if (diff < 3600000) return t('ago_min').replace('{n}', Math.floor(diff / 60000));
    if (diff < 86400000) return t('ago_hr').replace('{n}', Math.floor(diff / 3600000));
    return new Date(ts).toLocaleDateString(currentLang, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ========== ALERTS ==========
function loadAlerts() {
    var loading = document.getElementById('alertsLoading');
    var list = document.getElementById('alertList');
    var error = document.getElementById('alertsError');

    loading.style.display = 'flex';
    list.innerHTML = '';
    error.style.display = 'none';

    var url = CONFIG.USGS_URL;
    if (currentLocation.lat && currentLocation.lon) {
        url += '&latitude=' + currentLocation.lat + '&longitude=' + currentLocation.lon + '&maxradiuskm=2000';
    }

    fetch(url)
        .then(function(res) { return res.json(); })
        .then(function(data) {
            loading.style.display = 'none';

            if (!data.features || !data.features.length) {
                list.innerHTML = '<div class="loading"><p>' + t('no_alerts') + '</p></div>';
                return;
            }

            for (var i = 0; i < data.features.length; i++) {
                var f = data.features[i];
                var mag = f.properties.mag;
                var place = f.properties.place || '?';
                var time = f.properties.time;
                var coords = f.geometry.coordinates;
                var depth = coords[2].toFixed(1);

                var sev, cls, col;
                if (mag >= 7) { sev = t('critical'); cls = 'critical'; col = 'severity-critical'; }
                else if (mag >= 5) { sev = t('high'); cls = 'high'; col = 'severity-high'; }
                else { sev = t('medium'); cls = 'medium'; col = 'severity-medium'; }

                var card = document.createElement('div');
                card.className = 'alert-card ' + cls;
                card.innerHTML = '<div class="alert-header"><span class="alert-type">' + t('earthquake') + '</span><span class="alert-severity ' + col + '">' + sev + '</span></div>'
                    + '<div class="alert-title">' + place + '</div>'
                    + '<div class="alert-location">📍 ' + coords[1].toFixed(2) + ', ' + coords[0].toFixed(2) + ' · ' + t('depth') + ': ' + depth + ' km</div>'
                    + '<div class="alert-magnitude">' + t('magnitude') + ': ' + mag.toFixed(1) + '</div>'
                    + '<div class="alert-footer"><span>' + formatTime(time) + '</span><span>' + t('source') + ': USGS</span></div>';
                list.appendChild(card);
            }
        })
        .catch(function(e) {
            loading.style.display = 'none';
            error.style.display = 'block';
            error.textContent = '⚠️ ' + e.message;
        });
}

// ========== WEATHER ==========
function loadWeather(lat, lon) {
    var loading = document.getElementById('weatherLoading');
    var container = document.getElementById('weatherContainer');
    var error = document.getElementById('weatherError');

    loading.style.display = 'flex';
    container.style.display = 'none';
    error.style.display = 'none';

    var url = CONFIG.WEATHER_URL + '?lat=' + lat + '&lon=' + lon + '&appid=' + CONFIG.WEATHER_API_KEY + '&units=metric&lang=' + currentLang;

    fetch(url)
        .then(function(res) { return res.json(); })
        .then(function(data) {
            loading.style.display = 'none';
            container.style.display = 'block';

            document.getElementById('wCity').textContent = data.name || currentLocation.name;
            document.getElementById('wTemp').textContent = Math.round(data.main.temp) + '°C';
            document.getElementById('wDesc').textContent = data.weather[0].description;
            document.getElementById('wHumidity').textContent = data.main.humidity + '%';
            document.getElementById('wWind').textContent = data.wind.speed + ' m/s';
            document.getElementById('wFeels').textContent = Math.round(data.main.feels_like) + '°C';
            document.getElementById('wPressure').textContent = data.main.pressure + ' hPa';

            var temp = data.main.temp;
            var rec;
            if (temp > 35) rec = t('rec_extreme');
            else if (temp > 30) rec = t('rec_hot');
            else if (temp > 25) rec = t('rec_warm');
            else if (temp > 15) rec = t('rec_nice');
            else if (temp > 10) rec = t('rec_cool');
            else if (temp > 0) rec = t('rec_cold');
            else rec = t('rec_freeze');
            document.getElementById('wRecommendation').textContent = rec;
        })
        .catch(function(e) {
            loading.style.display = 'none';
            error.style.display = 'block';
            error.textContent = '⚠️ ' + e.message;
        });
}

// ========== MAP (Leaflet) ==========
function initMap() {
    var lat = currentLocation.lat || -37.23;
    var lon = currentLocation.lon || -73.65;

    leafletMap = L.map('map').setView([lat, lon], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(leafletMap);

    if (currentLocation.lat) {
        L.marker([currentLocation.lat, currentLocation.lon])
            .addTo(leafletMap)
            .bindPopup('📍 ' + currentLocation.name)
            .openPopup();
    }

    // Earthquake markers
    fetch(CONFIG.USGS_URL)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            for (var i = 0; i < data.features.length; i++) {
                var f = data.features[i];
                var c = f.geometry.coordinates;
                var mag = f.properties.mag;
                var place = f.properties.place;
                var color = mag >= 7 ? '#F44336' : mag >= 5 ? '#FF9800' : '#FFC107';
                L.circleMarker([c[1], c[0]], {
                    radius: Math.max(mag * 2.5, 5),
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.6,
                    weight: 1
                }).addTo(leafletMap).bindPopup('<b>M' + mag.toFixed(1) + '</b><br>' + place);
            }
        })
        .catch(function() {});

    mapInitialized = true;
    setTimeout(function() { leafletMap.invalidateSize(); }, 300);
}

// ========== TIPS ==========
function loadTips() {
    var tips = [
        { title: '☀️ UV', desc: t('tip_uv'), cat: t('prevention'), color: '#FF9800' },
        { title: '🌊 Tsunami', desc: t('tip_tsunami'), cat: t('emergency'), color: '#F44336' },
        { title: '🔥 Incendio', desc: t('tip_fire'), cat: t('emergency'), color: '#F44336' },
        { title: '🌪️ Tormenta', desc: t('tip_storm'), cat: t('caution'), color: '#FFEB3B' },
        { title: '🌧️ Lluvias', desc: t('tip_rain'), cat: t('caution'), color: '#2196F3' },
        { title: '❄️ Frío', desc: t('tip_cold_wave'), cat: t('prevention'), color: '#03A9F4' },
        { title: '🌋 Volcán', desc: t('tip_volcano'), cat: t('emergency'), color: '#F44336' },
        { title: '🏜️ Sequía', desc: t('tip_drought'), cat: t('prevention'), color: '#795548' }
    ];

    var list = document.getElementById('tipsList');
    list.innerHTML = '';

    for (var i = 0; i < tips.length; i++) {
        var tip = tips[i];
        var card = document.createElement('div');
        card.className = 'tip-card';
        card.style.borderLeft = '4px solid ' + tip.color;
        card.innerHTML = '<span class="tip-category" style="color:' + tip.color + ';background:' + tip.color + '18">' + tip.cat + '</span>'
            + '<div class="tip-title">' + tip.title + '</div>'
            + '<div class="tip-desc">' + tip.desc + '</div>';
        list.appendChild(card);
    }
}
