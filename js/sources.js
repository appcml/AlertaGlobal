// ============================================
// js/sources.js — Fuentes oficiales globales v4
// CORS fix + USGS Chile direct + fallbacks
// ============================================

// CORS proxies — rotación con fallback real
var CORS_PROXIES = [
    'https://api.allorigins.win/get?url=',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://corsproxy.io/?'
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
                // allorigins returns JSON wrapper
                if (proxy.indexOf('allorigins') > -1) {
                    try {
                        var j = JSON.parse(text);
                        return j.contents || j.body || text;
                    } catch(e) { return text; }
                }
                // codetabs returns raw
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
                return makeAlert(
                    'USGS · Chile', 'SISMO', '🌍',
                    'M' + mag.toFixed(1) + ' — ' + place,
                    'Prof: ' + depth.toFixed(0) + ' km · ' + new Date(time).toLocaleString('es-CL', {hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}),
                    color, 'https://earthquake.usgs.gov/earthquakes/eventpage/' + f.id,
                    new Date(time).toISOString(), priority
                );
            });
        })
        .catch(function(e) { console.log('USGS Chile fetch error:', e.message); return []; });
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
                return makeAlert('USGS · Global', 'SISMO', '🌍',
                    'M' + mag.toFixed(1) + ' — ' + place,
                    'Prof: ' + depth.toFixed(0) + ' km',
                    color, '', new Date(time).toISOString(),
                    mag >= 7 ? 95 : mag >= 5 ? 75 : 55
                );
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
                return makeAlert('CSN · Chile', 'SISMO', '🌍', title, item.description || '',
                    mag >= 6 ? '#FF3B30' : mag >= 4 ? '#FF9500' : '#0A84FF',
                    item.link || 'https://www.sismologia.cl', item.pubDate,
                    mag >= 6 ? 90 : mag >= 4 ? 70 : 40
                );
            }).filter(function(a) { return a.title.length > 3; });
        })
        .catch(function(e) { console.log('CSN error:', e); return []; });
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
            return makeAlert('GDACS · ONU', type, icon, t, d, color, item.link, item.pubDate, priority);
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
    var icons = {'TSUNAMI':'🌊','TORNADO':'🌪️','CICLÓN':'🌀','TORMENTA':'🌀','SISMO':'🌍','VOLCÁN':'🌋','INCENDIO':'🔥','INUNDACIÓN':'🌊','NEVADA':'❄️','TORMENTA SOLAR':'🌞','ASTEROIDE':'☄️','ALERTA':'⚠️'};
    return icons[detectType(text)] || '⚠️';
}

// =============================================
// MASTER FETCH — Prioridad: APIs directas primero
// =============================================
function loadExternalSources(callback) {
    Promise.all([
        fetchUSGSChile(),      // DIRECTO — sin CORS
        fetchUSGSGlobal(),     // DIRECTO — sin CORS
        fetchCSN(),            // CORS proxy — puede fallar
        fetchGDACS(),          // CORS proxy
        fetchNHC(),            // CORS proxy
        fetchNASA(),           // DIRECTO
        fetchSpaceWeather()    // DIRECTO
    ]).then(function(results) {
        var all = [];
        results.forEach(function(arr) { all = all.concat(arr || []); });
        // Deduplicar
        var seen = {};
        all = all.filter(function(a) {
            var key = a.title.substring(0,35).toLowerCase().replace(/\s+/g,'');
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
        all.sort(function(a, b) {
            if (b.priority !== a.priority) return b.priority - a.priority;
            return (b.time||0) - (a.time||0);
        });
        if (callback) callback(all);
    }).catch(function() {
        if (callback) callback([]);
    });
}
