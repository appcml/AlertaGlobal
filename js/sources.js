// ============================================
// js/sources.js — Fuentes oficiales globales v4
// CORS fix + USGS Chile direct + fallbacks
// ============================================

// CORS proxies — rotación con fallback real
var CORS_PROXIES = [
    'https://api.allorigins.win/get?url=',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://corsproxy.io/?url='
];
var proxyIndex = 0;
var proxyFails = {};

function fetchCors(url, timeout) {
    timeout = timeout || 8000;
    var maxTries = CORS_PROXIES.length;

    function tryProxy(attempt) {
        if (attempt >= maxTries) return Promise.resolve('');
        var idx = (proxyIndex + attempt) % CORS_PROXIES.length;
        var proxy = CORS_PROXIES[idx];
        var fullUrl = proxy + encodeURIComponent(url);
        var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, timeout) : null;

        return fetch(fullUrl, ctrl ? { signal: ctrl.signal } : {})
            .then(function(r) {
                if (timer) clearTimeout(timer);
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function(text) {
                // allorigins y thingproxy devuelven JSON wrapper
                if (proxy.indexOf('allorigins') > -1) {
                    try { var j = JSON.parse(text); return j.contents || j.body || text; }
                    catch(e) { return text; }
                }

                return text;
            })
            .catch(function(e) {
                if (timer) clearTimeout(timer);
                proxyFails[idx] = (proxyFails[idx]||0) + 1;
                return tryProxy(attempt + 1);
            });
    }
    return tryProxy(0);
}

function parseRSS(xmlText) {
    try {
        var doc = new DOMParser().parseFromString(xmlText, 'text/xml');
        var items = doc.querySelectorAll('item, entry');
        var results = [];
        items.forEach(function(item) {
            var title = (item.querySelector('title') || {}).textContent || '';
            var desc  = (item.querySelector('description, summary') || {}).textContent || '';
            var link  = item.querySelector('link') ? (item.querySelector('link').getAttribute('href') || item.querySelector('link').textContent) : '';
            var pub   = (item.querySelector('pubDate, updated, published') || {}).textContent || '';
            results.push({ title: title.trim(), description: desc.replace(/<[^>]+>/g,'').trim().substring(0,300), link: link.trim(), pubDate: pub.trim() });
        });
        return results;
    } catch(e) { return []; }
}

function makeAlert(source, type, icon, title, description, color, link, pubDate, priority) {
    return {
        source: source, type: type, icon: icon,
        title: title, description: description,
        color: color, link: link || '',
        time: pubDate ? new Date(pubDate).getTime() : Date.now(),
        priority: priority || 50
    };
}

// =============================================
// 🌍 USGS — SISMOS CHILE DIRECTO (sin CORS proxy)
// USGS API soporta CORS nativo
// =============================================
function fetchUSGSChile() {
    // Chile region: lat -18 to -56, lon -75 to -66
    var now = new Date();
    var start = new Date(now.getTime() - 172800000).toISOString(); // últimas 48h
    var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=100'
        + '&minlatitude=-56&maxlatitude=-17&minlongitude=-76&maxlongitude=-65'
        + '&starttime=' + start + '&minmagnitude=2.0';

    return fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.features || !data.features.length) return [];
            return data.features.map(function(f) {
                var mag = f.properties.mag;
                var place = f.properties.place || '';
                var depth = f.geometry.coordinates[2];
                var time = f.properties.time;
                var color = mag >= 6 ? '#FF3B30' : mag >= 5 ? '#FF9500' : mag >= 4 ? '#FFC107' : '#0A84FF';
                var priority = mag >= 7 ? 99 : mag >= 6 ? 90 : mag >= 5 ? 80 : mag >= 4 ? 70 : 50;
                var alert = makeAlert(
                    'USGS · Chile', 'SISMO', '🌍',
                    'M' + mag.toFixed(1) + ' — ' + place,
                    'Prof: ' + depth.toFixed(0) + ' km · ' + new Date(time).toLocaleString('es-CL', {hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}),
                    color, 'https://earthquake.usgs.gov/earthquakes/eventpage/' + f.id,
                    new Date(time).toISOString(), priority
                );
                // attach coordinates + id for better dedup/filtering later
                alert.lat = f.geometry.coordinates[1];
                alert.lon = f.geometry.coordinates[0];
                alert.source_id = f.id;
                return alert;
            });
        })
        .catch(function(e) { console.log('USGS Chile fetch error:', e && e.message); return []; });
}

// USGS Global M4.5+ (también sin CORS, API directa)
function fetchUSGSGlobal() {
    return fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.features) return [];
            return data.features.slice(0, 20).map(function(f) {
                var mag = f.properties.mag, place = f.properties.place || '';
                var depth = f.geometry.coordinates[2], time = f.properties.time;
                var color = mag >= 7 ? '#FF3B30' : mag >= 5 ? '#FF9500' : '#FFC107';
                var a = makeAlert('USGS · Global', 'SISMO', '🌍',
                    'M' + mag.toFixed(1) + ' — ' + place,
                    'Prof: ' + depth.toFixed(0) + ' km',
                    color, '', new Date(time).toISOString(),
                    mag >= 7 ? 95 : mag >= 5 ? 75 : 55
                );
                a.lat = f.geometry.coordinates[1];
                a.lon = f.geometry.coordinates[0];
                a.source_id = f.id;
                return a;
            });
        })
        .catch(function() { return []; });
}

// 🇨🇱 CSN Chile — sismos locales (via CORS proxy)
function fetchCSN() {
    return fetchCors('https://www.sismologia.cl/rss/ultimos_sismos.xml', 10000)
        .then(function(xml) {
            if (!xml || xml.length < 50) return [];
            var items = parseRSS(xml);
            return items.slice(0, 25).map(function(item) {
                var title = item.title || '';
                var mag = 0;
                var magMatch = title.match(/[Mm]ag[nitud]*[:\s]+([0-9.]+)/);
                if (!magMatch) magMatch = title.match(/([0-9.]+)\s*ML/i);
                if (!magMatch) magMatch = title.match(/(\d+\.\d+)/);
                if (magMatch) mag = parseFloat(magMatch[1]);
                var a = makeAlert('CSN · Chile', 'SISMO', '🌍', title, item.description || '',
                    mag >= 6 ? '#FF3B30' : mag >= 4 ? '#FF9500' : '#0A84FF',
                    item.link || 'https://www.sismologia.cl', item.pubDate,
                    mag >= 6 ? 90 : mag >= 4 ? 70 : 40
                );
                // Try to parse coords from description if present (heuristic)
                var coordMatch = (item.description||'').match(/(-?\d+\.\d+)[^\d-]+(-?\d+\.\d+)/);
                if (coordMatch) { a.lat = parseFloat(coordMatch[1]); a.lon = parseFloat(coordMatch[2]); }
                return a;
            }).filter(function(a) { return a.title.length > 3; });
        })
        .catch(function(e) { console.log('CSN error:', e && e.message); return []; });
}

// 🇺🇸 NHC Huracanes
function fetchNHC() {
    return Promise.all([
        fetchCors('https://www.nhc.noaa.gov/index-at-sp.xml').then(function(xml) {
            return parseRSS(xml).slice(0,5).filter(function(i) { return i.title.length > 3; }).map(function(i) {
                var isMajor = /hurricane|huracán/i.test(i.title);
                return makeAlert('NHC NOAA', isMajor?'HURACÁN':'TORMENTA', '🌀', i.title, i.description, isMajor?'#FF3B30':'#7B1FA2', i.link, i.pubDate, isMajor?95:80);
            });
        }).catch(function() { return []; }),
        fetchCors('https://www.nhc.noaa.gov/index-ep-sp.xml').then(function(xml) {
            return parseRSS(xml).slice(0,5).filter(function(i) { return i.title.length > 3; }).map(function(i) {
                return makeAlert('NHC · Pacífico', 'TORMENTA', '🌀', i.title, i.description, '#7B1FA2', i.link, i.pubDate, 80);
            });
        }).catch(function() { return []; })
    ]).then(function(r) { return r[0].concat(r[1]); });
}

// 🌍 GDACS ONU
function fetchGDACS() {
    return fetchCors('https://www.gdacs.org/xml/rss.xml').then(function(xml) {
        return parseRSS(xml).slice(0,15).map(function(item) {
            var t=item.title, d=item.description;
            var type=detectType(t+d), icon=detectIcon(t+d);
            var color='#FF9800', priority=60;
            if(/tsunami/i.test(t+d))         { color='#FF2D55'; priority=99; }
            else if(/cyclone|hurricane/i.test(t+d)) { color='#7B1FA2'; priority=90; }
            else if(/earthquake/i.test(t+d)) { color='#FF3B30'; priority=80; }
            else if(/volcano/i.test(t+d))    { color='#FF6D00'; priority=85; }
            else if(/flood/i.test(t+d))      { color='#0A84FF'; priority=75; }
            else if(/wildfire|fire/i.test(t+d)) { color='#D84315'; priority=80; }
            if (!t || t.length<3) return null;
            var a = makeAlert('GDACS · ONU', type, icon, t, d, color, item.link, item.pubDate, priority);
            // try to extract coords from description if present (heuristic)
            var m = (item.description||'').match(/(-?\d+\.\d+)[^\d-]+(-?\d+\.\d+)/);
            if (m) { a.lat = parseFloat(m[1]); a.lon = parseFloat(m[2]); }
            return a;
        }).filter(Boolean);
    }).catch(function() { return []; });
}

// ☄️ NASA — Asteroides (API directa, sin CORS proxy)
function fetchNASA() {
    return fetch('https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.05&date-min=now&sort=dist&limit=3')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data || !data.data || !data.fields) return [];
            var fi=data.fields, di=fi.indexOf('des'), distI=fi.indexOf('dist'), dateI=fi.indexOf('cd'), vI=fi.indexOf('v_rel');
            return data.data.slice(0,3).map(function(obj) {
                var distKm = Math.round(parseFloat(obj[distI])*149597870.7);
                var isMoon = distKm < 384400;
                return makeAlert('NASA CNEOS', 'OBJETO CERCANO', '☄️',
                    'Asteroide '+obj[di]+' — '+distKm.toLocaleString()+' km',
                    'Aprox: '+obj[dateI]+' · '+parseFloat(obj[vI]).toFixed(1)+' km/s'+(isMoon?' (< Luna)':''),
                    isMoon?'#FF6D00':'#636366', 'https://cneos.jpl.nasa.gov/ca/', '', isMoon?70:20);
            });
        }).catch(function() { return []; });
}

// NOAA Space Weather (API directa)
function fetchSpaceWeather() {
    return fetch('https://services.swpc.noaa.gov/products/alerts.json')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!Array.isArray(data)) return [];
            return data.slice(0,5).filter(function(d) {
                return /warning|watch|kp/i.test(d.message||'');
            }).map(function(d) {
                var msg = (d.message||'').substring(0,200);
                var isKp = /kp [5-9]/i.test(msg);
                return makeAlert('NOAA · Clima Espacial', 'TORMENTA SOLAR', '🌞',
                    isKp?'Tormenta geomagnética':'Actividad solar',
                    msg, isKp?'#7B1FA2':'#636366',
                    'https://www.swpc.noaa.gov/', d.issue_time||'', isKp?75:40);
            });
        }).catch(function() { return []; });
}

// =============================================
// DETECCIÓN DE TIPO E ÍCONO
// =============================================
function detectType(text) {
    text = (text||'').toLowerCase();
    if(/tsunami/i.test(text)) return 'TSUNAMI';
    if(/tornado/i.test(text)) return 'TORNADO';
    if(/hurricane|huracán|ciclón|typhoon/i.test(text)) return 'CICLÓN';
    if(/tropical storm|tormenta tropical/i.test(text)) return 'TORMENTA';
    if(/earthquake|terremoto|sismo/i.test(text)) return 'SISMO';
    if(/volcano|volcán|eruption/i.test(text)) return 'VOLCÁN';
    if(/wildfire|incendio|fire/i.test(text)) return 'INCENDIO';
    if(/flood|inundac/i.test(text)) return 'INUNDACIÓN';
    if(/snow|nieve|blizzard/i.test(text)) return 'NEVADA';
    if(/solar|geomagnetic/i.test(text)) return 'TORMENTA SOLAR';
    if(/asteroid|asteroide|meteor/i.test(text)) return 'ASTEROIDE';
    return 'ALERTA';
}
function detectIcon(text) {
    var icons = {
        'TSUNAMI':'🌊',
        'TORNADO':'🌪️',
        'CICLÓN':'🌀',
        'TORMENTA':'🌀',
        'SISMO':'🌍',
        'VOLCÁN':'🌋',
        'INCENDIO':'🔥',
        'INUNDACIÓN':'🌊',
        'NEVADA':'❄️',
        'TORMENTA SOLAR':'🌞',
        'ASTEROIDE':'☄️',
        'ALERTA':'⚠️'
    };
    return icons[detectType(text)] || '⚠️';
}

// =============================================
// 🇨🇱 SENAPRED — Alertas oficiales Chile por región
// Cell Broadcast hook para APK nativo
// =============================================

// Mapa de regiones Chile → código numérico SENAPRED
var CHILE_REGIONES = {
    // Por nombre de ciudad/lugar → región
    'arica': 15, 'parinacota': 15,
    'iquique': 1, 'tarapaca': 1, 'alto hospicio': 1,
    'antofagasta': 2, 'calama': 2, 'tocopilla': 2,
    'atacama': 3, 'copiapo': 3, 'vallenar': 3,
    'coquimbo': 4, 'la serena': 4, 'ovalle': 4,
    'valparaiso': 5, 'viña del mar': 5, 'quilpue': 5, 'san antonio': 5,
    'metropolitana': 13, 'santiago': 13, 'providencia': 13, 'maipu': 13,
    "o'higgins": 6, 'rancagua': 6, 'san fernando': 6,
    'maule': 7, 'talca': 7, 'curico': 7, 'linares': 7, 'cauquenes': 7,
    'nuble': 16, 'chillan': 16, 'san carlos': 16,
    'biobio': 8, 'bio bio': 8, 'concepcion': 8, 'talcahuano': 8,
    'los angeles': 8, 'arauco': 8, 'canete': 8, 'cañete': 8,
    'lebu': 8, 'coronel': 8, 'lota': 8, 'tome': 8, 'tomé': 8,
    'araucania': 9, 'araucanía': 9, 'temuco': 9, 'angol': 9,
    'victoria': 9, 'nueva imperial': 9,
    'los rios': 14, 'los ríos': 14, 'valdivia': 14,
    'los lagos': 10, 'puerto montt': 10, 'osorno': 10, 'castro': 10,
    'aysen': 11, 'aysén': 11, 'coyhaique': 11,
    'magallanes': 12, 'punta arenas': 12
};

function getRegionFromLocation(loc) {
    if (!loc || !loc.name) return null;
    var name = (loc.name + ' ' + (loc.country || '')).toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, ''); // quitar tildes
    for (var key in CHILE_REGIONES) {
        if (name.indexOf(key) > -1) return CHILE_REGIONES[key];
    }
    return null;
}

// SENAPRED RSS — alertas nacionales + filtro regional
function fetchSENAPRED() {
    var urls = [
        'https://www.senapred.cl/rss/alertas',
        'https://senapred.cl/feed/alertas'
    ];

    function tryUrl(i) {
        if (i >= urls.length) return Promise.resolve([]);
        return fetchCors(urls[i], 10000)
            .then(function(xml) {
                if (!xml || xml.length < 100) return tryUrl(i + 1);
                var items = parseRSS(xml);
                if (!items.length) return tryUrl(i + 1);
                return items.slice(0, 20).map(function(item) {
                    var t = item.title || '';
                    var d = item.description || '';
                    var type = detectType(t + ' ' + d);
                    var icon = detectIcon(t + ' ' + d);
                    var color = '#FF3B30';
                    var priority = 80;
                    if (/tsunami/i.test(t + d))        { color = '#FF2D55'; priority = 99; }
                    else if (/rojo|red/i.test(t + d)) { color = '#FF3B30'; priority = 90; }
                    else if (/naranja|orange/i.test(t + d)) { color = '#FF9500'; priority = 75; }
                    else if (/amarillo|yellow/i.test(t + d)) { color = '#FFC107'; priority = 60; }
                    else if (/verde|green/i.test(t + d)) { color = '#00E676'; priority = 40; }
                    var a = makeAlert('SENAPRED · Chile', type, icon, t, d,
                        color, item.link || 'https://www.senapred.cl', item.pubDate, priority);
                    // Extraer región del texto si está disponible
                    var regMatch = (t + ' ' + d).match(/regi[oó]n\s+(?:del?\s+)?([A-Za-záéíóúñÁÉÍÓÚÑ\s]+)/i);
                    if (regMatch) a.region_text = regMatch[1].trim();
                    return a;
                }).filter(function(a) { return a.title && a.title.length > 3; });
            })
            .catch(function() { return tryUrl(i + 1); });
    }
    return tryUrl(0);
}

// CONAF — RSS no disponible públicamente (403/404)
// Se mantiene como stub para APK nativo vía scraping autorizado
function fetchCONAF() { return Promise.resolve([]); }

// SHOA — RSS no disponible públicamente (405)
// Para APK: usar API oficial con autenticación
function fetchSHOA() { return Promise.resolve([]); }

// USGS Chile Últimas 24h — Sismos M2.0+ en territorio chileno
// Reemplaza CSN y SHOA con datos directos y confiables
function fetchUSGSChile24h() {
    var now = new Date();
    var start = new Date(now.getTime() - 86400000).toISOString();
    var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson'
        + '&minlatitude=-56&maxlatitude=-17'
        + '&minlongitude=-76&maxlongitude=-65'
        + '&starttime=' + start
        + '&minmagnitude=2.0&orderby=time&limit=50';
    return fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.features) return [];
            return data.features.map(function(f) {
                var mag = f.properties.mag || 0;
                var place = f.properties.place || 'Chile';
                var depth = f.geometry.coordinates[2] || 0;
                var time = f.properties.time;
                var color = mag >= 6 ? '#FF3B30' : mag >= 5 ? '#FF9500' : mag >= 4 ? '#FFC107' : '#0A84FF';
                var priority = mag >= 7 ? 99 : mag >= 6 ? 90 : mag >= 5 ? 80 : mag >= 4 ? 70 : 45;
                var a = makeAlert('USGS · Chile', 'SISMO', '🌍',
                    'M' + mag.toFixed(1) + ' — ' + place,
                    'Profundidad: ' + depth.toFixed(0) + ' km',
                    color, 'https://earthquake.usgs.gov/earthquakes/eventpage/' + f.id,
                    new Date(time).toISOString(), priority);
                a.lat = f.geometry.coordinates[1];
                a.lon = f.geometry.coordinates[0];
                a.source_id = f.id;
                return a;
            });
        })
        .catch(function() { return []; });
}

// ── HOOK CELL BROADCAST para APK nativo ──
// Cuando se empaquete con Capacitor/Cordova, este hook
// recibe las alertas SAE directamente desde la red celular
// sin necesitar internet — igual que SENAPRED/SUBTEL
var CellBroadcastHook = {
    // En APK: registro del receiver en AndroidManifest.xml
    // <uses-permission android:name="android.permission.RECEIVE_EMERGENCY_BROADCAST"/>
    // <receiver android:name=".CellBroadcastReceiver">
    //   <intent-filter android:priority="999">
    //     <action android:name="android.provider.Telephony.SMS_CB_RECEIVED"/>
    //   </intent-filter>
    // </receiver>
    init: function() {
        if (window.CellBroadcast) {
            // Nativo: escuchar alertas SAE de SENAPRED/SUBTEL
            window.CellBroadcast.startListening(function(msg) {
                console.log('📡 Cell Broadcast SAE recibido:', msg);
                // Procesar y mostrar como alerta de máxima prioridad
                if (typeof sendNotification === 'function') {
                    sendNotification('🚨 ALERTA SAE', msg.body || msg.message, 'critical');
                }
            });
        } else {
            console.log('📡 Cell Broadcast: requiere APK nativo (Capacitor/Cordova)');
        }
    }
};


// ============================================================
// 🎯 ESCANEO POR COORDENADAS — El núcleo de la app
// Recibe lat/lon del usuario y consulta TODAS las fuentes
// con esas coordenadas exactas. Sin filtros manuales.
// ============================================================

function scanByCoords(lat, lon, radiusKm, callback) {
    if (!lat || !lon) { callback([]); return; }
    var radiusDeg = (radiusKm || 500) / 111; // 1 grado ≈ 111 km

    console.log('🔍 Escaneando por coords:', lat.toFixed(3), lon.toFixed(3), '±' + radiusKm + 'km');

    Promise.all([

        // ── SISMOS en radio del usuario (USGS — CORS nativo) ──
        fetch('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson'
            + '&latitude=' + lat + '&longitude=' + lon
            + '&maxradiuskm=' + (radiusKm || 500)
            + '&minmagnitude=1.5&orderby=time&limit=50'
            + '&starttime=' + new Date(Date.now() - 172800000).toISOString())
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.features) return [];
                return data.features.map(function(f) {
                    var mag = f.properties.mag || 0;
                    var place = f.properties.place || '';
                    var depth = f.geometry.coordinates[2] || 0;
                    var dist = calcDistKm(lat, lon,
                        f.geometry.coordinates[1], f.geometry.coordinates[0]);
                    var color = mag >= 6 ? '#FF3B30' : mag >= 5 ? '#FF9500' :
                                mag >= 4 ? '#FFC107' : '#0A84FF';
                    var priority = mag >= 7 ? 99 : mag >= 6 ? 90 : mag >= 5 ? 80 :
                                   mag >= 4 ? 70 : mag >= 3 ? 55 : 40;
                    var a = makeAlert('USGS', 'SISMO', '🌍',
                        'M' + mag.toFixed(1) + ' — ' + place,
                        'Prof: ' + depth.toFixed(0) + 'km · A ' + dist + ' km de ti',
                        color, 'https://earthquake.usgs.gov/earthquakes/eventpage/' + f.id,
                        new Date(f.properties.time).toISOString(), priority);
                    a.lat = f.geometry.coordinates[1];
                    a.lon = f.geometry.coordinates[0];
                    a.source_id = f.id;
                    a.distKm = dist;
                    return a;
                });
            })
            .catch(function(e) {
                console.log('USGS coords error:', e.message);
                return [];
            }),

        // ── CLIMA Y ALERTAS METEOROLÓGICAS (OpenWeather) ──
        fetch('https://api.openweathermap.org/data/2.5/onecall?lat=' + lat
            + '&lon=' + lon
            + '&appid=6fe6e0dcca264864dbd631bf620aad64'
            + '&exclude=minutely,hourly&units=metric&lang=es')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.alerts || !data.alerts.length) return [];
                return data.alerts.map(function(alert) {
                    var isExtreme = /extreme|rojo|red|emergenc/i.test(alert.event + alert.description);
                    return makeAlert(
                        'OpenWeather · ' + (alert.sender_name || 'SMN'),
                        detectType(alert.event),
                        detectIcon(alert.event),
                        alert.event || 'Alerta meteorológica',
                        (alert.description || '').substring(0, 200),
                        isExtreme ? '#FF3B30' : '#FF9500',
                        '', new Date(alert.start * 1000).toISOString(),
                        isExtreme ? 85 : 70
                    );
                });
            })
            .catch(function() { return []; }),

        // ── SISMOS CERCANOS EMSC (Europa + Global) ──
        fetch('https://www.seismicportal.eu/fdsnws/event/1/query'
            + '?lat=' + lat + '&lon=' + lon
            + '&maxradius=' + radiusDeg.toFixed(1)
            + '&minmag=3.0&format=json&limit=20&orderby=time')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.features) return [];
                return data.features.map(function(f) {
                    var p = f.properties;
                    var mag = p.mag || 0;
                    var dist = calcDistKm(lat, lon,
                        f.geometry.coordinates[1], f.geometry.coordinates[0]);
                    var a = makeAlert('EMSC', 'SISMO', '🌍',
                        'M' + mag.toFixed(1) + ' — ' + (p.flynn_region || p.auth || ''),
                        'Prof: ' + (p.depth || 0) + 'km · A ' + dist + ' km',
                        mag >= 6 ? '#FF3B30' : mag >= 5 ? '#FF9500' : '#FFC107',
                        'https://www.seismicportal.eu/eventdetails.html?id=' + p.unid,
                        p.time || '', mag >= 6 ? 88 : mag >= 5 ? 72 : 50);
                    a.lat = f.geometry.coordinates[1];
                    a.lon = f.geometry.coordinates[0];
                    a.distKm = dist;
                    return a;
                });
            })
            .catch(function() { return []; }),

        // ── GDACS por país/región (via proxy) ──
        fetchCors('https://www.gdacs.org/xml/rss.xml', 10000)
            .then(function(xml) {
                if (!xml || xml.length < 100) return [];
                return parseRSS(xml).slice(0, 20).map(function(item) {
                    var t = item.title || '', d = item.description || '';
                    var a = makeAlert('GDACS · ONU', detectType(t+d), detectIcon(t+d),
                        t, d.substring(0, 200),
                        /tsunami/i.test(t+d) ? '#FF2D55' :
                        /earthquake|sismo/i.test(t+d) ? '#FF3B30' :
                        /volcano/i.test(t+d) ? '#FF6D00' : '#FF9500',
                        item.link, item.pubDate,
                        /tsunami/i.test(t+d) ? 98 : /earthquake/i.test(t+d) ? 82 : 65);
                    // Intentar extraer coords del texto
                    var m = d.match(/(-?\d+\.?\d*)[°\s,]+([NS])[^\d]*(-?\d+\.?\d*)[°\s,]+([EW])/i);
                    if (m) {
                        a.lat = parseFloat(m[1]) * (m[2].toUpperCase()==='S' ? -1 : 1);
                        a.lon = parseFloat(m[3]) * (m[4].toUpperCase()==='W' ? -1 : 1);
                        a.distKm = calcDistKm(lat, lon, a.lat, a.lon);
                    }
                    return a;
                }).filter(Boolean);
            })
            .catch(function() { return []; }),

        // ── NHC Huracanes (via proxy) ──
        Promise.all([
            fetchCors('https://www.nhc.noaa.gov/index-at-sp.xml', 8000),
            fetchCors('https://www.nhc.noaa.gov/index-ep-sp.xml', 8000)
        ]).then(function(xmls) {
            var all = [];
            xmls.forEach(function(xml) {
                if (!xml || xml.length < 50) return;
                parseRSS(xml).slice(0,5).forEach(function(item) {
                    if (!item.title || item.title.length < 3) return;
                    var isMajor = /hurricane|hurac[aá]n/i.test(item.title);
                    all.push(makeAlert(
                        'NHC NOAA', isMajor ? 'HURACÁN' : 'TORMENTA', '🌀',
                        item.title, (item.description||'').substring(0,200),
                        isMajor ? '#FF3B30' : '#7B1FA2',
                        item.link, item.pubDate, isMajor ? 90 : 70));
                });
            });
            return all;
        }).catch(function() { return []; }),

        // ── NOAA Clima Espacial ──
        fetch('https://services.swpc.noaa.gov/products/alerts.json')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!Array.isArray(data)) return [];
                return data.slice(0,3).filter(function(d) {
                    return /warning|watch|kp [5-9]/i.test(d.message||'');
                }).map(function(d) {
                    var isKp = /kp [5-9]/i.test(d.message||'');
                    return makeAlert('NOAA · Clima Espacial', 'TORMENTA SOLAR', '🌞',
                        isKp ? 'Tormenta geomagnética' : 'Actividad solar',
                        (d.message||'').substring(0,200),
                        isKp ? '#7B1FA2' : '#636366',
                        'https://www.swpc.noaa.gov/', d.issue_time||'',
                        isKp ? 72 : 35);
                });
            })
            .catch(function() { return []; })

    ]).then(function(results) {
        var all = [];
        results.forEach(function(arr) { all = all.concat(arr || []); });

        // Deduplicar
        var seen = {};
        all = all.filter(function(a) {
            var key = a.source_id || (a.title||'').substring(0,50);
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });

        // Ordenar: más cercano y más urgente primero
        all.sort(function(a, b) {
            // Distancia al usuario (si disponible)
            var dA = a.distKm != null ? a.distKm : 99999;
            var dB = b.distKm != null ? b.distKm : 99999;
            // Score combinado: prioridad + proximidad
            var scoreA = a.priority - (dA / 100);
            var scoreB = b.priority - (dB / 100);
            return scoreB - scoreA;
        });

        console.log('🔍 Escaneo completado:', all.length, 'eventos encontrados');
        callback(all);
    }).catch(function(err) {
        console.log('scanByCoords error:', err);
        callback([]);
    });
}

// Helper: distancia en km entre dos coordenadas
function calcDistKm(lat1, lon1, lat2, lon2) {
    if (!lat2 || !lon2) return 99999;
    var R = 6371;
    var dLat = (lat2-lat1) * Math.PI/180;
    var dLon = (lon2-lon1) * Math.PI/180;
    var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
            Math.sin(dLon/2)*Math.sin(dLon/2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// =============================================
// MASTER FETCH — Prioridad: APIs directas primero
// =============================================
function loadExternalSources(callback) {
    Promise.all([
        fetchUSGSChile(),      // USGS Chile M1.5+ últimas 48h
        fetchUSGSChile24h(),   // USGS Chile M2.0+ últimas 24h (más reciente)
        fetchUSGSGlobal(),     // USGS Global M4.5+
        fetchSENAPRED(),       // SENAPRED alertas oficiales (cuando disponible)
        fetchGDACS(),          // GDACS ONU — alertas globales
        fetchNHC(),            // NHC NOAA — huracanes
        fetchSpaceWeather()    // NOAA clima espacial
    ]).then(function(results) {
        var all = [];
        results.forEach(function(arr) { all = all.concat(arr || []); });

        // Deduplicar con fingerprint: rounded coords + time window + normalized title
        var seen = {};
        all = all.filter(function(a) {
            var lat = a.lat, lon = a.lon, t = a.time || Date.now();
            var titleKey = (a.title || '').toString().substring(0,60).toLowerCase().replace(/\s+/g,'');
            var coordKey = (lat && lon) ? (Math.round(lat*1000)+'_'+Math.round(lon*1000)) : '';
            // time window of 10 minutes (600000 ms)
            var timeKey = '' + Math.floor((t || Date.now()) / 600000);
            var key = coordKey ? (coordKey + '|' + timeKey) : titleKey;
            // fallback combine with title
            if (!seen[key]) {
                // if coordKey exists, also mark nearby title-based keys to avoid similar duplicates
                seen[key] = true;
                if (coordKey) seen[titleKey] = true;
                return true;
            }
            return false;
        });

        all.sort(function(a, b) {
            if (b.priority !== a.priority) return b.priority - a.priority;
            return (b.time||0) - (a.time||0);
        });
        if (callback) callback(all);
    }).catch(function(err) {
        console.log('loadExternalSources error', err && err.message);
        if (callback) callback([]);
    });
}
