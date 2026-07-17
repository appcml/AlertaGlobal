// ============================================
// js/sources.js — Fuentes de datos oficiales
// ============================================

var SOURCES = {

    // ===== SISMOS =====
    USGS: {
        name: 'USGS',
        url: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=50&minmagnitude=3.5&orderby=time',
        flag: '🇺🇸'
    },
    EMSC: {
        name: 'EMSC',
        // EMSC feed CORS-compatible via proxy público
        url: 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=20&minmag=4.0&orderby=time',
        flag: '🇪🇺'
    },

    // ===== HURACANES / CLIMA EXTREMO =====
    NHC_ATLANTIC: {
        name: 'NHC Atlántico',
        url: 'https://www.nhc.noaa.gov/nhc_at.xml',
        flag: '🌀'
    },
    NHC_PACIFIC: {
        name: 'NHC Pacífico',
        url: 'https://www.nhc.noaa.gov/nhc_ep.xml',
        flag: '🌀'
    },
    GDACS: {
        name: 'GDACS ONU',
        url: 'https://www.gdacs.org/xml/rss.xml',
        flag: '🇺🇳'
    },

    // ===== VOLCANES =====
    SMITHSONIAN: {
        name: 'Smithsonian GVP',
        url: 'https://volcano.si.edu/news/WeeklyVolcanoActivity.cfm',
        flag: '🌋'
    },

    // ===== TSUNAMI =====
    PTWC: {
        name: 'PTWC NOAA',
        url: 'https://www.tsunami.gov/events/PAAQ/2022/feed.atom',
        flag: '🌊'
    },

    // ===== ESPACIO =====
    NASA_NEO: {
        name: 'NASA CNEOS',
        url: 'https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.05&date-min=today&sort=dist&limit=5',
        flag: '☄️'
    }
};

// Proxy CORS para feeds RSS externos (necesario para leer XML desde browser)
var CORS_PROXY = 'https://api.allorigins.win/get?url=';

// Fetch con CORS proxy
function fetchCors(url) {
    return fetch(CORS_PROXY + encodeURIComponent(url))
        .then(function(r) { return r.json(); })
        .then(function(d) { return d.contents; });
}

// Parse RSS/XML a array de items
function parseRSS(xmlText) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(xmlText, 'text/xml');
    var items = doc.querySelectorAll('item, entry');
    var results = [];
    items.forEach(function(item) {
        var title = item.querySelector('title') ? item.querySelector('title').textContent : '';
        var desc = item.querySelector('description, summary, content') ? (item.querySelector('description, summary, content').textContent || '') : '';
        var link = item.querySelector('link') ? (item.querySelector('link').getAttribute('href') || item.querySelector('link').textContent) : '';
        var pubDate = item.querySelector('pubDate, updated, published') ? item.querySelector('pubDate, updated, published').textContent : '';
        results.push({ title: title.trim(), description: desc.trim(), link: link.trim(), pubDate: pubDate.trim() });
    });
    return results;
}

// ===== FETCHERS POR FUENTE =====

// GDACS — inundaciones, ciclones, terremotos, sequías (ONU)
function fetchGDACS() {
    return fetchCors(SOURCES.GDACS.url)
        .then(function(xml) {
            var items = parseRSS(xml);
            return items.slice(0, 15).map(function(item) {
                var title = item.title;
                var desc = item.description.replace(/<[^>]+>/g, '').substring(0, 200);
                // Detect type from title
                var type = 'DESASTRE';
                var icon = '⚠️';
                var color = '#FF9800';
                if (/cyclone|hurricane|typhoon|tormenta|tropical/i.test(title)) { type = 'CICLÓN TROPICAL'; icon = '🌀'; color = '#7B1FA2'; }
                else if (/earthquake|terremoto|sismo/i.test(title)) { type = 'SISMO'; icon = '🌍'; color = '#B71C1C'; }
                else if (/flood|inundac/i.test(title)) { type = 'INUNDACIÓN'; icon = '🌊'; color = '#1565C0'; }
                else if (/drought|sequía/i.test(title)) { type = 'SEQUÍA'; icon = '🏜️'; color = '#795548'; }
                else if (/volcano|volcan/i.test(title)) { type = 'VOLCÁN'; icon = '🌋'; color = '#E65100'; }
                else if (/wildfire|incendio|fire/i.test(title)) { type = 'INCENDIO'; icon = '🔥'; color = '#D84315'; }
                return {
                    source: 'GDACS · ONU',
                    type: type,
                    icon: icon,
                    title: title,
                    description: desc,
                    color: color,
                    link: item.link,
                    time: item.pubDate ? new Date(item.pubDate).getTime() : Date.now()
                };
            }).filter(function(i) { return i.title.length > 3; });
        })
        .catch(function() { return []; });
}

// NHC — Huracanes y ciclones tropicales
function fetchNHC() {
    return Promise.all([
        fetchCors(SOURCES.NHC_ATLANTIC.url).catch(function() { return ''; }),
        fetchCors(SOURCES.NHC_PACIFIC.url).catch(function() { return ''; })
    ]).then(function(results) {
        var alerts = [];
        results.forEach(function(xml, idx) {
            if (!xml) return;
            var basin = idx === 0 ? 'Atlántico' : 'Pacífico E.';
            var items = parseRSS(xml);
            items.slice(0, 5).forEach(function(item) {
                if (!item.title || item.title.length < 3) return;
                var isMajor = /hurricane|huracán/i.test(item.title);
                alerts.push({
                    source: 'NHC · NOAA · ' + basin,
                    type: isMajor ? 'HURACÁN' : 'TORMENTA TROPICAL',
                    icon: '🌀',
                    title: item.title,
                    description: item.description.replace(/<[^>]+>/g, '').substring(0, 200),
                    color: isMajor ? '#B71C1C' : '#7B1FA2',
                    link: item.link,
                    time: item.pubDate ? new Date(item.pubDate).getTime() : Date.now()
                });
            });
        });
        return alerts;
    }).catch(function() { return []; });
}

// NASA NEO — Objetos cercanos a la Tierra
function fetchNASANeo() {
    return fetch(SOURCES.NASA_NEO.url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data || !data.data) return [];
            var fields = data.fields;
            var desIdx = fields.indexOf('des');
            var distIdx = fields.indexOf('dist');
            var dateIdx = fields.indexOf('cd');
            var vIdx = fields.indexOf('v_rel');
            return data.data.slice(0, 3).map(function(obj) {
                var dist = parseFloat(obj[distIdx]);
                var distKm = Math.round(dist * 149597870.7);
                var name = obj[desIdx];
                var date = obj[dateIdx];
                var vel = parseFloat(obj[vIdx]).toFixed(1);
                return {
                    source: 'NASA CNEOS',
                    type: 'OBJETO CERCANO',
                    icon: '☄️',
                    title: 'Asteroide ' + name + ' — ' + distKm.toLocaleString() + ' km',
                    description: 'Aproximación el ' + date + ' a ' + distKm.toLocaleString() + ' km de la Tierra. Velocidad relativa: ' + vel + ' km/s.',
                    color: '#37474F',
                    link: 'https://cneos.jpl.nasa.gov/ca/',
                    time: Date.now()
                };
            });
        })
        .catch(function() { return []; });
}

// EMSC — Sismos europeos (complementa USGS)
function fetchEMSC() {
    return fetch(SOURCES.EMSC.url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data || !data.features) return [];
            return data.features.slice(0, 10).map(function(f) {
                return {
                    id: 'emsc_' + f.id,
                    source: 'EMSC',
                    mag: f.properties.mag,
                    place: f.properties.flynn_region || f.properties.place || '?',
                    time: f.properties.time ? new Date(f.properties.time).getTime() : Date.now(),
                    depth: f.geometry.coordinates[2],
                    lat: f.geometry.coordinates[1],
                    lon: f.geometry.coordinates[0]
                };
            });
        })
        .catch(function() { return []; });
}v
