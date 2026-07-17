// ============================================
// js/sources.js — Fuentes oficiales globales v3
// Combina gobiernos + redes científicas
// ============================================

var CORS_PROXY = 'https://api.allorigins.win/get?url=';

function fetchCors(url, timeout) {
    timeout = timeout || 6000;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, timeout) : null;
    return fetch(CORS_PROXY + encodeURIComponent(url), ctrl ? { signal: ctrl.signal } : {})
        .then(function(r) { if (timer) clearTimeout(timer); return r.json(); })
        .then(function(d) { return d.contents || ''; })
        .catch(function() { return ''; });
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
// FUENTES GUBERNAMENTALES POR PAÍS/REGIÓN
// =============================================

// 🇨🇱 CHILE — SENAPRED + CSN + SERNAGEOMIN
function fetchChile() {
    return Promise.all([
        // SENAPRED (ex-ONEMI) — alertas nacionales
        fetchCors('https://www.senapred.cl/rss/alertas.xml').then(function(xml) {
            return parseRSS(xml).map(function(i) {
                return makeAlert('SENAPRED · Chile', detectType(i.title+i.description), detectIcon(i.title), i.title, i.description, '#CC0000', i.link, i.pubDate, 90);
            });
        }).catch(function() { return []; }),
        // SERNAGEOMIN — volcanes Chile
        fetchCors('https://rnvv.sernageomin.cl/rnvv/TI_WLS_volcanes_los_lagos_sur.php').then(function(xml) {
            return parseRSS(xml).map(function(i) {
                return makeAlert('SERNAGEOMIN · Chile', 'VOLCÁN', '🌋', i.title, i.description, '#E65100', i.link, i.pubDate, 85);
            });
        }).catch(function() { return []; })
    ]).then(function(r) { return r[0].concat(r[1]); });
}

// 🇺🇸 ESTADOS UNIDOS — NOAA NWS + FEMA
function fetchUSA() {
    return Promise.all([
        // NOAA NWS — alertas meteorológicas nacionales
        fetchCors('https://alerts.weather.gov/cap/us.php?x=1').then(function(xml) {
            var items = parseRSS(xml).slice(0, 10);
            return items.filter(function(i) {
                return /tornado|hurricane|tsunami|flood|extreme|warning|emergency/i.test(i.title);
            }).map(function(i) {
                var p = /tornado|hurricane/i.test(i.title) ? 92 : /flood/i.test(i.title) ? 80 : 65;
                return makeAlert('NOAA NWS · USA', detectType(i.title), detectIcon(i.title), i.title, i.description, '#003087', i.link, i.pubDate, p);
            });
        }).catch(function() { return []; }),
        // NHC — Huracanes Atlántico (en español)
        fetchCors('https://www.nhc.noaa.gov/index-at-sp.xml').then(function(xml) {
            return parseRSS(xml).slice(0,5).filter(function(i) { return i.title.length > 3; }).map(function(i) {
                var isMajor = /hurricane|huracán/i.test(i.title);
                return makeAlert('NHC NOAA · Atlántico', isMajor?'HURACÁN':'TORMENTA TROPICAL', '🌀', i.title, i.description, isMajor?'#B71C1C':'#7B1FA2', i.link, i.pubDate, isMajor?95:80);
            });
        }).catch(function() { return []; }),
        // NHC — Huracanes Pacífico E. (en español)
        fetchCors('https://www.nhc.noaa.gov/index-ep-sp.xml').then(function(xml) {
            return parseRSS(xml).slice(0,5).filter(function(i) { return i.title.length > 3; }).map(function(i) {
                return makeAlert('NHC NOAA · Pacífico', 'TORMENTA TROPICAL', '🌀', i.title, i.description, '#7B1FA2', i.link, i.pubDate, 80);
            });
        }).catch(function() { return []; })
    ]).then(function(r) { return r[0].concat(r[1]).concat(r[2]); });
}

// 🇲🇽 MÉXICO — SMN + CENAPRED
function fetchMexico() {
    return Promise.all([
        fetchCors('https://smn.conagua.gob.mx/rss/avisos.xml').then(function(xml) {
            return parseRSS(xml).slice(0,8).map(function(i) {
                return makeAlert('SMN · México', detectType(i.title), detectIcon(i.title), i.title, i.description, '#006847', i.link, i.pubDate, 75);
            });
        }).catch(function() { return []; })
    ]).then(function(r) { return r[0]; });
}

// 🌊 TSUNAMI — PTWC NOAA (Pacífico) + IOC UNESCO
function fetchTsunami() {
    return Promise.all([
        // PTWC — alertas de tsunami Pacífico
        fetchCors('https://www.tsunami.gov/events/PAAQ/2022/feed.atom').then(function(xml) {
            return parseRSS(xml).slice(0,5).map(function(i) {
                var isCritical = /warning|evacuate|alerta/i.test(i.title+i.description);
                return makeAlert('PTWC · NOAA', 'TSUNAMI', '🌊', i.title, i.description, isCritical?'#880E4F':'#1565C0', i.link, i.pubDate, isCritical?99:75);
            });
        }).catch(function() { return []; }),
        // NHC storm wallets Pac. Este (Elida y otros activos)
        fetchCors('https://www.nhc.noaa.gov/nhc_ep1.xml').then(function(xml) {
            return parseRSS(xml).slice(0,3).filter(function(i){ return i.title.length>3; }).map(function(i) {
                return makeAlert('NHC · Pacífico E.', 'TORMENTA TROPICAL', '🌀', i.title, i.description, '#7B1FA2', i.link, i.pubDate, 85);
            });
        }).catch(function() { return []; })
    ]).then(function(r) { return r[0].concat(r[1]); });
}

// 🇯🇵 JAPÓN — JMA
function fetchJapan() {
    return fetchCors('https://www.jma.go.jp/bosai/feed/sample.json').then(function(text) {
        try {
            var data = JSON.parse(text);
            if (!Array.isArray(data)) return [];
            return data.slice(0,5).map(function(item) {
                return makeAlert('JMA · Japón', detectType(item.title||''), detectIcon(item.title||''), item.title||'', item.description||'', '#BC002D', item.url||'', item.time||'', 80);
            });
        } catch(e) { return []; }
    }).catch(function() { return []; });
}

// 🇪🇺 EUROPA — EFAS + Copernicus EFFIS (incendios)
function fetchEurope() {
    return Promise.all([
        // GDACS — sistema ONU global
        fetchCors('https://www.gdacs.org/xml/rss.xml').then(function(xml) {
            return parseRSS(xml).slice(0,15).map(function(item) {
                var t=item.title, d=item.description;
                var type=detectType(t+d), icon=detectIcon(t+d);
                var color='#FF9800', priority=60;
                if(/tsunami/i.test(t+d))         { color='#880E4F'; priority=99; }
                else if(/cyclone|hurricane/i.test(t+d)) { color='#7B1FA2'; priority=90; }
                else if(/earthquake/i.test(t+d)) { color='#B71C1C'; priority=80; }
                else if(/volcano/i.test(t+d))    { color='#E65100'; priority=85; }
                else if(/flood/i.test(t+d))      { color='#1565C0'; priority=75; }
                else if(/wildfire|fire/i.test(t+d)) { color='#D84315'; priority=80; }
                if (!t || t.length<3) return null;
                return makeAlert('GDACS · ONU', type, icon, t, d, color, item.link, item.pubDate, priority);
            }).filter(Boolean);
        }).catch(function() { return []; })
    ]).then(function(r) { return r[0]; });
}

// ☄️ NASA — Objetos cercanos y clima espacial
function fetchSpace() {
    return Promise.all([
        // NASA NEO — asteroides
        fetch('https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.05&date-min=today&sort=dist&limit=3')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data || !data.data || !data.fields) return [];
                var fi=data.fields, di=fi.indexOf('des'), distI=fi.indexOf('dist'), dateI=fi.indexOf('cd'), vI=fi.indexOf('v_rel');
                return data.data.slice(0,3).map(function(obj) {
                    var distKm = Math.round(parseFloat(obj[distI])*149597870.7);
                    var isMoon = distKm < 384400;
                    return makeAlert('NASA CNEOS', 'OBJETO CERCANO', '☄️',
                        'Asteroide '+obj[di]+' — '+distKm.toLocaleString()+' km',
                        'Aproximación: '+obj[dateI]+' · '+distKm.toLocaleString()+' km · '+parseFloat(obj[vI]).toFixed(1)+' km/s'+(isMoon?' (< distancia lunar)':''),
                        isMoon?'#E65100':'#37474F', 'https://cneos.jpl.nasa.gov/ca/', '', isMoon?70:20);
                });
            }).catch(function() { return []; }),
        // NOAA Space Weather
        fetchCors('https://services.swpc.noaa.gov/products/alerts.json').then(function(text) {
            try {
                var data = JSON.parse(text);
                if (!Array.isArray(data)) return [];
                return data.slice(0,5).filter(function(d) {
                    return /warning|watch|kp/i.test(d.message||'');
                }).map(function(d) {
                    var msg = (d.message||'').substring(0,200);
                    var isKp = /kp [5-9]/i.test(msg);
                    return makeAlert('NOAA SWC · Clima Espacial', 'TORMENTA SOLAR', '🌞',
                        'Alerta clima espacial — ' + (isKp?'Tormenta geomagnética':'Actividad solar'),
                        msg, isKp?'#6A1B9A':'#37474F',
                        'https://www.swpc.noaa.gov/', d.issue_time||'', isKp?75:40);
                });
            } catch(e) { return []; }
        }).catch(function() { return []; })
    ]).then(function(r) { return r[0].concat(r[1]); });
}

// =============================================
// DETECCIÓN AUTOMÁTICA DE TIPO E ÍCONO
// =============================================
function detectType(text) {
    text = (text||'').toLowerCase();
    if(/tsunami/i.test(text))                          return 'TSUNAMI';
    if(/tornado/i.test(text))                          return 'TORNADO';
    if(/hurricane|huracán|ciclón|typhoon|tifón/i.test(text)) return 'CICLÓN TROPICAL';
    if(/tropical storm|tormenta tropical/i.test(text)) return 'TORMENTA TROPICAL';
    if(/earthquake|terremoto|sismo/i.test(text))       return 'SISMO';
    if(/volcano|volcán|eruption/i.test(text))          return 'VOLCÁN';
    if(/wildfire|incendio|fire/i.test(text))           return 'INCENDIO';
    if(/flood|inundac/i.test(text))                    return 'INUNDACIÓN';
    if(/landslide|deslizamiento|aluvión/i.test(text))  return 'DESLIZAMIENTO';
    if(/snow|nieve|blizzard/i.test(text))              return 'NEVADA';
    if(/drought|sequía/i.test(text))                   return 'SEQUÍA';
    if(/solar|geomagnetic|kp/i.test(text))             return 'TORMENTA SOLAR';
    if(/asteroid|asteroide|meteor/i.test(text))        return 'OBJETO CERCANO';
    if(/chemical|químico|nuclear|radiolog/i.test(text)) return 'EMERGENCIA TECNOLÓGICA';
    if(/heat|calor|wave/i.test(text))                  return 'OLA DE CALOR';
    if(/cold|frío|freeze/i.test(text))                 return 'OLA DE FRÍO';
    return 'ALERTA';
}

function detectIcon(text) {
    var type = detectType(text);
    var icons = {
        'TSUNAMI':'🌊','TORNADO':'🌪️','CICLÓN TROPICAL':'🌀','TORMENTA TROPICAL':'🌀',
        'SISMO':'🌍','VOLCÁN':'🌋','INCENDIO':'🔥','INUNDACIÓN':'🌊',
        'DESLIZAMIENTO':'🏔️','NEVADA':'❄️','SEQUÍA':'🏜️',
        'TORMENTA SOLAR':'🌞','OBJETO CERCANO':'☄️',
        'EMERGENCIA TECNOLÓGICA':'☣️','OLA DE CALOR':'🌡️','OLA DE FRÍO':'🥶','ALERTA':'⚠️'
    };
    return icons[type] || '⚠️';
}

// =============================================
// MASTER FETCH — todas las fuentes en paralelo
// =============================================
function loadExternalSources(callback) {
    Promise.all([
        fetchEurope(),   // GDACS ONU
        fetchUSA(),      // NOAA NWS + NHC
        fetchTsunami(),  // PTWC + NHC wallets
        fetchChile(),    // SENAPRED + SERNAGEOMIN
        fetchSpace()     // NASA + NOAA Space
    ]).then(function(results) {
        var all = [];
        results.forEach(function(arr) { all = all.concat(arr || []); });
        // Deduplicar por título similar
        var seen = {};
        all = all.filter(function(a) {
            var key = a.title.substring(0,35).toLowerCase().replace(/\s+/g,'');
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
        // Ordenar por prioridad descendente, luego por tiempo
        all.sort(function(a, b) {
            if (b.priority !== a.priority) return b.priority - a.priority;
            return (b.time||0) - (a.time||0);
        });
        if (callback) callback(all);
    }).catch(function() {
        if (callback) callback([]);
    });
}
