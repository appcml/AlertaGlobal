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

// ============================================================
// 🌐 TRADUCCIÓN AUTOMÁTICA DE ALERTAS AL IDIOMA DEL USUARIO
// ============================================================
function translateAlert(text, targetLang) {
    if (!text) return text;
    // Detect non-latin scripts (Russian, Japanese, Arabic, Chinese, etc.)
    // and use WeatherAPI common terms mapping
    var hasCyrillic = /[\u0400-\u04FF]/.test(text);
    var hasArabic   = /[\u0600-\u06FF]/.test(text);
    var hasCJK      = /[\u3040-\u9FFF]/.test(text);
    if (hasCyrillic || hasArabic || hasCJK) {
        // Can't translate Cyrillic/CJK word by word
        // Return a generic description based on known patterns
        if (/температур|темп/i.test(text))    return '🌡️ Alerta de temperatura';
        if (/осадк|дождь|снег/i.test(text))   return '🌧️ Alerta de precipitaciones';
        if (/ветер|шторм/i.test(text))         return '💨 Alerta de viento/tormenta';
        if (/жара|тепло/i.test(text))          return '🥵 Alerta de calor';
        if (/мороз|холод/i.test(text))         return '🥶 Alerta de frío';
        if (/наводнен|затоплен/i.test(text))   return '🌊 Alerta de inundación';
        if (/пожар/i.test(text))               return '🔥 Alerta de incendio';
        if (/землетряс/i.test(text))           return '🌍 Alerta sísmica';
        // Generic fallback for unknown Cyrillic
        if (hasCyrillic) return '⚠️ Alerta meteorológica activa';
        if (hasCJK)      return '⚠️ Alerta activa';
        if (hasArabic)   return '⚠️ تنبيه نشط';
    }
    if (targetLang === 'en') return text;
    var t = text;

    // Tipos de eventos
    var translations = {
        'es': {
            'earthquake': 'Terremoto', 'Earthquake': 'Terremoto',
            'tsunami': 'Tsunami', 'Tsunami': 'Tsunami',
            'tropical storm': 'Tormenta tropical', 'Tropical Storm': 'Tormenta tropical',
            'hurricane': 'Huracán', 'Hurricane': 'Huracán',
            'typhoon': 'Tifón', 'Typhoon': 'Tifón',
            'cyclone': 'Ciclón', 'Cyclone': 'Ciclón',
            'flood': 'Inundación', 'Flood': 'Inundación',
            'wildfire': 'Incendio forestal', 'Wildfire': 'Incendio forestal',
            'volcano': 'Volcán', 'Volcano': 'Volcán',
            'eruption': 'Erupción', 'Eruption': 'Erupción',
            'landslide': 'Deslizamiento', 'Landslide': 'Deslizamiento',
            'drought': 'Sequía', 'Drought': 'Sequía',
            'magnitude': 'Magnitud', 'Magnitude': 'Magnitud',
            'depth': 'Profundidad', 'Depth': 'Profundidad',
            'warning': 'Aviso', 'Warning': 'Aviso', 'WARNING': 'AVISO',
            'watch': 'Vigilancia', 'Watch': 'Vigilancia', 'WATCH': 'VIGILANCIA',
            'advisory': 'Alerta', 'Advisory': 'Alerta',
            'alert': 'Alerta', 'Alert': 'Alerta',
            'green': 'verde', 'Green': 'Verde',
            'orange': 'naranja', 'Orange': 'Naranja',
            'red': 'rojo', 'Red': 'Rojo',
            'population affected': 'población afectada',
            'Population affected': 'Población afectada',
            'wind speed': 'velocidad del viento',
            'Wind speed': 'Velocidad del viento',
            'category': 'categoría', 'Category': 'Categoría',
            'offshore': 'costa afuera', 'Offshore': 'Costa afuera',
            'potentially affecting': 'potencialmente afectando',
            'occurred in': 'ocurrió en',
            'an earthquake occurred': 'ocurrió un terremoto',
            'was active in': 'estuvo activo en',
            'affects these countries': 'afecta estos países',
            'ash cloud': 'nube de ceniza', 'Ash cloud': 'Nube de ceniza',
            'aviation alert': 'alerta de aviación',
            'emitting': 'emitiendo',
            'ongoing': 'en curso', 'Ongoing': 'En curso',
            'geomagnetic storm': 'tormenta geomagnética',
            'Geomagnetic Storm': 'Tormenta geomagnética',
            'solar radiation': 'radiación solar',
            'moderate': 'moderado', 'Moderate': 'Moderado',
            'minor': 'menor', 'Minor': 'Menor',
            'severe': 'severo', 'Severe': 'Severo',
            'extreme': 'extremo', 'Extreme': 'Extremo',
            'immediate': 'inmediato', 'Immediate': 'Inmediato',
            'expected': 'esperado', 'Expected': 'Esperado',
            'predicted': 'predicho', 'Predicted': 'Predicho',
            'level': 'nivel', 'Level': 'Nivel',
            'storm': 'tormenta', 'Storm': 'Tormenta',
            'precipitation': 'precipitaciones', 'Precipitation': 'Precipitaciones',
            'rainfall': 'lluvia', 'Rainfall': 'Lluvia',
            'wind': 'viento', 'Wind': 'Viento',
            'snow': 'nieve', 'Snow': 'Nieve',
            'ice': 'hielo', 'Ice': 'Hielo',
            'fog': 'niebla', 'Fog': 'Niebla',
            'heat': 'calor', 'Heat': 'Calor',
            'cold': 'frío', 'Cold': 'Frío',
            'fire': 'incendio', 'Fire': 'Incendio',
            'ash': 'ceniza', 'Ash': 'Ceniza',
            'active': 'activo', 'Active': 'Activo',
            'north': 'norte', 'North': 'Norte',
            'south': 'sur', 'South': 'Sur',
            'east': 'este', 'East': 'Este',
            'west': 'oeste', 'West': 'Oeste',
            'sea': 'mar', 'Sea': 'Mar',
            'ocean': 'océano', 'Ocean': 'Océano',
            'coast': 'costa', 'Coast': 'Costa',
            'island': 'isla', 'Island': 'Isla',
            'km': 'km', 'miles': 'millas',
            'unknown': 'desconocido'
        }
    };

    var dict = translations[targetLang] || translations['es'];
    Object.keys(dict).forEach(function(eng) {
        var esp = dict[eng];
        // Replace whole words only
        t = t.split(eng).join(esp);
    });
    return t;
}

function getLang() {
    try { return localStorage.getItem('ag_lang') || 'es'; } catch(e) { return 'es'; }
}


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

// 🌍 GDACS ONU — con extracción de coordenadas del XML nativo
function fetchGDACS() {
    return fetchCors('https://www.gdacs.org/xml/rss.xml').then(function(xml) {
        if (!xml || xml.length < 100) return [];
        // Parsear XML completo para acceder a campos geo: y gdacs:
        var parser = new DOMParser();
        var doc = parser.parseFromString(xml, 'text/xml');
        var items = doc.querySelectorAll('item');
        var results = [];
        items.forEach(function(item) {
            var t = (item.querySelector('title') || {}).textContent || '';
            var d = (item.querySelector('description') || {}).textContent || '';
            var link = (item.querySelector('link') || {}).textContent || '';
            var pubDate = (item.querySelector('pubDate') || {}).textContent || '';
            if (!t || t.length < 3) return;

            // Extraer coordenadas de geo:point o georss:point o gdacs campos
            var lat = null, lon = null;
            var geoPoint = item.querySelector('point') ||
                           item.getElementsByTagNameNS('*','point')[0];
            if (geoPoint && geoPoint.textContent) {
                var pts = geoPoint.textContent.trim().split(/\s+/);
                if (pts.length >= 2) { lat = parseFloat(pts[0]); lon = parseFloat(pts[1]); }
            }
            // Fallback: buscar lat/lon en atributos o texto
            if (!lat) {
                var latEl = item.getElementsByTagNameNS('*','lat')[0];
                var lonEl = item.getElementsByTagNameNS('*','long')[0] ||
                            item.getElementsByTagNameNS('*','lon')[0];
                if (latEl && lonEl) {
                    lat = parseFloat(latEl.textContent);
                    lon = parseFloat(lonEl.textContent);
                }
            }
            // Fallback regex en descripción
            if (!lat) {
                var mLat = d.match(/lat[itude]*[:\s]+(-?\d+\.?\d*)/i);
                var mLon = d.match(/lon[gitude]*[:\s]+(-?\d+\.?\d*)/i);
                if (mLat && mLon) { lat = parseFloat(mLat[1]); lon = parseFloat(mLon[1]); }
            }

            var td = t + ' ' + d;
            var type = detectType(td), icon = detectIcon(td);
            var color = '#FF9800', priority = 60;
            if (/tsunami/i.test(td))              { color='#FF2D55'; priority=99; }
            else if (/cyclone|hurricane/i.test(td)) { color='#7B1FA2'; priority=90; }
            else if (/volcano/i.test(td))         { color='#FF6D00'; priority=85; }
            else if (/earthquake/i.test(td))      { color='#FF3B30'; priority=80; }
            else if (/wildfire|fire/i.test(td))   { color='#D84315'; priority=80; }
            else if (/flood/i.test(td))           { color='#0A84FF'; priority=75; }

            // Nivel de alerta GDACS
            if (/red alert/i.test(td))    priority = Math.max(priority, 90);
            if (/orange alert/i.test(td)) priority = Math.max(priority, 75);

            var lang = getLang();
            t = translateAlert(t, lang);
            d = translateAlert(d.replace(/<[^>]+>/g,''), lang);
            var a = makeAlert('GDACS · ONU', type, icon, t, d.substring(0,300),
                color, link, pubDate, priority);
            if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
                a.lat = lat; a.lon = lon;
            }
            results.push(a);
        });
        return results.slice(0, 20);
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
// 🔥 NASA FIRMS — Incendios activos por satélite en tiempo real
// MODIS + VIIRS — cobertura global, actualización cada 3 horas
// API gratuita sin key para acceso básico
// ============================================================
function fetchNASAFIRMS(lat, lon, radiusKm) {
    // FIRMS World Fire Map — área de búsqueda basada en coords usuario
    var dayRange = 2; // últimas 48h
    var mapKey = 'FIRMS_MODIS_C6_1'; // MODIS Collection 6
    
    // Calcular bounding box
    var degRadius = (radiusKm || 500) / 111;
    var minLat = (lat - degRadius).toFixed(3);
    var maxLat = (lat + degRadius).toFixed(3);
    var minLon = (lon - degRadius).toFixed(3);
    var maxLon = (lon + degRadius).toFixed(3);
    
    // NASA FIRMS CSV API — gratuita sin key para área pequeña
    var url = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv/'
        + 'FIRMS_MODIS_C6_1/World/' + dayRange
        + '?bbox=' + minLon + ',' + minLat + ',' + maxLon + ',' + maxLat;
    
    return fetch(url)
        .then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        })
        .then(function(csv) {
            if (!csv || csv.length < 50) return [];
            var lines = csv.trim().split('\n');
            if (lines.length < 2) return [];
            var headers = lines[0].split(',');
            var latIdx = headers.indexOf('latitude');
            var lonIdx = headers.indexOf('longitude');
            var confIdx = headers.indexOf('confidence');
            var brightIdx = headers.indexOf('bright_t31') > -1 ? 
                headers.indexOf('bright_t31') : headers.indexOf('brightness');
            var dateIdx = headers.indexOf('acq_date');
            var timeIdx = headers.indexOf('acq_time');
            
            // Agrupar puntos cercanos en un solo evento
            var clusters = [];
            lines.slice(1).forEach(function(line) {
                if (!line.trim()) return;
                var cols = line.split(',');
                var fLat = parseFloat(cols[latIdx]);
                var fLon = parseFloat(cols[lonIdx]);
                var conf = cols[confIdx] || 'n';
                var bright = parseFloat(cols[brightIdx]) || 0;
                var date = cols[dateIdx] || '';
                var time = cols[timeIdx] || '';
                if (isNaN(fLat) || isNaN(fLon)) return;
                // Solo confianza nominal o alta
                if (conf === 'l' || conf === '0') return;
                // Buscar cluster cercano (dentro de 50km)
                var merged = false;
                for (var i = 0; i < clusters.length; i++) {
                    if (calcDistKm(fLat, fLon, clusters[i].lat, clusters[i].lon) < 50) {
                        clusters[i].count++;
                        clusters[i].maxBright = Math.max(clusters[i].maxBright, bright);
                        merged = true; break;
                    }
                }
                if (!merged) clusters.push({ lat: fLat, lon: fLon, count: 1,
                    maxBright: bright, date: date, time: time });
            });
            
            return clusters.slice(0, 10).map(function(c) {
                var dist = calcDistKm(lat, lon, c.lat, c.lon);
                var isLarge = c.count > 10;
                var isIntense = c.maxBright > 340;
                var priority = isLarge && isIntense ? 85 : isLarge ? 75 : isIntense ? 70 : 60;
                var title = isLarge ? 
                    'Incendio forestal activo — ' + c.count + ' focos detectados' :
                    'Foco de incendio detectado por satélite';
                var dateStr = c.date + (c.time ? ' ' + c.time.substring(0,2)+':'+c.time.substring(2) + ' UTC' : '');
                var a = makeAlert(
                    'NASA FIRMS · MODIS', 'INCENDIO', '🔥',
                    title,
                    'Temperatura radiativa: ' + c.maxBright.toFixed(0) + 'K · ' +
                    c.count + ' píxeles · A ' + dist + ' km · ' + dateStr,
                    isLarge ? '#FF3B30' : '#D84315',
                    'https://firms.modaps.eosdis.nasa.gov/map/',
                    c.date || new Date().toISOString(),
                    priority
                );
                a.lat = c.lat; a.lon = c.lon; a.distKm = dist;
                return a;
            });
        })
        .catch(function(e) {
            console.log('NASA FIRMS error:', e.message);
            return [];
        });
}

// ============================================================
// 🌋 GeoNet NZ — Sismos y volcanes Nueva Zelanda + Pacífico Sur
// Uno de los mejores sistemas sísmicos del mundo
// API GeoJSON con CORS nativo
// ============================================================
function fetchGeoNet(lat, lon, radiusKm) {
    var url = 'https://api.geonet.org.nz/quake?MMI=3';
    
    return fetch(url, {
        headers: { 'Accept': 'application/vnd.geo+json' }
    })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.features) return [];
            return data.features.filter(function(f) {
                var fLat = f.geometry.coordinates[1];
                var fLon = f.geometry.coordinates[0];
                return calcDistKm(lat, lon, fLat, fLon) <= (radiusKm || 500);
            }).slice(0, 10).map(function(f) {
                var p = f.properties || {};
                var mag = p.magnitude || 0;
                var depth = p.depth || 0;
                var fLat = f.geometry.coordinates[1];
                var fLon = f.geometry.coordinates[0];
                var dist = calcDistKm(lat, lon, fLat, fLon);
                var color = mag >= 6 ? '#FF3B30' : mag >= 5 ? '#FF9500' :
                            mag >= 4 ? '#FFC107' : '#64B5F6';
                var priority = mag >= 6 ? 88 : mag >= 5 ? 75 : mag >= 4 ? 60 : 40;
                var a = makeAlert(
                    'GeoNet · Nueva Zelanda', 'SISMO', '🌍',
                    'M' + mag.toFixed(1) + ' — ' + (p.locality || 'Nueva Zelanda'),
                    'Prof: ' + depth.toFixed(0) + 'km · A ' + dist + ' km',
                    color,
                    'https://www.geonet.org.nz/earthquake/' + p.publicID,
                    p.time || '',
                    priority
                );
                a.lat = fLat; a.lon = fLon; a.distKm = dist;
                return a;
            });
        })
        .catch(function() { return []; });
}

// ============================================================
// 🌋 Smithsonian GVP — Volcanes activos globales
// Global Volcanism Program — actualización semanal
// ============================================================
function fetchSmithsonianVolcano() {
    return fetchCors('https://volcano.si.edu/news/WeeklyVolcanicActivityReport_Feed.xml', 10000)
        .then(function(xml) {
            if (!xml || xml.length < 100) return [];
            var items = parseRSS(xml);
            return items.slice(0, 10).map(function(item) {
                var t = translateAlert(item.title || '', getLang());
                var d = translateAlert((item.description || '').replace(/<[^>]+>/g,'').substring(0,300), getLang());
                var isEruption = /erupc|eruption|lava|explosion|ash/i.test(t + d);
                return makeAlert(
                    'Smithsonian GVP', 'VOLCÁN', '🌋',
                    t || 'Actividad volcánica reportada',
                    d,
                    isEruption ? '#FF6D00' : '#FF9500',
                    item.link || 'https://volcano.si.edu',
                    item.pubDate, isEruption ? 80 : 65
                );
            }).filter(function(a) { return a.title && a.title.length > 3; });
        })
        .catch(function() { return []; });
}


// ============================================================
// 💨 OpenAQ — Calidad del aire en tiempo real
// Red global de sensores, CORS nativo, sin key
// AQI > 150 = Insalubre, > 200 = Muy insalubre, > 300 = Peligroso
// ============================================================
function fetchAirQuality(lat, lon) {
    // OpenAQ v3 API — sensores cercanos al usuario
    var url = 'https://api.openaq.org/v3/locations?coordinates='
        + lat + ',' + lon + '&radius=100000&limit=5&order_by=distance';
    
    return fetch(url, { headers: { 'X-API-Key': '' } })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.results || !data.results.length) return [];
            var alerts = [];
            data.results.forEach(function(loc) {
                if (!loc.parameters) return;
                loc.parameters.forEach(function(param) {
                    if (param.parameter !== 'pm25' && param.parameter !== 'pm10' &&
                        param.parameter !== 'o3' && param.parameter !== 'no2') return;
                    var val = param.lastValue || 0;
                    var unit = param.unit || 'µg/m³';
                    // Calcular AQI básico para PM2.5
                    var aqi = param.parameter === 'pm25' ? Math.round(val * 4) : 
                              param.parameter === 'pm10' ? Math.round(val * 2) : 0;
                    if (aqi < 100) return; // Solo alertar si es insalubre
                    var level = aqi >= 300 ? 'PELIGROSO' : aqi >= 200 ? 'Muy insalubre' :
                                aqi >= 150 ? 'Insalubre' : 'Insalubre para grupos sensibles';
                    var color = aqi >= 300 ? '#7B1FA2' : aqi >= 200 ? '#FF3B30' :
                                aqi >= 150 ? '#FF9500' : '#FFC107';
                    var priority = aqi >= 300 ? 85 : aqi >= 200 ? 75 : aqi >= 150 ? 60 : 45;
                    var dist = loc.distance ? Math.round(loc.distance/1000) : null;
                    alerts.push(makeAlert(
                        'OpenAQ · ' + (loc.country || ''),
                        'CALIDAD DEL AIRE', '💨',
                        'Calidad del aire: ' + level,
                        param.parameter.toUpperCase() + ': ' + val.toFixed(1) + ' ' + unit +
                        ' · AQI ~' + aqi + (dist ? ' · A ' + dist + ' km' : '') +
                        ' · Estación: ' + (loc.name || ''),
                        color,
                        'https://openaq.org',
                        param.lastUpdated || new Date().toISOString(),
                        priority
                    ));
                    if (dist != null) {
                        alerts[alerts.length-1].lat = loc.coordinates && loc.coordinates.latitude;
                        alerts[alerts.length-1].lon = loc.coordinates && loc.coordinates.longitude;
                        alerts[alerts.length-1].distKm = dist;
                    }
                });
            });
            return alerts;
        })
        .catch(function(e) {
            console.log('OpenAQ error:', e.message);
            return [];
        });
}

// ============================================================
// 🌊 NOAA Tides — Marejadas y alertas costeras
// Solo para zonas costeras — radio < 200km de costa
// ============================================================
function fetchNOAATides(lat, lon) {
    // NOAA CO-OPS API — alertas de nivel del mar
    var url = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'
        + '?date=today&range=24&product=predictions&datum=MLLW'
        + '&time_zone=gmt&interval=h&units=metric&application=alertaglobal&format=json'
        + '&lat=' + lat + '&lon=' + lon;
    
    // Usar estaciones cercanas via metadata
    var stationsUrl = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json'
        + '?type=tidepredictions&units=metric';
    
    return fetch(stationsUrl)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.stations) return [];
            // Encontrar estación más cercana
            var nearest = null, minDist = 999999;
            (data.stations || []).forEach(function(st) {
                var d = calcDistKm(lat, lon, parseFloat(st.lat), parseFloat(st.lng));
                if (d < minDist) { minDist = d; nearest = st; }
            });
            if (!nearest || minDist > 300) return []; // Solo si estación < 300km
            // Fetch predicciones de la estación
            return fetch('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'
                + '?date=today&range=24&product=water_level&datum=MLLW'
                + '&time_zone=gmt&units=metric&application=alertaglobal&format=json'
                + '&station=' + nearest.id)
                .then(function(r) { return r.json(); })
                .then(function(tideData) {
                    if (!tideData.data) return [];
                    // Detectar niveles anormalmente altos
                    var maxLevel = Math.max.apply(null, tideData.data.map(function(d) {
                        return parseFloat(d.v) || 0;
                    }));
                    if (maxLevel < 2) return []; // Solo alertar si nivel > 2m sobre MLLW
                    return [makeAlert(
                        'NOAA Tides', 'MAREJADA', '🌊',
                        'Nivel del mar elevado — ' + maxLevel.toFixed(2) + 'm',
                        'Estación: ' + nearest.name + ' · A ' + Math.round(minDist) + ' km · Máximo últimas 24h',
                        maxLevel > 3 ? '#FF3B30' : '#FF9500',
                        'https://tidesandcurrents.noaa.gov/waterlevels.html?id=' + nearest.id,
                        new Date().toISOString(),
                        maxLevel > 3 ? 80 : 65
                    )];
                });
        })
        .catch(function() { return []; });
}

// ============================================================
// 🏜️ NOAA Drought Monitor — Sequías
// Actualización semanal, cubre América
// ============================================================
function fetchDrought(lat, lon) {
    // NOAA/USDA Drought Monitor RSS
    return fetchCors('https://droughtmonitor.unl.edu/DmData/GISData.aspx?mode=table&aoi=state', 8000)
        .then(function(xml) {
            if (!xml || xml.length < 100) return [];
            var items = parseRSS(xml);
            return items.slice(0,3).map(function(item) {
                var t = translateAlert(item.title || '', getLang());
                var d = translateAlert((item.description || '').substring(0,200), getLang());
                return makeAlert(
                    'NOAA Drought Monitor', 'SEQUÍA', '🏜️',
                    t || 'Alerta de sequía activa',
                    d, '#FF9500',
                    item.link || 'https://droughtmonitor.unl.edu',
                    item.pubDate, 55
                );
            }).filter(function(a) { return a.title.length > 3; });
        })
        .catch(function() { return []; });
}

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
            + '&minmagnitude=1.0&orderby=time&limit=100'
            + '&starttime=' + new Date(Date.now() - 259200000).toISOString()) // 72h
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.features) return [];
                return data.features.map(function(f) {
                    var mag = f.properties.mag || 0;
                    var place = f.properties.place || '';
                    var depth = f.geometry.coordinates[2] || 0;
                    var dist = calcDistKm(lat, lon,
                        f.geometry.coordinates[1], f.geometry.coordinates[0]);
                    // Escala de riesgo sísmico:
                    // M1-2: Micro — solo instrumentos
                    // M2-3: Menor — raramente sentido
                    // M3-4: Leve — sentido pero sin daños
                    // M4-5: Moderado — daños leves posibles
                    // M5-6: Moderado-Fuerte — daños menores a edificios
                    // M6-7: Fuerte — daños serios
                    // M7+:  Mayor/Gran — daños extensos, tsunami posible
                    var color = mag >= 7 ? '#FF2D55' : mag >= 6 ? '#FF3B30' :
                                mag >= 5 ? '#FF9500' : mag >= 4 ? '#FFC107' :
                                mag >= 3 ? '#64B5F6' : '#636366';
                    var priority = mag >= 7 ? 99 : mag >= 6 ? 92 : mag >= 5 ? 82 :
                                   mag >= 4 ? 68 : mag >= 3 ? 45 : mag >= 2 ? 25 : 10;
                    var lang = getLang();
                    place = translateAlert(place, lang);
                    var riskLabel = mag >= 7 ? '🔴 PELIGROSO' :
                                    mag >= 6 ? '🟠 Fuerte' :
                                    mag >= 5 ? '🟡 Moderado-Fuerte' :
                                    mag >= 4 ? '🟡 Moderado' :
                                    mag >= 3 ? '🔵 Leve' : '⚫ Micro';
                    var a = makeAlert('USGS', 'SISMO', '🌍',
                        'M' + mag.toFixed(1) + ' — ' + place,
                        riskLabel + ' · Prof: ' + depth.toFixed(0) + 'km · A ' + dist + ' km de ti',
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

        // ── ALERTAS METEOROLÓGICAS (Open-Meteo — gratis, sin key) ──
        // Detecta condiciones extremas por código meteorológico WMO
        fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat
            + '&longitude=' + lon
            + '&daily=weathercode,precipitation_sum,windspeed_10m_max'
            + '&current_weather=true&timezone=auto&forecast_days=2')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var alerts = [];
                var cw = data.current_weather || {};
                var code = cw.weathercode || 0;
                var wind = cw.windspeed || 0;
                // Códigos WMO de riesgo: https://open-meteo.com/en/docs
                // 95-99: tormenta eléctrica, 71-77: nevada, 85-86: nieve intensa
                if (code >= 95) {
                    alerts.push(makeAlert('Open-Meteo', 'TORMENTA', '⛈️',
                        code >= 99 ? 'Tormenta eléctrica con granizo' : 'Tormenta eléctrica',
                        'Condición actual en tu ubicación',
                        code >= 99 ? '#FF3B30' : '#FF9500',
                        'https://open-meteo.com', new Date().toISOString(),
                        code >= 99 ? 80 : 65));
                } else if (code >= 71 && code <= 77) {
                    alerts.push(makeAlert('Open-Meteo', 'NEVADA', '❄️',
                        'Nevada activa en tu zona',
                        'Windspeed: ' + wind + ' km/h',
                        '#64B5F6', 'https://open-meteo.com',
                        new Date().toISOString(), 60));
                }
                if (wind >= 60) {
                    alerts.push(makeAlert('Open-Meteo', 'VIENTO FUERTE', '💨',
                        'Vientos de ' + wind + ' km/h',
                        'Velocidad actual del viento en tu ubicación',
                        wind >= 90 ? '#FF3B30' : '#FF9500',
                        'https://open-meteo.com', new Date().toISOString(),
                        wind >= 90 ? 75 : 55));
                }
                // Revisar pronóstico próximas 48h
                var daily = data.daily || {};
                if (daily.weathercode) {
                    daily.weathercode.forEach(function(wc, i) {
                        if (wc >= 95) {
                            var precip = daily.precipitation_sum ? daily.precipitation_sum[i] : 0;
                            alerts.push(makeAlert('Open-Meteo', 'TORMENTA', '⛈️',
                                'Tormenta eléctrica prevista para ' + (i === 0 ? 'hoy' : 'mañana'),
                                'Precipitación estimada: ' + (precip||0).toFixed(1) + 'mm',
                                '#FF9500', 'https://open-meteo.com',
                                new Date().toISOString(), 58));
                        }
                    });
                }
                return alerts;
            })
            .catch(function() { return []; }),

        // ── SISMOS CERCANOS EMSC (Europa + Global) ──
        fetch('https://www.seismicportal.eu/fdsnws/event/1/query'
            + '?lat=' + lat + '&lon=' + lon
            + '&maxradius=' + radiusDeg.toFixed(1)
            + '&minmag=1.0&format=json&limit=20&orderby=time')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.features) return [];
                return data.features.map(function(f) {
                    var p = f.properties;
                    var mag = p.mag || 0;
                    var dist = calcDistKm(lat, lon,
                        f.geometry.coordinates[1], f.geometry.coordinates[0]);
                    var region = translateAlert(p.flynn_region || p.auth || '', getLang());
                    var a = makeAlert('EMSC', 'SISMO', '🌍',
                        'M' + mag.toFixed(1) + ' — ' + region,
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
                    // Filtrar mensajes vacíos/sin alertas reales
                    var t = item.title + ' ' + (item.description || '');
                    if (/no avisos|no advisory|sin avisos|there are no/i.test(t)) return;
                    if (/perspectivas|outlook|discussion|probabilidades/i.test(item.title) &&
                        !/warning|watch|alerta|hurac|storm/i.test(item.title)) return;
                    var isMajor = /hurricane|hurac[aá]n/i.test(item.title);
                    var isWarning = /warning|watch|alerta|advisory/i.test(item.title);
                    if (!isMajor && !isWarning) return; // solo alertas reales
                    all.push(makeAlert(
                        'NHC NOAA', isMajor ? 'HURACÁN' : 'TORMENTA TROPICAL', '🌀',
                        item.title, (item.description||'').substring(0,200),
                        isMajor ? '#FF3B30' : '#7B1FA2',
                        item.link, item.pubDate, isMajor ? 92 : 75));
                });
            });
            return all;
        }).catch(function() { return []; }),


        // ── WeatherAPI.com — Alertas meteorológicas oficiales por país ──
        // 1,000,000 requests/mes gratis — incluye alertas de DMC, SENAPRED vía CAP
        // Cubre lluvias intensas, vientos, tormentas, nevadas, tsunamis, etc.
        (function() {
        var wLang = (typeof currentLang !== 'undefined') ? currentLang : 'es';
        return fetch('https://api.weatherapi.com/v1/forecast.json'
            + '?key=0abe21f18afb4a8f863183050261807'
            + '&q=' + lat + ',' + lon
            + '&days=1&alerts=yes&lang=' + wLang)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.alerts || !data.alerts.alert || !data.alerts.alert.length) return [];
                return data.alerts.alert.map(function(al) {
                    var sev = (al.severity || '').toLowerCase();
                    var urgency = (al.urgency || '').toLowerCase();
                    var event = al.event || 'Alerta meteorológica';
                    var color = sev === 'extreme'  ? '#FF2D55' :
                                sev === 'severe'   ? '#FF3B30' :
                                sev === 'moderate' ? '#FF9500' : '#FFC107';
                    var priority = sev === 'extreme'  ? 97 :
                                   sev === 'severe'   ? 88 :
                                   sev === 'moderate' ? 74 : 58;
                    if (urgency === 'immediate') priority = Math.min(99, priority + 5);
                    var icon = /wind|viento/i.test(event) ? '💨' :
                               /rain|lluvia|precip/i.test(event) ? '🌧️' :
                               /snow|nieve/i.test(event) ? '❄️' :
                               /thunder|tormenta/i.test(event) ? '⛈️' :
                               /flood|inundac/i.test(event) ? '🌊' :
                               /heat|calor/i.test(event) ? '🥵' :
                               /cold|frío|frost/i.test(event) ? '🥶' :
                               /fire|incendio/i.test(event) ? '🔥' : '⚠️';
                    var desc = (al.desc || al.instruction || '').substring(0, 300);
                    var uLang = (typeof currentLang !== 'undefined') ? currentLang : 'es';
                    var a = makeAlert(
                        'WeatherAPI · ' + (data.location ? data.location.country : ''),
                        translateAlert(event.toUpperCase(), uLang), icon,
                        translateAlert(event, uLang) + (sev ? ' — ' + translateAlert(sev, uLang) : ''),
                        translateAlert(desc, uLang),
                        color,
                        'https://www.weatherapi.com',
                        // Si la fecha efectiva es futura, usar fecha actual
                        (function() {
                            var eff = al.effective || al.onset || '';
                            if (!eff) return new Date().toISOString();
                            var effTime = new Date(eff).getTime();
                            return effTime > Date.now() ? new Date().toISOString() : eff;
                        })(),
                        priority
                    );
                    // Usar coordenadas de la ubicación consultada
                    if (data.location) {
                        a.lat = data.location.lat;
                        a.lon = data.location.lon;
                        // distKm = distancia entre usuario y ubicación consultada
                        // Si el usuario buscó esta ciudad, la distancia es exacta
                        a.distKm = calcDistKm(lat, lon, data.location.lat, data.location.lon);
                        // Agregar ciudad de la alerta en descripción
                        var locName = data.location.name || '';
                        if (locName && a.description && a.description.indexOf(locName) === -1) {
                            a.description = '📍 ' + locName + ' — ' + a.description;
                        }
                    }
                    return a;
                });
            })
            .catch(function(e) {
                console.log('WeatherAPI error:', e.message);
                return [];
            });
        })(),

        // ── MET Norway / Yr.no — Alertas meteorológicas globales ──
        // La misma fuente que usa MSN El Tiempo y Yr.no
        // Cubre alertas activas mundiales filtradas por coordenadas
        fetch('https://api.met.no/weatherapi/metalerts/2.0/current.json?lat=' + lat + '&lon=' + lon,
            { headers: { 'User-Agent': 'AlertaGlobal/1.0 github.com/appcml/AlertaGlobal' } })
            .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function(data) {
                if (!data.features) return [];
                return data.features.map(function(f) {
                    var p = f.properties || {};
                    var event = p.event || p.eventAwarenessName || 'Alerta meteorológica';
                    var severity = p.severity || '';
                    var certainty = p.certainty || '';
                    var desc = p.description || p.consequences || '';
                    var instruction = p.instruction || '';
                    var color = severity === 'Extreme'  ? '#FF2D55' :
                                severity === 'Severe'   ? '#FF3B30' :
                                severity === 'Moderate' ? '#FF9500' : '#FFC107';
                    var priority = severity === 'Extreme'  ? 97 :
                                   severity === 'Severe'   ? 88 :
                                   severity === 'Moderate' ? 72 : 55;
                    // Traducir tipos comunes al español
                    var lang = getLang();
                    var typeES = translateAlert(event, lang);
                    // Translate description too
                    desc = translateAlert(desc, lang);
                    var icon = /wind|gale/i.test(event) ? '💨' :
                               /rain|flood/i.test(event) ? '🌧️' :
                               /snow|blizzard/i.test(event) ? '❄️' :
                               /thunder|storm/i.test(event) ? '⛈️' :
                               /fog/i.test(event) ? '🌫️' :
                               /ice/i.test(event) ? '🧊' : '⚠️';
                    var a = makeAlert(
                        'MET Norway · Yr.no',
                        typeES.toUpperCase(), icon,
                        typeES + (severity ? ' — Nivel ' + severity : ''),
                        (desc + (instruction ? ' ' + instruction : '')).substring(0, 300),
                        color,
                        'https://www.yr.no',
                        p.onset || new Date().toISOString(),
                        priority
                    );
                    // Extraer coords del polígono si existen
                    if (f.geometry && f.geometry.coordinates) {
                        try {
                            var coords = f.geometry.type === 'Point'
                                ? [f.geometry.coordinates]
                                : f.geometry.coordinates[0];
                            if (coords && coords[0]) {
                                a.lat = coords[0][1];
                                a.lon = coords[0][0];
                                a.distKm = calcDistKm(lat, lon, a.lat, a.lon);
                            }
                        } catch(e) {}
                    }
                    return a;
                }).filter(Boolean);
            })
            .catch(function(e) {
                console.log('MET Norway error:', e.message);
                return [];
            }),

        // NOAA Clima Espacial — removido (demasiado ruido técnico)
        Promise.resolve([]),


        // ── NASA EONET — Eventos naturales por satélite ──
        // Incendios, tormentas, volcanes, inundaciones detectados por NASA
        fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50&days=7')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.events) return [];
                return data.events.filter(function(ev) {
                    // Filtrar por proximidad si tenemos coords
                    if (!ev.geometry || !ev.geometry.length) return true;
                    var g = ev.geometry[ev.geometry.length-1];
                    if (!g.coordinates) return true;
                    var eLat = g.coordinates[1], eLon = g.coordinates[0];
                    var d = calcDistKm(lat, lon, eLat, eLon);
                    ev._dist = d;
                    return d <= (radiusKm * 2); // 2x radio para eventos satelitales
                }).slice(0,15).map(function(ev) {
                    var cat = ev.categories && ev.categories[0] ? ev.categories[0].title : '';
                    var icon = cat.match(/wildfire|fire/i) ? '🔥' :
                               cat.match(/volcano/i) ? '🌋' :
                               cat.match(/storm/i) ? '🌀' :
                               cat.match(/flood/i) ? '🌊' :
                               cat.match(/drought/i) ? '☀️' : '⚠️';
                    var type = cat.match(/wildfire|fire/i) ? 'INCENDIO' :
                               cat.match(/volcano/i) ? 'VOLCÁN' :
                               cat.match(/storm/i) ? 'TORMENTA' :
                               cat.match(/flood/i) ? 'INUNDACIÓN' : 'EVENTO';
                    var g = ev.geometry && ev.geometry[ev.geometry.length-1];
                    var eLat = g && g.coordinates ? g.coordinates[1] : null;
                    var eLon = g && g.coordinates ? g.coordinates[0] : null;
                    var dist = ev._dist || (eLat ? calcDistKm(lat, lon, eLat, eLon) : null);
                    var a = makeAlert('NASA EONET', type, icon,
                        translateAlert(ev.title || 'Evento natural detectado por satélite', getLang()),
                        translateAlert(cat, getLang()) + (dist ? ' · A ' + dist + ' km' : ''),
                        type === 'INCENDIO' ? '#D84315' :
                        type === 'VOLCÁN' ? '#FF6D00' : '#FF9500',
                        ev.sources && ev.sources[0] ? ev.sources[0].url : 'https://eonet.gsfc.nasa.gov',
                        ev.geometry && ev.geometry[0] ? ev.geometry[0].date : '',
                        type === 'INCENDIO' ? 75 : type === 'VOLCÁN' ? 85 : 65);
                    if (eLat) { a.lat = eLat; a.lon = eLon; a.distKm = dist; }
                    return a;
                });
            })
            .catch(function() { return []; }),

        // ── Calidad del aire ──
        fetchAirQuality(lat, lon),

        // ── Marejadas costeras ──
        fetchNOAATides(lat, lon),

        // ── NASA FIRMS — Incendios activos por satélite ──
        fetchNASAFIRMS(lat, lon, radiusKm),

        // ── GeoNet NZ — Sismos Pacífico Sur ──
        fetchGeoNet(lat, lon, radiusKm),

        // ── Smithsonian GVP — Volcanes activos globales ──
        fetchSmithsonianVolcano(),

        // ── GDACS API — Eventos activos filtrados por proximidad ──
        fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH'
            + '?eventlist=EQ,TC,FL,VO,WF,DR'
            + '&alertlevel=green;orange;red'
            + '&fromDate=' + new Date(Date.now()-604800000).toISOString().split('T')[0]
            + '&toDate=' + new Date().toISOString().split('T')[0]
            + '&bbox=' + (lon-10) + ',' + (lat-10) + ',' + (lon+10) + ',' + (lat+10))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var features = data.features || (data.items ? data.items : []);
                if (!features.length) return [];
                return features.slice(0,10).map(function(f) {
                    var p = f.properties || f;
                    var title = p.name || p.eventname || p.title || 'Evento';
                    var type = (p.eventtype || p.type || '').toUpperCase();
                    var icon = type === 'EQ' ? '🌍' : type === 'TC' ? '🌀' :
                               type === 'FL' ? '🌊' : type === 'VO' ? '🌋' :
                               type === 'WF' ? '🔥' : '⚠️';
                    var typeLabel = type === 'EQ' ? 'SISMO' : type === 'TC' ? 'CICLÓN' :
                                   type === 'FL' ? 'INUNDACIÓN' : type === 'VO' ? 'VOLCÁN' :
                                   type === 'WF' ? 'INCENDIO' : 'EVENTO';
                    var alert = (p.alertlevel || p.level || '').toLowerCase();
                    var color = alert === 'red' ? '#FF3B30' : alert === 'orange' ? '#FF9500' : '#FFC107';
                    var priority = alert === 'red' ? 88 : alert === 'orange' ? 75 : 60;
                    var lang = getLang();
                    // Build clean title in user language
                    var cleanTitle = typeLabel + ' M' + 
                        (p.magnitude ? p.magnitude.toFixed(1) : '') +
                        (p.country ? ' — ' + p.country : '') +
                        (p.alertlevel ? ' (' + 
                            (p.alertlevel === 'Red' ? '🔴 Rojo' : 
                             p.alertlevel === 'Orange' ? '🟠 Naranja' : '🟢 Verde') 
                        + ')' : '');
                    var cleanDesc = translateAlert(
                        (p.description || p.htmldescription || '').replace(/<[^>]+>/g,'').substring(0,200), lang);
                    var a = makeAlert('GDACS · ONU', typeLabel, icon, 
                        cleanTitle || translateAlert(title, lang),
                        cleanDesc || (p.country || ''),
                        color, p.url || 'https://www.gdacs.org', p.fromdate || '', priority);
                    if (f.geometry && f.geometry.coordinates) {
                        a.lat = f.geometry.coordinates[1];
                        a.lon = f.geometry.coordinates[0];
                        a.distKm = calcDistKm(lat, lon, a.lat, a.lon);
                    }
                    return a;
                }).filter(Boolean);
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


// ============================================================
// 🌊 PTWC — Pacific Tsunami Warning Center
// Cubre TODO el Pacífico incluido Chile, Perú, Ecuador
// ============================================================
function fetchPTWC() {
    return fetchCors('https://ptwc.weather.gov/cap/ptwc_cap_races.xml', 10000)
        .then(function(xml) {
            if (!xml || xml.length < 100) return [];
            // PTWC usa formato CAP/XML
            var parser = new DOMParser();
            var doc = parser.parseFromString(xml, 'text/xml');
            var alerts = doc.querySelectorAll('alert');
            var results = [];
            alerts.forEach(function(alert) {
                var msgType = (alert.querySelector('msgType') || {}).textContent || '';
                if (!/Alert|Update/i.test(msgType)) return;
                var title = (alert.querySelector('headline') || {}).textContent || 'Alerta Tsunami';
                var desc  = (alert.querySelector('description') || {}).textContent || '';
                var sent  = (alert.querySelector('sent') || {}).textContent || '';
                var sev   = (alert.querySelector('severity') || {}).textContent || '';
                var isTsunami = /tsunami/i.test(title + desc);
                var color = sev === 'Extreme' ? '#FF2D55' : sev === 'Severe' ? '#FF3B30' : '#FF9500';
                var priority = sev === 'Extreme' ? 99 : sev === 'Severe' ? 95 : 80;
                results.push(makeAlert(
                    'PTWC · NOAA', isTsunami ? 'TSUNAMI' : 'ALERTA COSTERA',
                    isTsunami ? '🌊' : '⚠️',
                    title, desc.substring(0, 300),
                    color, 'https://ptwc.weather.gov', sent, priority
                ));
            });
            // Si no hay CAP, intentar RSS de texto
            if (!results.length) {
                var items = parseRSS(xml);
                items.slice(0,5).forEach(function(item) {
                    var isTsunami = /tsunami/i.test((item.title||'') + (item.description||''));
                    results.push(makeAlert(
                        'PTWC · NOAA', isTsunami ? 'TSUNAMI' : 'ALERTA COSTERA',
                        isTsunami ? '🌊' : '⚠️',
                        item.title || 'Alerta PTWC',
                        (item.description||'').substring(0,300),
                        isTsunami ? '#FF2D55' : '#FF9500',
                        item.link || 'https://ptwc.weather.gov',
                        item.pubDate, isTsunami ? 99 : 80
                    ));
                });
            }
            return results;
        })
        .catch(function(e) {
            console.log('PTWC error:', e && e.message);
            return [];
        });
}

// ============================================================
// 🌋 VolcanoDiscovery RSS — Volcanes activos mundiales
// Incluye Villarrica, Calbuco, Hudson en Chile
// ============================================================
function fetchVolcanoDiscovery() {
    // Try multiple URLs
    var urls = [
        'https://www.volcanodiscovery.com/volcanoes/rss-feed.xml',
        'https://www.volcanodiscovery.com/erupting_volcanoes.rss',
        'https://www.volcanodiscovery.com/news/volcano-news.rss'
    ];
    function tryUrl(i) {
        if (i >= urls.length) return Promise.resolve([]);
        return fetchCors(urls[i], 8000).then(function(xml) {
            if (!xml || xml.length < 100) return tryUrl(i + 1);
            return xml;
        }).catch(function() { return tryUrl(i + 1); });
    }
    return tryUrl(0)
        .then(function(xml) {
            if (!xml || xml.length < 100) return [];
            return parseRSS(xml).slice(0, 15).map(function(item) {
                var t = item.title || '', d = item.description || '';
                // Calcular prioridad por keywords
                var priority = /eruption|lava|explosion|ash cloud|evacuac/i.test(t+d) ? 85 :
                               /unrest|alert|warning|tremor/i.test(t+d) ? 70 : 55;
                var color = priority >= 85 ? '#FF6D00' : priority >= 70 ? '#FF9500' : '#FFC107';
                var lang = getLang();
                return makeAlert(
                    'VolcanoDiscovery', 'VOLCÁN', '🌋',
                    translateAlert(t, lang),
                    translateAlert(d.replace(/<[^>]+>/g,'').substring(0, 250), lang),
                    color, item.link || 'https://www.volcanodiscovery.com',
                    item.pubDate, priority
                );
            }).filter(function(a) { return a.title && a.title.length > 3; });
        })
        .catch(function() { return []; });
}

// ✈️ VAAC Buenos Aires — stub (feed no disponible públicamente)
function fetchVAAC() { return Promise.resolve([]); }

// ============================================================
// 🌍 GFZ Potsdam — Sismos globales M4.5+
// Respaldo independiente de USGS y EMSC
// Centro alemán de geociencias — datos propios
// ============================================================
function fetchGFZ() {
    var url = 'https://geofon.gfz-potsdam.de/fdsnws/event/1/query?format=geojson'
        + '&minmag=2.0&limit=30&orderby=time'
        + '&starttime=' + new Date(Date.now() - 86400000).toISOString();
    return fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.features) return [];
            return data.features.map(function(f) {
                var mag = f.properties.mag || 0;
                var place = f.properties.place || f.properties.description || '';
                var depth = f.geometry.coordinates[2] || 0;
                var color = mag >= 7 ? '#FF2D55' : mag >= 6 ? '#FF3B30' : mag >= 5 ? '#FF9500' : '#FFC107';
                var priority = mag >= 7 ? 95 : mag >= 6 ? 85 : mag >= 5 ? 72 : 55;
                var a = makeAlert(
                    'GFZ Potsdam', 'SISMO', '🌍',
                    'M' + mag.toFixed(1) + ' — ' + place,
                    'Prof: ' + depth.toFixed(0) + ' km',
                    color,
                    'https://geofon.gfz-potsdam.de/eqinfo/event.php?id=' + f.id,
                    new Date(f.properties.time).toISOString(), priority
                );
                a.lat = f.geometry.coordinates[1];
                a.lon = f.geometry.coordinates[0];
                a.source_id = 'gfz_' + f.id;
                return a;
            });
        })
        .catch(function() { return []; });
}

// =============================================
// MASTER FETCH — Prioridad: APIs directas primero
// =============================================
function loadExternalSources(callback) {
    Promise.all([
        fetchUSGSChile(),        // USGS Chile M1.5+ 48h
        fetchUSGSChile24h(),     // USGS Chile M2.0+ 24h
        fetchUSGSGlobal(),       // USGS Global M4.5+
        fetchGFZ(),              // GFZ Potsdam — respaldo sismos
        fetchSENAPRED(),         // SENAPRED Chile (cuando disponible)
        fetchPTWC(),             // PTWC — Tsunamis Pacífico
        fetchVolcanoDiscovery(), // Volcanes activos globales
        fetchSmithsonianVolcano(), // Smithsonian GVP — volcanes
        fetchVAAC(),             // Ceniza volcánica Sudamérica
        fetchGDACS(),            // GDACS ONU
        fetchNHC(),              // NHC NOAA — huracanes
        Promise.resolve([])       // NOAA clima espacial — desactivado
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
