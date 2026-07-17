// ============================================
// js/sources.js — Fuentes oficiales v2
// ============================================

var CORS_PROXY = 'https://api.allorigins.win/get?url=';

function fetchCors(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 6000) : null;
    var opts = ctrl ? { signal: ctrl.signal } : {};
    return fetch(CORS_PROXY + encodeURIComponent(url), opts)
        .then(function(r) { if (timer) clearTimeout(timer); return r.json(); })
        .then(function(d) { return d.contents || ''; })
        .catch(function() { return ''; });
}

function parseRSS(xmlText) {
    try {
        var parser = new DOMParser();
        var doc = parser.parseFromString(xmlText, 'text/xml');
        var items = doc.querySelectorAll('item, entry');
        var results = [];
        items.forEach(function(item) {
            var title = (item.querySelector('title') || {}).textContent || '';
            var desc  = (item.querySelector('description, summary') || {}).textContent || '';
            var link  = item.querySelector('link') ? (item.querySelector('link').getAttribute('href') || item.querySelector('link').textContent) : '';
            var pub   = (item.querySelector('pubDate, updated, published') || {}).textContent || '';
            results.push({
                title: title.trim(),
                description: desc.replace(/<[^>]+>/g, '').trim().substring(0, 250),
                link: link.trim(),
                pubDate: pub.trim()
            });
        });
        return results;
    } catch(e) { return []; }
}

// ===== NHC — Huracanes en tiempo real (feeds oficiales) =====
function fetchNHC() {
    var feeds = [
        // Feeds principales por cuenca (en español cuando disponible)
        { url: 'https://www.nhc.noaa.gov/index-at-sp.xml', basin: 'Atlántico' },
        { url: 'https://www.nhc.noaa.gov/index-ep-sp.xml', basin: 'Pacífico E.' },
        { url: 'https://www.nhc.noaa.gov/index-cp.xml',    basin: 'Pacífico C.' },
        // Storm wallets Atlántico (1-5)
        { url: 'https://www.nhc.noaa.gov/nhc_at1.xml', basin: 'Atlántico' },
        { url: 'https://www.nhc.noaa.gov/nhc_at2.xml', basin: 'Atlántico' },
        { url: 'https://www.nhc.noaa.gov/nhc_at3.xml', basin: 'Atlántico' },
        // Storm wallets Pacífico E. (1-5)
        { url: 'https://www.nhc.noaa.gov/nhc_ep1.xml', basin: 'Pacífico E.' },
        { url: 'https://www.nhc.noaa.gov/nhc_ep2.xml', basin: 'Pacífico E.' },
        { url: 'https://www.nhc.noaa.gov/nhc_ep3.xml', basin: 'Pacífico E.' },
        // Outlooks en español
        { url: 'https://www.nhc.noaa.gov/xml/TWOSAT.xml', basin: 'Atlántico' },
        { url: 'https://www.nhc.noaa.gov/xml/TWOSEP.xml', basin: 'Pacífico E.' }
    ];

    var promises = feeds.map(function(f) {
        return fetchCors(f.url)
            .then(function(xml) {
                if (!xml || xml.length < 50) return [];
                return parseRSS(xml).map(function(item) {
                    if (!item.title || item.title.length < 3) return null;
                    var isMajor = /hurricane|huracán|categoria|category [3-5]/i.test(item.title + item.description);
                    var isTS    = /tropical storm|tormenta tropical|ts /i.test(item.title);
                    var isTD    = /tropical depression|depresión/i.test(item.title);
                    var type = isMajor ? 'HURACÁN' : isTS ? 'TORMENTA TROPICAL' : isTD ? 'DEPRESIÓN TROPICAL' : 'AVISO NHC';
                    var color = isMajor ? '#B71C1C' : isTS ? '#7B1FA2' : '#1565C0';
                    return {
                        source: 'NHC · NOAA · ' + f.basin,
                        type: type,
                        icon: '🌀',
                        title: item.title,
                        description: item.description,
                        color: color,
                        link: item.link || 'https://www.nhc.noaa.gov',
                        time: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
                        priority: isMajor ? 95 : isTS ? 85 : 60
                    };
                }).filter(Boolean);
            })
            .catch(function() { return []; });
    });

    return Promise.all(promises).then(function(results) {
        var all = [];
        results.forEach(function(arr) { all = all.concat(arr); });
        // Deduplicate by title
        var seen = {};
        return all.filter(function(a) {
            var key = a.title.substring(0, 40);
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        }).slice(0, 8);
    });
}

// ===== GDACS — ONU: inundaciones, ciclones, sequías, volcanes =====
function fetchGDACS() {
    return fetchCors('https://www.gdacs.org/xml/rss.xml')
        .then(function(xml) {
            if (!xml) return [];
            return parseRSS(xml).slice(0, 15).map(function(item) {
                if (!item.title || item.title.length < 3) return null;
                var t = item.title, d = item.description;
                var type = 'DESASTRE', icon = '⚠️', color = '#FF9800', priority = 50;
                if (/cyclone|hurricane|typhoon|trop/i.test(t+d))  { type='CICLÓN TROPICAL'; icon='🌀'; color='#7B1FA2'; priority=90; }
                else if (/earthquake|terremoto|sismo/i.test(t+d)) { type='SISMO'; icon='🌍'; color='#B71C1C'; priority=80; }
                else if (/flood|inundac/i.test(t+d))              { type='INUNDACIÓN'; icon='🌊'; color='#1565C0'; priority=75; }
                else if (/volcano|volcan/i.test(t+d))             { type='VOLCÁN'; icon='🌋'; color='#E65100'; priority=85; }
                else if (/wildfire|incendio|fire/i.test(t+d))     { type='INCENDIO'; icon='🔥'; color='#D84315'; priority=80; }
                else if (/drought|sequía/i.test(t+d))             { type='SEQUÍA'; icon='🏜️'; color='#795548'; priority=40; }
                else if (/tsunami/i.test(t+d))                    { type='TSUNAMI'; icon='🌊'; color='#880E4F'; priority=98; }
                return {
                    source: 'GDACS · ONU',
                    type: type, icon: icon,
                    title: t,
                    description: d,
                    color: color, priority: priority,
                    link: item.link || 'https://www.gdacs.org',
                    time: item.pubDate ? new Date(item.pubDate).getTime() : Date.now()
                };
            }).filter(Boolean);
        })
        .catch(function() { return []; });
}

// ===== NASA CNEOS — Asteroides cercanos =====
function fetchNASANeo() {
    var nc = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var nt = nc ? setTimeout(function() { nc.abort(); }, 5000) : null;
    return fetch('https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.05&date-min=today&sort=dist&limit=5', nc ? {signal:nc.signal} : {})
        .then(function(r) { if (nt) clearTimeout(nt); return r.json(); })
        .then(function(data) {
            if (!data || !data.data || !data.fields) return [];
            var fi = data.fields;
            var di = fi.indexOf('des'), distI = fi.indexOf('dist'), dateI = fi.indexOf('cd'), vI = fi.indexOf('v_rel');
            return data.data.slice(0, 3).map(function(obj) {
                var distKm = Math.round(parseFloat(obj[distI]) * 149597870.7);
                return {
                    source: 'NASA CNEOS',
                    type: 'OBJETO CERCANO',
                    icon: '☄️',
                    title: 'Asteroide ' + obj[di] + ' — ' + distKm.toLocaleString() + ' km',
                    description: 'Aproximación: ' + obj[dateI] + ' · Distancia: ' + distKm.toLocaleString() + ' km · Velocidad: ' + parseFloat(obj[vI]).toFixed(1) + ' km/s',
                    color: '#37474F',
                    link: 'https://cneos.jpl.nasa.gov/ca/',
                    time: Date.now(),
                    priority: 20
                };
            });
        })
        .catch(function() { return []; });
}

// ===== EMSC — Sismos europeos =====
function fetchEMSC() {
    return fetch('https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=20&minmag=4.0&orderby=time')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data || !data.features) return [];
            return data.features.slice(0, 10).map(function(f) {
                return {
                    id: 'emsc_' + f.id,
                    source: 'EMSC',
                    mag: f.properties.mag,
                    place: f.properties.flynn_region || '?',
                    time: f.properties.time ? new Date(f.properties.time).getTime() : Date.now(),
                    depth: (f.geometry.coordinates[2] || 0).toFixed(1),
                    lat: f.geometry.coordinates[1],
                    lon: f.geometry.coordinates[0]
                };
            });
        })
        .catch(function() { return []; });
}

// ===== MASTER FETCH — llama todo en paralelo =====
function loadExternalSources(callback) {
    Promise.all([
        fetchGDACS(),
        fetchNHC(),
        fetchNASANeo()
    ]).then(function(results) {
        var all = [];
        results.forEach(function(arr) { all = all.concat(arr); });
        all.sort(function(a, b) { return (b.priority || 0) - (a.priority || 0); });
        if (callback) callback(all);
    }).catch(function() {
        if (callback) callback([]);
    });
}// ============================================
// js/sources.js — Fuentes oficiales v2
// ============================================

var CORS_PROXY = 'https://api.allorigins.win/get?url=';

function fetchCors(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 6000) : null;
    var opts = ctrl ? { signal: ctrl.signal } : {};
    return fetch(CORS_PROXY + encodeURIComponent(url), opts)
        .then(function(r) { if (timer) clearTimeout(timer); return r.json(); })
        .then(function(d) { return d.contents || ''; })
        .catch(function() { return ''; });
}

function parseRSS(xmlText) {
    try {
        var parser = new DOMParser();
        var doc = parser.parseFromString(xmlText, 'text/xml');
        var items = doc.querySelectorAll('item, entry');
        var results = [];
        items.forEach(function(item) {
            var title = (item.querySelector('title') || {}).textContent || '';
            var desc  = (item.querySelector('description, summary') || {}).textContent || '';
            var link  = item.querySelector('link') ? (item.querySelector('link').getAttribute('href') || item.querySelector('link').textContent) : '';
            var pub   = (item.querySelector('pubDate, updated, published') || {}).textContent || '';
            results.push({
                title: title.trim(),
                description: desc.replace(/<[^>]+>/g, '').trim().substring(0, 250),
                link: link.trim(),
                pubDate: pub.trim()
            });
        });
        return results;
    } catch(e) { return []; }
}

// ===== NHC — Huracanes en tiempo real (feeds oficiales) =====
function fetchNHC() {
    var feeds = [
        // Feeds principales por cuenca (en español cuando disponible)
        { url: 'https://www.nhc.noaa.gov/index-at-sp.xml', basin: 'Atlántico' },
        { url: 'https://www.nhc.noaa.gov/index-ep-sp.xml', basin: 'Pacífico E.' },
        { url: 'https://www.nhc.noaa.gov/index-cp.xml',    basin: 'Pacífico C.' },
        // Storm wallets Atlántico (1-5)
        { url: 'https://www.nhc.noaa.gov/nhc_at1.xml', basin: 'Atlántico' },
        { url: 'https://www.nhc.noaa.gov/nhc_at2.xml', basin: 'Atlántico' },
        { url: 'https://www.nhc.noaa.gov/nhc_at3.xml', basin: 'Atlántico' },
        // Storm wallets Pacífico E. (1-5)
        { url: 'https://www.nhc.noaa.gov/nhc_ep1.xml', basin: 'Pacífico E.' },
        { url: 'https://www.nhc.noaa.gov/nhc_ep2.xml', basin: 'Pacífico E.' },
        { url: 'https://www.nhc.noaa.gov/nhc_ep3.xml', basin: 'Pacífico E.' },
        // Outlooks en español
        { url: 'https://www.nhc.noaa.gov/xml/TWOSAT.xml', basin: 'Atlántico' },
        { url: 'https://www.nhc.noaa.gov/xml/TWOSEP.xml', basin: 'Pacífico E.' }
    ];

    var promises = feeds.map(function(f) {
        return fetchCors(f.url)
            .then(function(xml) {
                if (!xml || xml.length < 50) return [];
                return parseRSS(xml).map(function(item) {
                    if (!item.title || item.title.length < 3) return null;
                    var isMajor = /hurricane|huracán|categoria|category [3-5]/i.test(item.title + item.description);
                    var isTS    = /tropical storm|tormenta tropical|ts /i.test(item.title);
                    var isTD    = /tropical depression|depresión/i.test(item.title);
                    var type = isMajor ? 'HURACÁN' : isTS ? 'TORMENTA TROPICAL' : isTD ? 'DEPRESIÓN TROPICAL' : 'AVISO NHC';
                    var color = isMajor ? '#B71C1C' : isTS ? '#7B1FA2' : '#1565C0';
                    return {
                        source: 'NHC · NOAA · ' + f.basin,
                        type: type,
                        icon: '🌀',
                        title: item.title,
                        description: item.description,
                        color: color,
                        link: item.link || 'https://www.nhc.noaa.gov',
                        time: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
                        priority: isMajor ? 95 : isTS ? 85 : 60
                    };
                }).filter(Boolean);
            })
            .catch(function() { return []; });
    });

    return Promise.all(promises).then(function(results) {
        var all = [];
        results.forEach(function(arr) { all = all.concat(arr); });
        // Deduplicate by title
        var seen = {};
        return all.filter(function(a) {
            var key = a.title.substring(0, 40);
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        }).slice(0, 8);
    });
}

// ===== GDACS — ONU: inundaciones, ciclones, sequías, volcanes =====
function fetchGDACS() {
    return fetchCors('https://www.gdacs.org/xml/rss.xml')
        .then(function(xml) {
            if (!xml) return [];
            return parseRSS(xml).slice(0, 15).map(function(item) {
                if (!item.title || item.title.length < 3) return null;
                var t = item.title, d = item.description;
                var type = 'DESASTRE', icon = '⚠️', color = '#FF9800', priority = 50;
                if (/cyclone|hurricane|typhoon|trop/i.test(t+d))  { type='CICLÓN TROPICAL'; icon='🌀'; color='#7B1FA2'; priority=90; }
                else if (/earthquake|terremoto|sismo/i.test(t+d)) { type='SISMO'; icon='🌍'; color='#B71C1C'; priority=80; }
                else if (/flood|inundac/i.test(t+d))              { type='INUNDACIÓN'; icon='🌊'; color='#1565C0'; priority=75; }
                else if (/volcano|volcan/i.test(t+d))             { type='VOLCÁN'; icon='🌋'; color='#E65100'; priority=85; }
                else if (/wildfire|incendio|fire/i.test(t+d))     { type='INCENDIO'; icon='🔥'; color='#D84315'; priority=80; }
                else if (/drought|sequía/i.test(t+d))             { type='SEQUÍA'; icon='🏜️'; color='#795548'; priority=40; }
                else if (/tsunami/i.test(t+d))                    { type='TSUNAMI'; icon='🌊'; color='#880E4F'; priority=98; }
                return {
                    source: 'GDACS · ONU',
                    type: type, icon: icon,
                    title: t,
                    description: d,
                    color: color, priority: priority,
                    link: item.link || 'https://www.gdacs.org',
                    time: item.pubDate ? new Date(item.pubDate).getTime() : Date.now()
                };
            }).filter(Boolean);
        })
        .catch(function() { return []; });
}

// ===== NASA CNEOS — Asteroides cercanos =====
function fetchNASANeo() {
    var nc = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var nt = nc ? setTimeout(function() { nc.abort(); }, 5000) : null;
    return fetch('https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.05&date-min=today&sort=dist&limit=5', nc ? {signal:nc.signal} : {})
        .then(function(r) { if (nt) clearTimeout(nt); return r.json(); })
        .then(function(data) {
            if (!data || !data.data || !data.fields) return [];
            var fi = data.fields;
            var di = fi.indexOf('des'), distI = fi.indexOf('dist'), dateI = fi.indexOf('cd'), vI = fi.indexOf('v_rel');
            return data.data.slice(0, 3).map(function(obj) {
                var distKm = Math.round(parseFloat(obj[distI]) * 149597870.7);
                return {
                    source: 'NASA CNEOS',
                    type: 'OBJETO CERCANO',
                    icon: '☄️',
                    title: 'Asteroide ' + obj[di] + ' — ' + distKm.toLocaleString() + ' km',
                    description: 'Aproximación: ' + obj[dateI] + ' · Distancia: ' + distKm.toLocaleString() + ' km · Velocidad: ' + parseFloat(obj[vI]).toFixed(1) + ' km/s',
                    color: '#37474F',
                    link: 'https://cneos.jpl.nasa.gov/ca/',
                    time: Date.now(),
                    priority: 20
                };
            });
        })
        .catch(function() { return []; });
}

// ===== EMSC — Sismos europeos =====
function fetchEMSC() {
    return fetch('https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=20&minmag=4.0&orderby=time')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data || !data.features) return [];
            return data.features.slice(0, 10).map(function(f) {
                return {
                    id: 'emsc_' + f.id,
                    source: 'EMSC',
                    mag: f.properties.mag,
                    place: f.properties.flynn_region || '?',
                    time: f.properties.time ? new Date(f.properties.time).getTime() : Date.now(),
                    depth: (f.geometry.coordinates[2] || 0).toFixed(1),
                    lat: f.geometry.coordinates[1],
                    lon: f.geometry.coordinates[0]
                };
            });
        })
        .catch(function() { return []; });
}

// ===== MASTER FETCH — llama todo en paralelo =====
function loadExternalSources(callback) {
    Promise.all([
        fetchGDACS(),
        fetchNHC(),
        fetchNASANeo()
    ]).then(function(results) {
        var all = [];
        results.forEach(function(arr) { all = all.concat(arr); });
        all.sort(function(a, b) { return (b.priority || 0) - (a.priority || 0); });
        if (callback) callback(all);
    }).catch(function() {
        if (callback) callback([]);
    });
}
