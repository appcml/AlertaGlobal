/**
 * seismic-sources.js — AlertaGlobal
 * Módulo dedicado a SISMOS y TSUNAMIS
 * Fuentes oficiales organizadas por país/región
 * Se integra con sources.js — no lo reemplaza, lo complementa
 *
 * COBERTURA:
 *   🌎 Global      : USGS (ya en sources.js, aquí M5+), EMSC, GeoNet (Nueva Zelanda)
 *   🇯🇵 Japón       : P2P Quake (API oficial JMA en JSON), Hi-net NIED vía FDSNWS
 *   🇨🇱 Chile       : CSN / ChileAlerta (ya en sources.js, aquí mejorado)
 *   🇵🇪 Perú        : IGP (Instituto Geofísico del Perú)
 *   🇲🇽 México      : SSN UNAM (Servicio Sismológico Nacional)
 *   🇨🇴 Colombia    : SGC (Servicio Geológico Colombiano)
 *   🇪🇨 Ecuador     : IG-EPN (Instituto Geofísico - Escuela Politécnica Nacional)
 *   🇧🇴 Bolivia     : SENAMHI Bolivia vía USGS regional
 *   🇦🇷 Argentina   : INPRES (Instituto Nacional de Prevención Sísmica)
 *   🇺🇸 EEUU        : USGS ShakeAlert + PNSN (Cascadia)
 *   🇨🇦 Canadá      : Natural Resources Canada
 *   🇬🇧 Europa      : EMSC SeismicPortal + NOA Grecia + IGN España + INGV Italia
 *   🇹🇷 Turquía     : AFAD + Kandilli Observatory vía FDSNWS
 *   🇮🇷 Irán        : IRSC (Iranian Seismological Center)
 *   🇮🇩 Indonesia   : BMKG (Badan Meteorologi, Klimatologi, dan Geofísika)
 *   🇵🇭 Filipinas   : PHIVOLCS vía USGS regional
 *   🇳🇿 Nueva Zelanda: GeoNet (GNS Science)
 *   🇦🇺 Australia   : Geoscience Australia
 *   🌊 Tsunamis     : PTWC + JMA Tsunami + NTWC + GDACS
 */

(function(global) {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    function dist(la1, lo1, la2, lo2) {
        if (typeof window.calcDistance === 'function') return window.calcDistance(la1,lo1,la2,lo2);
        var R=6371, dLat=(la2-la1)*Math.PI/180, dLon=(lo2-lo1)*Math.PI/180;
        var a=Math.sin(dLat/2)*Math.sin(dLat/2)+
              Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*
              Math.sin(dLon/2)*Math.sin(dLon/2);
        return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
    }

    var PROXIES = [
        'https://corsproxy.io/?',
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://thingproxy.freeboard.io/fetch/'
    ];

    async function proxyFetch(url, timeout) {
        timeout = timeout || 12000;
        // Intentar directo primero (para APIs con CORS abierto)
        try {
            var r = await fetch(url, {signal: AbortSignal.timeout(timeout)});
            if (r.ok) return r;
        } catch(e) {}
        // Rotar proxies
        for (var i = 0; i < PROXIES.length; i++) {
            try {
                var r2 = await fetch(PROXIES[i] + encodeURIComponent(url),
                    {signal: AbortSignal.timeout(timeout)});
                if (r2.ok) return r2;
            } catch(e2) { continue; }
        }
        throw new Error('SeismicSources: todos los proxies fallaron para ' + url);
    }

    async function proxyJSON(url, timeout) {
        var r = await proxyFetch(url, timeout);
        return await r.json();
    }

    async function proxyText(url, timeout) {
        var r = await proxyFetch(url, timeout);
        return await r.text();
    }

    function magIcon(mag) {
        if (mag >= 7) return '🔴';
        if (mag >= 6) return '🟠';
        if (mag >= 5) return '🟡';
        if (mag >= 4) return '⚪';
        return '⚫';
    }

    function magColor(mag) {
        if (mag >= 7) return '#ff0000';
        if (mag >= 6) return '#ff4400';
        if (mag >= 5) return '#ff9900';
        if (mag >= 4) return '#ffcc00';
        return '#aaaaaa';
    }

    function magPriority(mag) {
        if (mag >= 8) return 99;
        if (mag >= 7) return 97;
        if (mag >= 6) return 90;
        if (mag >= 5) return 78;
        if (mag >= 4) return 64;
        if (mag >= 3) return 50;
        return 36;
    }

    function makeAlert(id, mag, place, lat, lon, depthKm, timeMs, source, link, userLat, userLon) {
        var distKm = (userLat && lat) ? dist(userLat, userLon, lat, lon) : null;
        return {
            id: id,
            type: 'SISMO',
            icon: magIcon(mag),
            title: 'Sismo M' + mag.toFixed(1),
            description: (place || 'Ubicación desconocida') +
                         (depthKm ? ' · Prof. ' + Math.round(depthKm) + ' km' : '') +
                         (distKm  ? ' · ' + distKm + ' km de ti' : ''),
            lat: lat, lon: lon,
            magnitude: mag, depth: depthKm,
            distKm: distKm,
            time: timeMs ? new Date(timeMs).toLocaleString('es-CL') : '',
            _timeMs: timeMs || 0,
            source: source,
            priority: magPriority(mag),
            color: magColor(mag),
            link: link || ''
        };
    }

    // Parser simple de Atom/RSS para fuentes que no tienen JSON
    function parseAtomFeed(xmlText) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(xmlText, 'application/xml');
        var entries = doc.querySelectorAll('entry, item');
        var results = [];
        entries.forEach(function(e) {
            results.push({
                title:   (e.querySelector('title')   || {}).textContent || '',
                summary: (e.querySelector('summary, description') || {}).textContent || '',
                link:    ((e.querySelector('link')   || {}).getAttribute('href') ||
                          (e.querySelector('link')   || {}).textContent || ''),
                updated: (e.querySelector('updated, pubDate') || {}).textContent || ''
            });
        });
        return results;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DETECCIÓN DE REGIÓN según coordenadas
    // ─────────────────────────────────────────────────────────────────────────

    function detectRegion(lat, lon) {
        if (!lat || !lon) return {code:'GLOBAL'};

        // América del Sur
        if (lat<13 && lat>-57 && lon>-82 && lon<-34) {
            if (lat<-17 && lat>-56 && lon>-76 && lon<-65) return {code:'CL', name:'Chile'};
            if (lat<-0  && lat>-18 && lon>-82 && lon<-68) return {code:'PE', name:'Perú'};
            if (lat>-5  && lat<13  && lon>-80 && lon<-66) return {code:'CO', name:'Colombia'};
            if (lat>-5  && lat<2   && lon>-82 && lon<-75) return {code:'EC', name:'Ecuador'};
            if (lat<-21 && lat>-56 && lon>-74 && lon<-53) return {code:'AR', name:'Argentina'};
            if (lat<-10 && lat>-23 && lon>-70 && lon<-57) return {code:'BO', name:'Bolivia'};
            if (lat<5   && lat>-34 && lon>-74 && lon<-34) return {code:'BR', name:'Brasil'};
            if (lat>-2  && lat<13  && lon>-73 && lon<-59) return {code:'VE', name:'Venezuela'};
            return {code:'SA', name:'Sudamérica'};
        }

        // América del Norte y Centroamérica
        if (lat>14 && lat<72 && lon>-170 && lon<-52) {
            if (lat>24 && lat<50 && lon>-125 && lon<-66) return {code:'US', name:'Estados Unidos'};
            if (lat>48 && lat<84 && lon>-141 && lon<-52) return {code:'CA', name:'Canadá'};
            if (lat>14 && lat<33 && lon>-118 && lon<-86) return {code:'MX', name:'México'};
            if (lat>8  && lat<11 && lon>-86 && lon<-82) return {code:'CR', name:'Costa Rica'};
            return {code:'CAM', name:'Centroamérica'};
        }

        // Japón
        if (lat>24 && lat<46 && lon>122 && lon<148) return {code:'JP', name:'Japón'};

        // Indonesia / Oceanía ecuatorial
        if (lat>-12 && lat<8 && lon>95 && lon<141) return {code:'ID', name:'Indonesia'};

        // Filipinas
        if (lat>4 && lat<22 && lon>116 && lon<128) return {code:'PH', name:'Filipinas'};

        // Nueva Zelanda
        if (lat<-33 && lat>-48 && lon>165 && lon<179) return {code:'NZ', name:'Nueva Zelanda'};

        // Australia
        if (lat<-10 && lat>-44 && lon>113 && lon<154) return {code:'AU', name:'Australia'};

        // Corea del Sur
        if (lat>33 && lat<39 && lon>124 && lon<132) return {code:'KR', name:'Corea del Sur'};

        // China / Asia Oriental (incluyendo Mongolia, Tíbet)
        if (lat>18 && lat<54 && lon>73 && lon<135) return {code:'CN', name:'Asia Oriental'};

        // India / Asia del Sur
        if (lat>6 && lat<37 && lon>68 && lon<97) return {code:'IN', name:'India'};

        // Turquía / Cáucaso
        if (lat>35 && lat<43 && lon>25 && lon<46) return {code:'TR', name:'Turquía'};

        // Irán
        if (lat>25 && lat<40 && lon>44 && lon<64) return {code:'IR', name:'Irán'};

        // Europa (incluye Nórdicos e Islandia)
        if (lat>35 && lat<72 && lon>-30 && lon<45) {
            if (lat>63 && lat<67 && lon>-25 && lon<-13) return {code:'IS', name:'Islandia'};
            if (lat>55 && lat<72 && lon>4  && lon<32)   return {code:'NO', name:'Europa Nórdica'};
            if (lat>35 && lat<44 && lon>-10 && lon<5)   return {code:'ES', name:'España'};
            if (lat>36 && lat<42 && lon>12  && lon<19)  return {code:'IT_S', name:'Italia Sur/Sicilia'};
            if (lat>37 && lat<43 && lon>19  && lon<28)  return {code:'GR', name:'Grecia'};
            if (lat>46 && lat<50 && lon>9   && lon<18)  return {code:'AT', name:'Austria/Europa Central'};
            return {code:'EU', name:'Europa'};
        }

        // Cáucaso (Armenia, Georgia, Azerbaiyán)
        if (lat>38 && lat<44 && lon>38 && lon<51) return {code:'CAU', name:'Cáucaso'};

        // Oriente Medio (Israel, Jordania, Arabia, Siria, Iraq)
        if (lat>12 && lat<38 && lon>25 && lon<60) return {code:'ME', name:'Oriente Medio'};

        // Asia Central (Kazajistán, Uzbekistán, Tayikistán, Kirguistán)
        if (lat>36 && lat<56 && lon>55 && lon<88) return {code:'CA', name:'Asia Central'};

        // Nepal / Himalaya
        if (lat>26 && lat<30 && lon>80 && lon<88) return {code:'NP', name:'Nepal/Himalaya'};

        // Pakistan / Afganistán
        if (lat>23 && lat<38 && lon>60 && lon<75) return {code:'PK', name:'Pakistan'};

        // Rusia
        if (lat>45 && lat<78 && lon>20 && lon<180) return {code:'RU', name:'Rusia'};

        // Africa
        if (lat>-35 && lat<38 && lon>-18 && lon<52) {
            if (lat>-35 && lat<-22 && lon>16 && lon<35) return {code:'ZA', name:'Sudáfrica'};
            if (lat>15  && lat<38  && lon>-6 && lon<10) return {code:'DZ', name:'Magreb/Argelia'};
            return {code:'AF', name:'África'};
        }

        // Pacífico SW (Vanuatu, Tonga, Fiji, Salomón)
        if (lat>-30 && lat<5 && lon>150 && lon<185) return {code:'SWP', name:'Pacífico SW'};

        // Pacífico Central
        if (lon>-180 && lon<-130 && lat>-25 && lat<25) return {code:'PAC', name:'Pacífico Central'};

        return {code:'GLOBAL'};
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FUENTES POR REGIÓN
    // ─────────────────────────────────────────────────────────────────────────

    // ── GLOBAL: USGS M4.5+ últimas 48h (CORS nativo) ──────────────────────
    async function fetchUSGS_Global(userLat, userLon) {
        try {
            var since = new Date(Date.now() - 48*3600000).toISOString();
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=500&minmagnitude=4.5&starttime=' + since;
            var d = await (await fetch(url, {signal: AbortSignal.timeout(12000)})).json();
            return d.features.map(function(f) {
                var p=f.properties, c=f.geometry.coordinates, mag=p.mag||0;
                return makeAlert('usgs2_'+f.id, mag, p.place, c[1], c[0], c[2],
                    p.time, 'USGS', p.url, userLat, userLon);
            });
        } catch(e) { console.error('[Seismic] USGS Global:', e); return []; }
    }

    // ── GLOBAL: USGS M2.5+ cerca del usuario (radio ~500km) ───────────────
    async function fetchUSGS_Local(userLat, userLon) {
        if (!userLat || !userLon) return [];
        try {
            var since = new Date(Date.now() - 24*3600000).toISOString();
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=200&minmagnitude=2.5&starttime=' + since +
                      '&latitude='+userLat+'&longitude='+userLon+'&maxradiuskm=500';
            var d = await (await fetch(url, {signal: AbortSignal.timeout(12000)})).json();
            return d.features.map(function(f) {
                var p=f.properties, c=f.geometry.coordinates, mag=p.mag||0;
                return makeAlert('usgs_l_'+f.id, mag, p.place, c[1], c[0], c[2],
                    p.time, 'USGS (local)', p.url, userLat, userLon);
            });
        } catch(e) { console.error('[Seismic] USGS Local:', e); return []; }
    }

    // ── GLOBAL: EMSC SeismicPortal (Europa + CORS nativo) ─────────────────
    async function fetchEMSC_Global(userLat, userLon) {
        try {
            var since = new Date(Date.now() - 48*3600000).toISOString();
            var url = 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json' +
                      '&orderby=time&limit=200&minmagnitude=4.0&starttime=' + since;
            var d = await (await fetch(url, {signal: AbortSignal.timeout(12000)})).json();
            var items = (d.features||[]);
            return items.map(function(f) {
                var p=f.properties, c=f.geometry.coordinates, mag=parseFloat(p.mag||p.magtype||0);
                var place = [p.flynn_region, p.region, p.country].filter(Boolean).join(', ');
                return makeAlert('emsc2_'+(p.unid||f.id), mag, place,
                    parseFloat(p.lat||0), parseFloat(p.lon||0), parseFloat(p.depth||0),
                    new Date(p.time).getTime(), 'EMSC SeismicPortal',
                    'https://www.seismicportal.eu/eventdetails.html?unid='+(p.unid||''),
                    userLat, userLon);
            });
        } catch(e) { console.error('[Seismic] EMSC:', e); return []; }
    }

    // ── JAPÓN: P2P Quake (API no oficial pero usa datos JMA — JSON, CORS OK) ──
    async function fetchJMA_Japan(userLat, userLon) {
        try {
            // P2PQuake entrega datos sísmicos de JMA en tiempo real
            var url = 'https://api.p2pquake.net/v2/history?codes=551&limit=50';
            var d = await (await fetch(url, {signal: AbortSignal.timeout(12000)})).json();
            var alerts = [];
            (d||[]).forEach(function(ev) {
                var info = ev.earthquake || {};
                var hypo = info.hypocenter || {};
                var mag  = parseFloat(hypo.magnitude) || 0;
                if (mag < 2.0 || isNaN(mag)) return;
                var lat  = parseFloat(hypo.latitude)  || null;
                var lon  = parseFloat(hypo.longitude) || null;
                var dep  = parseFloat(hypo.depth)     || 0;
                var place = hypo.name || 'Japón';
                var timeMs = ev.time ? new Date(ev.time).getTime() : Date.now();
                alerts.push(makeAlert('jma_'+ev.id, mag, place, lat, lon, dep,
                    timeMs, 'JMA (P2PQuake) 🇯🇵', 'https://www.jma.go.jp/bosai/map.html#earthquakes',
                    userLat, userLon));
            });
            console.log('[Seismic] JMA Japón:', alerts.length, 'sismos');
            return alerts;
        } catch(e) { console.error('[Seismic] JMA Japan:', e); return []; }
    }

    // ── JAPÓN: USGS filtrado zona Japón (respaldo) ─────────────────────────
    async function fetchUSGS_Japan(userLat, userLon) {
        try {
            var since = new Date(Date.now() - 48*3600000).toISOString();
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=200&minmagnitude=2.5&starttime=' + since +
                      '&minlatitude=24&maxlatitude=46&minlongitude=122&maxlongitude=148';
            var d = await (await fetch(url, {signal: AbortSignal.timeout(12000)})).json();
            return d.features.map(function(f) {
                var p=f.properties, c=f.geometry.coordinates, mag=p.mag||0;
                return makeAlert('usgs_jp_'+f.id, mag, p.place, c[1], c[0], c[2],
                    p.time, 'USGS (Japón)', p.url, userLat, userLon);
            });
        } catch(e) { console.error('[Seismic] USGS Japan:', e); return []; }
    }

    // ── CHILE: CSN vía ChileAlerta ──────────────────────────────────────────
    async function fetchCSN_Chile(userLat, userLon) {
        try {
            var url = 'https://chilealerta.com/api/query/?user=demo&select=ultimos_sismos_chile&limit=100&minmagnitude=2.0';
            var data = null;
            var proxies = [
                'https://corsproxy.io/?',
                'https://api.codetabs.com/v1/proxy?quest=',
                'https://thingproxy.freeboard.io/fetch/'
            ];
            for (var pi=0; pi<proxies.length; pi++) {
                try {
                    var r = await fetch(proxies[pi]+encodeURIComponent(url),
                        {signal:AbortSignal.timeout(10000)});
                    if (r.ok) { data = await r.json(); break; }
                } catch(pe) { continue; }
            }
            if (!data) return [];
            var sismos = data.ultimos_sismos_Chile || data.ultimos_sismos_chile || [];
            return sismos.filter(function(s) {
                return parseFloat(s.magnitude)>=2.0 && parseFloat(s.magnitude)<10;
            }).map(function(s) {
                var mag  = parseFloat(s.magnitude);
                var sLat = parseFloat(s.latitude)  || null;
                var sLon = parseFloat(s.longitude) || null;
                var dep  = parseFloat(s.depth)     || 0;
                var fechaStr = s.local_time || s.chilean_time || s.utc_time || '';
                var tMs; try { tMs = new Date(fechaStr.replace(' ','T')+'-03:00').getTime(); }
                         catch(e) { tMs = Date.now(); }
                return makeAlert('csn_'+(s.id||tMs), mag,
                    (s.reference||'Chile')+' · Prof.'+Math.round(dep)+'km',
                    sLat, sLon, dep, tMs,
                    'CSN Chile 🇨🇱', s.url||'https://www.csn.uchile.cl',
                    userLat, userLon);
            });
        } catch(e) { console.error('[Seismic] CSN Chile:', e); return []; }
    }

    // ── PERÚ: IGP (Instituto Geofísico del Perú) ───────────────────────────
    async function fetchIGP_Peru(userLat, userLon) {
        try {
            // IGP tiene FDSN compatible con USGS
            var since = new Date(Date.now() - 48*3600000).toISOString();
            var url = 'http://igpdb.igp.gob.pe/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=100&minmagnitude=2.0&starttime=' + since;
            var d = await proxyJSON(url, 12000);
            return (d.features||[]).map(function(f) {
                var p=f.properties, c=f.geometry.coordinates, mag=p.mag||0;
                return makeAlert('igp_'+f.id, mag, p.place||'Perú', c[1], c[0], c[2],
                    p.time, 'IGP Perú 🇵🇪', 'https://ultimosismo.igp.gob.pe',
                    userLat, userLon);
            });
        } catch(e) {
            // Fallback: USGS zona Perú
            try {
                var since2 = new Date(Date.now() - 48*3600000).toISOString();
                var url2 = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                           '&orderby=time&limit=100&minmagnitude=2.0&starttime='+since2+
                           '&minlatitude=-18&maxlatitude=0&minlongitude=-82&maxlongitude=-68';
                var d2 = await (await fetch(url2,{signal:AbortSignal.timeout(10000)})).json();
                return (d2.features||[]).map(function(f) {
                    var p=f.properties,c=f.geometry.coordinates,mag=p.mag||0;
                    return makeAlert('usgs_pe_'+f.id,mag,p.place,c[1],c[0],c[2],
                        p.time,'USGS (Perú)',p.url,userLat,userLon);
                });
            } catch(e2) { console.error('[Seismic] IGP Perú:', e2); return []; }
        }
    }

    // ── MÉXICO: SSN UNAM ───────────────────────────────────────────────────
    async function fetchSSN_Mexico(userLat, userLon) {
        try {
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=100&minmagnitude=2.5&starttime=' +
                      new Date(Date.now()-48*3600000).toISOString() +
                      '&minlatitude=14&maxlatitude=33&minlongitude=-118&maxlongitude=-86';
            var d = await (await fetch(url,{signal:AbortSignal.timeout(12000)})).json();
            var alerts = (d.features||[]).map(function(f) {
                var p=f.properties,c=f.geometry.coordinates,mag=p.mag||0;
                return makeAlert('mx_'+f.id,mag,p.place,c[1],c[0],c[2],
                    p.time,'SSN/USGS México 🇲🇽',p.url,userLat,userLon);
            });
            // También intentar SSN directo
            try {
                var ssnUrl = 'https://api.datos.gob.mx/v2/ssn-sismos?pageSize=50&sort=-fechaHora';
                var ssn = await proxyJSON(ssnUrl, 10000);
                var rows = (ssn.results || []);
                rows.forEach(function(s) {
                    var mag = parseFloat(s.magnitud)||0;
                    if (mag < 2.5) return;
                    var lat = parseFloat(s.latitud)||null;
                    var lon = parseFloat(s.longitud)||null;
                    var tMs = s.fechaHora ? new Date(s.fechaHora).getTime() : Date.now();
                    alerts.push(makeAlert('ssn_'+tMs, mag,
                        s.referencia||'México', lat, lon,
                        parseFloat(s.profundidad)||0, tMs,
                        'SSN UNAM 🇲🇽','https://www.ssn.unam.mx',
                        userLat, userLon));
                });
            } catch(e2) {}
            return alerts;
        } catch(e) { console.error('[Seismic] SSN México:', e); return []; }
    }

    // ── COLOMBIA: SGC ──────────────────────────────────────────────────────
    async function fetchSGC_Colombia(userLat, userLon) {
        try {
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=100&minmagnitude=2.0&starttime=' +
                      new Date(Date.now()-48*3600000).toISOString() +
                      '&minlatitude=-5&maxlatitude=13&minlongitude=-80&maxlongitude=-66';
            var d = await (await fetch(url,{signal:AbortSignal.timeout(12000)})).json();
            return (d.features||[]).map(function(f) {
                var p=f.properties,c=f.geometry.coordinates,mag=p.mag||0;
                return makeAlert('co_'+f.id,mag,p.place,c[1],c[0],c[2],
                    p.time,'SGC/USGS Colombia 🇨🇴',p.url,userLat,userLon);
            });
        } catch(e) { console.error('[Seismic] SGC Colombia:', e); return []; }
    }

    // ── ECUADOR: IG-EPN ────────────────────────────────────────────────────
    async function fetchIGEPN_Ecuador(userLat, userLon) {
        try {
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=100&minmagnitude=2.0&starttime=' +
                      new Date(Date.now()-48*3600000).toISOString() +
                      '&minlatitude=-5&maxlatitude=2&minlongitude=-82&maxlongitude=-75';
            var d = await (await fetch(url,{signal:AbortSignal.timeout(12000)})).json();
            return (d.features||[]).map(function(f) {
                var p=f.properties,c=f.geometry.coordinates,mag=p.mag||0;
                return makeAlert('ec_'+f.id,mag,p.place,c[1],c[0],c[2],
                    p.time,'IG-EPN/USGS Ecuador 🇪🇨',p.url,userLat,userLon);
            });
        } catch(e) { console.error('[Seismic] IG-EPN Ecuador:', e); return []; }
    }

    // ── ARGENTINA: INPRES ──────────────────────────────────────────────────
    async function fetchINPRES_Argentina(userLat, userLon) {
        try {
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=100&minmagnitude=2.0&starttime=' +
                      new Date(Date.now()-48*3600000).toISOString() +
                      '&minlatitude=-56&maxlatitude=-21&minlongitude=-74&maxlongitude=-53';
            var d = await (await fetch(url,{signal:AbortSignal.timeout(12000)})).json();
            return (d.features||[]).map(function(f) {
                var p=f.properties,c=f.geometry.coordinates,mag=p.mag||0;
                return makeAlert('ar_'+f.id,mag,p.place,c[1],c[0],c[2],
                    p.time,'INPRES/USGS Argentina 🇦🇷',p.url,userLat,userLon);
            });
        } catch(e) { console.error('[Seismic] INPRES Argentina:', e); return []; }
    }

    // ── EEUU: USGS ShakeAlert (zona Oeste + Alaska + Hawaii) ─────────────
    async function fetchUSGS_USA(userLat, userLon) {
        try {
            var since = new Date(Date.now() - 48*3600000).toISOString();
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=200&minmagnitude=2.0&starttime=' + since +
                      '&minlatitude=18&maxlatitude=72&minlongitude=-170&maxlongitude=-66';
            var d = await (await fetch(url,{signal:AbortSignal.timeout(12000)})).json();
            return (d.features||[]).map(function(f) {
                var p=f.properties,c=f.geometry.coordinates,mag=p.mag||0;
                return makeAlert('us_'+f.id,mag,p.place,c[1],c[0],c[2],
                    p.time,'USGS ShakeAlert 🇺🇸',p.url,userLat,userLon);
            });
        } catch(e) { console.error('[Seismic] USGS USA:', e); return []; }
    }

    // ── CANADÁ: Natural Resources Canada ──────────────────────────────────
    async function fetchNRCan_Canada(userLat, userLon) {
        try {
            var since = new Date(Date.now() - 48*3600000).toISOString();
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=100&minmagnitude=2.0&starttime=' + since +
                      '&minlatitude=48&maxlatitude=84&minlongitude=-141&maxlongitude=-52';
            var d = await (await fetch(url,{signal:AbortSignal.timeout(12000)})).json();
            return (d.features||[]).map(function(f) {
                var p=f.properties,c=f.geometry.coordinates,mag=p.mag||0;
                return makeAlert('ca_'+f.id,mag,p.place,c[1],c[0],c[2],
                    p.time,'NRCan/USGS Canadá 🇨🇦',p.url,userLat,userLon);
            });
        } catch(e) { console.error('[Seismic] NRCan Canadá:', e); return []; }
    }

    // ── TURQUÍA: AFAD + Kandilli ───────────────────────────────────────────
    async function fetchAFAD_Turkey(userLat, userLon) {
        try {
            var since = new Date(Date.now() - 48*3600000).toISOString();
            var url2 = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                       '&orderby=time&limit=100&minmagnitude=2.0&starttime=' + since +
                       '&minlatitude=35&maxlatitude=43&minlongitude=25&maxlongitude=46';
            var d = await (await fetch(url2,{signal:AbortSignal.timeout(12000)})).json();
            return (d.features||[]).map(function(f) {
                var p=f.properties,c=f.geometry.coordinates,mag=p.mag||0;
                return makeAlert('tr_'+f.id,mag,p.place,c[1],c[0],c[2],
                    p.time,'AFAD/USGS Turquía 🇹🇷',p.url,userLat,userLon);
            });
        } catch(e) { console.error('[Seismic] AFAD Turquía:', e); return []; }
    }

    // ── IRÁN: IRSC ────────────────────────────────────────────────────────
    async function fetchIRSC_Iran(userLat, userLon) {
        try {
            var since = new Date(Date.now() - 48*3600000).toISOString();
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=100&minmagnitude=2.0&starttime=' + since +
                      '&minlatitude=25&maxlatitude=40&minlongitude=44&maxlongitude=64';
            var d = await (await fetch(url,{signal:AbortSignal.timeout(12000)})).json();
            return (d.features||[]).map(function(f) {
                var p=f.properties,c=f.geometry.coordinates,mag=p.mag||0;
                return makeAlert('ir_'+f.id,mag,p.place,c[1],c[0],c[2],
                    p.time,'IRSC/USGS Irán 🇮🇷',p.url,userLat,userLon);
            });
        } catch(e) { console.error('[Seismic] IRSC Irán:', e); return []; }
    }

    // ── INDONESIA: BMKG ────────────────────────────────────────────────────
    async function fetchBMKG_Indonesia(userLat, userLon) {
        try {
            // BMKG tiene API JSON pública
            var url = 'https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json';
            var d = await proxyJSON(url, 12000);
            var infogempa = (d.Infogempa && d.Infogempa.gempa) || [];
            if (!Array.isArray(infogempa)) infogempa = [infogempa];
            return infogempa.map(function(g) {
                var mag  = parseFloat(g.Magnitude) || 0;
                var lat  = parseFloat(g.Lintang)   || null;
                var lon  = parseFloat(g.Bujur)     || null;
                var dep  = parseFloat(g.Kedalaman) || 0;
                var tMs  = g.DateTime ? new Date(g.DateTime).getTime() : Date.now();
                return makeAlert('bmkg_'+tMs, mag,
                    g.Wilayah||'Indonesia', lat, lon, dep, tMs,
                    'BMKG Indonesia 🇮🇩',
                    'https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg',
                    userLat, userLon);
            });
        } catch(e) {
            // Fallback USGS zona Indonesia
            try {
                var since = new Date(Date.now()-48*3600000).toISOString();
                var url2 = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                           '&orderby=time&limit=100&minmagnitude=2.5&starttime='+since+
                           '&minlatitude=-12&maxlatitude=8&minlongitude=95&maxlongitude=141';
                var d2 = await (await fetch(url2,{signal:AbortSignal.timeout(10000)})).json();
                return (d2.features||[]).map(function(f) {
                    var p=f.properties,c=f.geometry.coordinates,mag=p.mag||0;
                    return makeAlert('id_'+f.id,mag,p.place,c[1],c[0],c[2],
                        p.time,'USGS (Indonesia)',p.url,userLat,userLon);
                });
            } catch(e2) { console.error('[Seismic] BMKG Indonesia:', e2); return []; }
        }
    }

    // ── FILIPINAS: PHIVOLCS ────────────────────────────────────────────────
    async function fetchPHIVOLCS_Philippines(userLat, userLon) {
        try {
            var since = new Date(Date.now() - 48*3600000).toISOString();
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=100&minmagnitude=2.0&starttime=' + since +
                      '&minlatitude=4&maxlatitude=22&minlongitude=116&maxlongitude=128';
            var d = await (await fetch(url,{signal:AbortSignal.timeout(12000)})).json();
            return (d.features||[]).map(function(f) {
                var p=f.properties,c=f.geometry.coordinates,mag=p.mag||0;
                return makeAlert('ph_'+f.id,mag,p.place,c[1],c[0],c[2],
                    p.time,'PHIVOLCS/USGS Filipinas 🇵🇭',p.url,userLat,userLon);
            });
        } catch(e) { console.error('[Seismic] PHIVOLCS:', e); return []; }
    }

    // ── NUEVA ZELANDA: GeoNet (GNS Science) — CORS nativo ──────────────────
    async function fetchGeoNet_NZ(userLat, userLon) {
        try {
            var url = 'https://api.geonet.org.nz/quake?MMI=-1';
            var d = await (await fetch(url, {
                signal: AbortSignal.timeout(12000),
                headers: {'Accept': 'application/vnd.geo+json'}
            })).json();
            return (d.features||[]).map(function(f) {
                var p=f.properties,c=f.geometry.coordinates,mag=parseFloat(p.magnitude)||0;
                return makeAlert('nz_'+p.publicID, mag,
                    p.locality||'Nueva Zelanda', c[1], c[0], parseFloat(p.depth)||0,
                    new Date(p.time).getTime(),
                    'GeoNet NZ 🇳🇿', 'https://www.geonet.org.nz/earthquake/'+p.publicID,
                    userLat, userLon);
            });
        } catch(e) { console.error('[Seismic] GeoNet NZ:', e); return []; }
    }

    // ── AUSTRALIA: Geoscience Australia ────────────────────────────────────
    async function fetchGeoScience_AU(userLat, userLon) {
        try {
            var since = new Date(Date.now() - 48*3600000).toISOString();
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=100&minmagnitude=2.0&starttime=' + since +
                      '&minlatitude=-44&maxlatitude=-10&minlongitude=113&maxlongitude=154';
            var d = await (await fetch(url,{signal:AbortSignal.timeout(12000)})).json();
            return (d.features||[]).map(function(f) {
                var p=f.properties,c=f.geometry.coordinates,mag=p.mag||0;
                return makeAlert('au_'+f.id,mag,p.place,c[1],c[0],c[2],
                    p.time,'GA/USGS Australia 🇦🇺',p.url,userLat,userLon);
            });
        } catch(e) { console.error('[Seismic] GA Australia:', e); return []; }
    }

    // ── GRECIA: NOA ────────────────────────────────────────────────────────
    async function fetchNOA_Greece(userLat, userLon) {
        try {
            var since = new Date(Date.now() - 48*3600000).toISOString();
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=100&minmagnitude=2.0&starttime=' + since +
                      '&minlatitude=34&maxlatitude=42&minlongitude=19&maxlongitude=30';
            var d = await (await fetch(url,{signal:AbortSignal.timeout(12000)})).json();
            return (d.features||[]).map(function(f) {
                var p=f.properties,c=f.geometry.coordinates,mag=p.mag||0;
                return makeAlert('gr_'+f.id,mag,p.place,c[1],c[0],c[2],
                    p.time,'NOA/USGS Grecia 🇬🇷',p.url,userLat,userLon);
            });
        } catch(e) { console.error('[Seismic] NOA Grecia:', e); return []; }
    }

    // ── ITALIA: INGV ───────────────────────────────────────────────────────
    async function fetchINGV_Italy(userLat, userLon) {
        try {
            var since = new Date(Date.now() - 48*3600000).toISOString();
            var url = 'https://webservices.ingv.it/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=100&minmagnitude=2.0&starttime=' + since;
            var d = await (await fetch(url,{signal:AbortSignal.timeout(12000)})).json();
            return (d.features||[]).map(function(f) {
                var p=f.properties,c=f.geometry.coordinates,mag=parseFloat(p.mag||0);
                var place = p['flynn_region']||p.place||'Italia';
                return makeAlert('ingv_'+f.id,mag,place,c[1],c[0],c[2],
                    p.time ? new Date(p.time).getTime() : Date.now(),
                    'INGV Italia 🇮🇹',
                    'https://terremoti.ingv.it',
                    userLat,userLon);
            });
        } catch(e) { console.error('[Seismic] INGV Italia:', e); return []; }
    }

    // ── ESPAÑA: IGN ────────────────────────────────────────────────────────
    async function fetchIGN_Spain(userLat, userLon) {
        try {
            var since = new Date(Date.now() - 48*3600000).toISOString();
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                      '&orderby=time&limit=100&minmagnitude=1.5&starttime=' + since +
                      '&minlatitude=35&maxlatitude=44&minlongitude=-10&maxlongitude=5';
            var d = await (await fetch(url,{signal:AbortSignal.timeout(12000)})).json();
            return (d.features||[]).map(function(f) {
                var p=f.properties,c=f.geometry.coordinates,mag=p.mag||0;
                return makeAlert('es_'+f.id,mag,p.place,c[1],c[0],c[2],
                    p.time,'IGN/USGS España 🇪🇸',p.url,userLat,userLon);
            });
        } catch(e) { console.error('[Seismic] IGN España:', e); return []; }
    }

    // ── TSUNAMIS: PTWC (Pacific Tsunami Warning Center) ────────────────────
    async function fetchPTWC_Tsunami(userLat, userLon) {
        try {
            var url = 'https://www.tsunami.gov/events/xml/PHEBAtom.xml';
            var txt = await proxyText(url, 12000);
            var items = parseAtomFeed(txt);
            var cutoffTsunami = Date.now() - 24*3600000;
            return items.map(function(item, i) {
                var title = item.title || 'Alerta Tsunami PTWC';
                var isTsunami = /tsunami/i.test(title);
                var mag = 0;
                var mMatch = title.match(/M\s*([\d.]+)/i);
                if (mMatch) mag = parseFloat(mMatch[1]);
                // Usar la fecha del item para generar ID estable (evita duplicados entre recargas)
                var itemTime = item.updated ? new Date(item.updated).getTime() : Date.now();
                return {
                    id: 'ptwc_s_' + itemTime,
                    type: isTsunami ? 'TSUNAMI' : 'SISMO',
                    icon: isTsunami ? '🌊' : magIcon(mag),
                    title: (isTsunami ? '🌊 Tsunami PTWC: ' : 'PTWC: ') + title.substring(0,100),
                    description: item.summary ? item.summary.substring(0,200) : '',
                    lat: null, lon: null,
                    magnitude: mag,
                    distKm: null,
                    time: item.updated ? new Date(item.updated).toLocaleString('es-CL') : '',
                    _timeMs: item.updated ? new Date(item.updated).getTime() : Date.now(),
                    source: 'PTWC 🌊',
                    priority: isTsunami ? 99 : magPriority(mag),
                    color: isTsunami ? '#0000ff' : magColor(mag),
                    link: item.link || 'https://www.tsunami.gov'
                };
            });
        } catch(e) { console.error('[Seismic] PTWC:', e); return []; }
    }

    // ── TSUNAMIS: JMA Tsunami Feed (Japón) ─────────────────────────────────
    async function fetchJMA_Tsunami(userLat, userLon) {
        try {
            var url = 'https://api.p2pquake.net/v2/history?codes=552&limit=10';
            var d = await (await fetch(url,{signal:AbortSignal.timeout(12000)})).json();
            // ⚠️ FILTRO CRÍTICO: la API devuelve historial sin límite de tiempo.
            // Las alertas de tsunami JMA son activas solo durante horas — máximo 12h.
            var cutoff12h = Date.now() - 12 * 3600000;
            return (d||[])
                .filter(function(ev) {
                    // Filtrar eventos más antiguos de 12 horas
                    var evTime = ev.time ? new Date(ev.time).getTime() : 0;
                    return evTime >= cutoff12h;
                })
                .map(function(ev) {
                    var areas = ev.areas || [];
                    var desc = areas.slice(0,5).map(function(a){
                        return (a.name||'')+(a.maxScale?' (Esc.'+a.maxScale+')':'');
                    }).join(', ');
                    return {
                        id: 'jma_tsun_' + (ev.id || ev.code || new Date(ev.time).getTime()),
                        type: 'TSUNAMI',
                        icon: '🌊',
                        title: '🌊 Alerta Tsunami JMA — Japón',
                        description: desc || 'Ver detalles en JMA',
                        lat: null, lon: null,
                        distKm: null,
                        time: ev.time ? new Date(ev.time).toLocaleString('es-CL') : '',
                        _timeMs: ev.time ? new Date(ev.time).getTime() : Date.now(),
                        source: 'JMA Tsunami 🇯🇵🌊',
                        priority: 99,
                        color: '#0000ff',
                        link: 'https://www.jma.go.jp/bosai/map.html#tsunamiforecast'
                    };
                });
        } catch(e) { console.error('[Seismic] JMA Tsunami:', e); return []; }
    }

    // ── TSUNAMIS: NTWC (National Tsunami Warning Center — Alaska/EEUU) ─────
    async function fetchNTWC_Tsunami(userLat, userLon) {
        try {
            var url = 'https://www.tsunami.gov/events/xml/NWSeAtom.xml';
            var txt = await proxyText(url, 12000);
            var items = parseAtomFeed(txt);
            return items.filter(function(item) {
                return /tsunami/i.test(item.title) || /tsunami/i.test(item.summary);
            }).map(function(item, i) {
                return {
                    id: 'ntwc_'+(item.updated ? new Date(item.updated).getTime() : i),
                    type: 'TSUNAMI',
                    icon: '🌊',
                    title: '🌊 NTWC: ' + (item.title||'').substring(0,100),
                    description: (item.summary||'').substring(0,200),
                    lat: null, lon: null, distKm: null,
                    time: item.updated ? new Date(item.updated).toLocaleString('es-CL') : '',
                    _timeMs: item.updated ? new Date(item.updated).getTime() : Date.now(),
                    source: 'NTWC (Alaska) 🌊',
                    priority: 99,
                    color: '#0000ff',
                    link: item.link || 'https://www.tsunami.gov'
                };
            });
        } catch(e) { console.error('[Seismic] NTWC:', e); return []; }
    }

    // ── SHOA Chile: Tsunamis Pacífico Sur ──────────────────────────────────
    async function fetchSHOA_Tsunami(userLat, userLon) {
        try {
            var url = 'https://www.shoa.cl/php/rss.php';
            var txt = await proxyText(url, 12000);
            var items = parseAtomFeed(txt);
            return items.filter(function(item) {
                return /tsunami|maremoto|alerta|sismo/i.test(item.title+item.summary);
            }).map(function(item, i) {
                var isTsunami = /tsunami|maremoto/i.test(item.title+item.summary);
                return {
                    id: 'shoa_'+(item.updated ? new Date(item.updated).getTime() : i),
                    type: isTsunami ? 'TSUNAMI' : 'SISMO',
                    icon: isTsunami ? '🌊' : '🔴',
                    title: (isTsunami ? '🌊 ' : '') + 'SHOA: ' + (item.title||'').substring(0,100),
                    description: (item.summary||'').substring(0,200),
                    lat: null, lon: null, distKm: null,
                    time: item.updated ? new Date(item.updated).toLocaleString('es-CL') : '',
                    _timeMs: item.updated ? new Date(item.updated).getTime() : Date.now(),
                    source: 'SHOA Chile 🇨🇱🌊',
                    priority: isTsunami ? 99 : 85,
                    color: isTsunami ? '#0000ff' : '#ff0000',
                    link: item.link || 'https://www.shoa.cl'
                };
            });
        } catch(e) { console.error('[Seismic] SHOA:', e); return []; }
    }


    // ── COREA DEL SUR: KMA — Korea Meteorological Administration ──────────
    async function fetchKMA_Korea(userLat, userLon) {
        try {
            // KMA ofrece datos sísmicos recientes en JSON
            var url = 'https://www.weather.go.kr/w/eqk-vol/eqk/recent-eqk.do';
            var txt = await proxyText(url, 12000);
            var json = JSON.parse(txt);
            var list = json.recentEqkList || json.list || json.data || [];
            return list.slice(0, 20).map(function(ev) {
                var mag = parseFloat(ev.magMl || ev.magnitude || ev.mag || 0);
                var lat = parseFloat(ev.lat || ev.latitude || 0);
                var lon = parseFloat(ev.lon || ev.longitude || 0);
                var timeMs = ev.tmFc ? new Date(ev.tmFc).getTime()
                           : ev.originTime ? new Date(ev.originTime).getTime()
                           : Date.now();
                var place = ev.locName || ev.location || '한국 (Corea)';
                if (!lat || !lon) return null;
                return makeAlert('kma_'+ev.eqkNo||timeMs, mag, place, lat, lon,
                    parseFloat(ev.dep||0), timeMs, 'KMA 🇰🇷', 'https://www.weather.go.kr/w/eqk-vol/eqk/recent-eqk.do', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] KMA Korea:', e); return []; }
    }

    // ── CHINA: CEIC — China Earthquake Information Center ─────────────────
    async function fetchCEIC_China(userLat, userLon) {
        try {
            // CEIC API JSON pública
            var url = 'http://www.ceic.ac.cn/ajax/speedsearch?mark=ceic&typeAll=1&page=1&pageSize=20';
            var d = await proxyJSON(url, 12000);
            var list = d.shuju || d.data || d.list || [];
            return list.map(function(ev) {
                var mag  = parseFloat(ev.M || ev.MAGNITUDE || ev.mag || 0);
                var lat  = parseFloat(ev.EPI_LAT || ev.lat || 0);
                var lon  = parseFloat(ev.EPI_LON || ev.lon || 0);
                var place = ev.LOCATION_C || ev.EPI_DESC || '中国 (China)';
                var timeMs = ev.O_TIME ? new Date(ev.O_TIME.replace(/\//g,'-')).getTime() : Date.now();
                if (!lat || !lon) return null;
                return makeAlert('ceic_'+ev.EQ_ID||timeMs, mag, place, lat, lon,
                    parseFloat(ev.EPI_DEPTH||0), timeMs, 'CEIC 🇨🇳', 'https://www.ceic.ac.cn/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] CEIC China:', e); return []; }
    }

    // ── INDIA: NCS — National Center for Seismology ────────────────────────
    async function fetchNCS_India(userLat, userLon) {
        try {
            // NCS India publica RSS/feed de sismos recientes
            var url = 'https://riseq.seismo.gov.in/riseq/earthquake/recentEqList';
            var d = await proxyJSON(url, 12000);
            var list = d.eqList || d.data || d || [];
            if (!Array.isArray(list)) return [];
            return list.slice(0, 20).map(function(ev) {
                var mag  = parseFloat(ev.magnitude || ev.mag || 0);
                var lat  = parseFloat(ev.latitude  || ev.lat || 0);
                var lon  = parseFloat(ev.longitude || ev.lon || 0);
                var place = ev.location || ev.region || 'India';
                var timeMs = ev.datetime ? new Date(ev.datetime).getTime() : Date.now();
                if (!lat || !lon) return null;
                return makeAlert('ncs_'+timeMs, mag, place, lat, lon,
                    parseFloat(ev.depth||0), timeMs, 'NCS India 🇮🇳', 'https://seismo.gov.in/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] NCS India:', e); return []; }
    }

    // ── GFZ POTSDAM: global M4.5+ énfasis Europa/Asia Central ────────────
    async function fetchGFZ_Potsdam(userLat, userLon) {
        try {
            var url = 'https://geofon.gfz-potsdam.de/fdsnws/event/1/query?format=geojson&limit=50&minmag=4.5&orderby=time';
            var d = await proxyJSON(url, 12000);
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                var mag = parseFloat(p.mag || 0);
                var lat = c[1], lon = c[0], dep = c[2] || 0;
                var timeMs = p.time || Date.now();
                return makeAlert('gfz_'+f.id, mag, p.place||'', lat, lon, dep,
                    timeMs, 'GFZ Potsdam 🇩🇪', p.url||'https://geofon.gfz-potsdam.de/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] GFZ Potsdam:', e); return []; }
    }

    // ── ORFEUS/EIDA: red europea consolidada ──────────────────────────────
    async function fetchORFEUS_Europe(userLat, userLon) {
        try {
            var url = 'https://www.orfeus-eu.org/fdsnws/event/1/query?format=geojson&limit=50&minmag=3.0&orderby=time&maxlatitude=72&minlatitude=28&maxlongitude=45&minlongitude=-15';
            var d = await proxyJSON(url, 12000);
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                var mag = parseFloat(p.mag || 0);
                return makeAlert('orfeus_'+f.id, mag, p.place||'Europa', c[1], c[0], c[2]||0,
                    p.time||Date.now(), 'ORFEUS/EIDA 🇪🇺', 'https://www.orfeus-eu.org/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] ORFEUS:', e); return []; }
    }

    // ── BGS UK: British Geological Survey ─────────────────────────────────
    async function fetchBGS_UK(userLat, userLon) {
        try {
            var url = 'https://www.bgs.ac.uk/feeds/SmallMagEarthquakes.xml';
            var txt = await proxyText(url, 12000);
            var items = parseAtomFeed(txt);
            return items.map(function(item, i) {
                var mag = 0, lat = null, lon = null;
                var mMatch = (item.title||'').match(/ML?\s*([\d.]+)/i);
                if (mMatch) mag = parseFloat(mMatch[1]);
                // Coords suelen venir en el summary como "Lat: X Lon: Y"
                var latM = (item.summary||'').match(/[Ll]at[itude]*:?\s*([\d.-]+)/);
                var lonM = (item.summary||'').match(/[Ll]on[gitude]*:?\s*([\d.-]+)/);
                if (latM) lat = parseFloat(latM[1]);
                if (lonM) lon = parseFloat(lonM[1]);
                var timeMs = item.updated ? new Date(item.updated).getTime() : Date.now();
                return makeAlert('bgs_'+timeMs+'_'+i, mag, item.title||'UK', lat, lon, 0,
                    timeMs, 'BGS UK 🇬🇧', 'https://www.bgs.ac.uk/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] BGS UK:', e); return []; }
    }

    // ── ALASKA EQ CENTER: UAF — zona muy activa ────────────────────────────
    async function fetchAEC_Alaska(userLat, userLon) {
        try {
            var url = 'https://earthquake.alaska.edu/fdsnws/event/1/query?format=geojson&limit=50&minmag=2.5&orderby=time&minlatitude=51&maxlatitude=72&minlongitude=-180&maxlongitude=-129';
            var d = await proxyJSON(url, 12000);
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                var mag = parseFloat(p.mag || 0);
                return makeAlert('aec_'+f.id, mag, p.place||'Alaska', c[1], c[0], c[2]||0,
                    p.time||Date.now(), 'AEC Alaska 🇺🇸', 'https://earthquake.alaska.edu/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] AEC Alaska:', e); return []; }
    }

    // ── FUNVISIS: Venezuela — Fundación Venezolana de Investigaciones Sism. ─
    async function fetchFUNVISIS_Venezuela(userLat, userLon) {
        try {
            var url = 'http://www.funvisis.gob.ve/archivos/json/ultimos_sismos.json';
            var d = await proxyJSON(url, 12000);
            var list = d.sismos || d.data || d || [];
            if (!Array.isArray(list)) return [];
            return list.slice(0, 20).map(function(ev) {
                var mag  = parseFloat(ev.magnitud || ev.mag || ev.M || 0);
                var lat  = parseFloat(ev.latitud || ev.lat || 0);
                var lon  = parseFloat(ev.longitud || ev.lon || 0);
                var place = ev.localidad || ev.lugar || 'Venezuela';
                var timeMs = ev.fecha_hora ? new Date(ev.fecha_hora).getTime() : Date.now();
                if (!lat || !lon) return null;
                return makeAlert('funvisis_'+timeMs, mag, place, lat, lon,
                    parseFloat(ev.profundidad||0), timeMs, 'FUNVISIS 🇻🇪', 'http://www.funvisis.gob.ve/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] FUNVISIS Venezuela:', e); return []; }
    }

    // ── OVSICORI: Costa Rica — Centroamérica ──────────────────────────────
    async function fetchOVSICORI_CostaRica(userLat, userLon) {
        try {
            // OVSICORI publica feed RSS con sismos recientes
            var url = 'https://www.ovsicori.una.ac.cr/index.php?format=feed&type=rss';
            var txt = await proxyText(url, 12000);
            var items = parseAtomFeed(txt);
            return items.filter(function(item) {
                return /sismo|terremoto|temblor|magnitud|M\s*[\d.]/i.test((item.title||'')+(item.summary||''));
            }).map(function(item, i) {
                var mag = 0;
                var mMatch = ((item.title||'')+(item.summary||'')).match(/M[Ll]?[wW]?[\s:]*([\d.]+)/);
                if (mMatch) mag = parseFloat(mMatch[1]);
                var lat = null, lon = null;
                var latM = (item.summary||'').match(/[Ll]at[itud]*:?\s*([\d.-]+)/);
                var lonM = (item.summary||'').match(/[Ll]on[gitud]*:?\s*([\d.-]+)/);
                if (latM) lat = parseFloat(latM[1]);
                if (lonM) lon = parseFloat(lonM[1]);
                var timeMs = item.updated ? new Date(item.updated).getTime() : Date.now();
                return makeAlert('ovsicori_'+timeMs+'_'+i, mag, item.title||'Costa Rica', lat, lon, 0,
                    timeMs, 'OVSICORI 🇨🇷', 'https://www.ovsicori.una.ac.cr/', userLat, userLon);
            }).filter(function(a) { return a && a.magnitude >= 1; });
        } catch(e) { console.error('[Seismic] OVSICORI:', e); return []; }
    }

    // ── IRIS FDSN: global M4.5+ red académica internacional ──────────────
    async function fetchIRIS_Global(userLat, userLon) {
        try {
            var url = 'https://service.iris.edu/fdsnws/event/1/query?format=geojson&limit=50&minmagnitude=4.5&orderby=time&nodata=404';
            var d = await proxyJSON(url, 12000);
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                var mag = parseFloat(p.mag || 0);
                return makeAlert('iris_'+f.id, mag, p.place||'Global', c[1], c[0], c[2]||0,
                    p.time||Date.now(), 'IRIS FDSN 🌍', 'https://service.iris.edu/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] IRIS FDSN:', e); return []; }
    }

    // ── BRASIL: USP/RSBR — Rede Sismográfica Brasileira ──────────────────
    async function fetchRSBR_Brasil(userLat, userLon) {
        try {
            var url = 'http://rsbr.gov.br/fdsnws/event/1/query?format=geojson&limit=30&minmag=2.0&orderby=time&minlatitude=-34&maxlatitude=5&minlongitude=-74&maxlongitude=-34';
            var d = await proxyJSON(url, 12000);
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                var mag = parseFloat(p.mag || 0);
                return makeAlert('rsbr_'+f.id, mag, p.place||'Brasil', c[1], c[0], c[2]||0,
                    p.time||Date.now(), 'RSBR Brasil 🇧🇷', 'http://rsbr.gov.br/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] RSBR Brasil:', e); return []; }
    }


    // ══════════════════════════════════════════════════════════════════════════
    // NUEVAS FUENTES: RUSIA, AFRICA, CAUCASO, ASIA CENTRAL, ORIENTE MEDIO
    // ══════════════════════════════════════════════════════════════════════════

    // ── RUSIA: GS RAS — Geophysical Survey Russian Academy of Sciences ──────
    // Cubre Siberia, Kamchatka, Sakhalin, Urales, Baikal — zonas muy activas
    async function fetchGSRAS_Russia(userLat, userLon) {
        try {
            // GS RAS publica catálogo en JSON via su portal moderno
            var url = 'http://ceme.gsras.ru/cgi-bin/geoJSON_seism.pl?&b=40&t=90&l=19&r=195&m=2.5&n=100';
            var d = await proxyJSON(url, 12000);
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties || {};
                var c = f.geometry && f.geometry.coordinates;
                if (!c) return null;
                var mag  = parseFloat(p.M || p.mag || p.magnitude || 0);
                var dep  = parseFloat(p.H || p.depth || p.dep || 0);
                var place = p.Location || p.place || p.region || 'Rusia';
                var timeMs = p.Date ? new Date(p.Date).getTime()
                           : p.time ? new Date(p.time).getTime() : Date.now();
                return makeAlert('gsras_' + (p.id || timeMs), mag, place,
                    c[1], c[0], dep, timeMs,
                    'GS RAS 🇷🇺', 'http://www.gsras.ru/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] GS RAS Russia:', e); return []; }
    }

    // ── RUSIA Kamchatka: USGS filtrado zona Kamchatka/Kuril ────────────────
    async function fetchUSGS_Kamchatka(userLat, userLon) {
        try {
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.5&limit=50&orderby=time&minlatitude=45&maxlatitude=65&minlongitude=140&maxlongitude=170';
            var d = await (await fetch(url, {signal: AbortSignal.timeout(10000)})).json();
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                return makeAlert('usgs_kamt_' + f.id, parseFloat(p.mag||0),
                    p.place||'Kamchatka', c[1], c[0], c[2]||0,
                    p.time||Date.now(), 'USGS Kamchatka 🌋', p.url||'', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] USGS Kamchatka:', e); return []; }
    }

    // ── SIBERIA / BAIKAL: USGS filtrado zona Siberia ────────────────────────
    async function fetchUSGS_Siberia(userLat, userLon) {
        try {
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=3.0&limit=50&orderby=time&minlatitude=48&maxlatitude=75&minlongitude=55&maxlongitude=140';
            var d = await (await fetch(url, {signal: AbortSignal.timeout(10000)})).json();
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                return makeAlert('usgs_sib_' + f.id, parseFloat(p.mag||0),
                    p.place||'Siberia', c[1], c[0], c[2]||0,
                    p.time||Date.now(), 'USGS Siberia 🇷🇺', p.url||'', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] USGS Siberia:', e); return []; }
    }

    // ── AFRICA DEL NORTE: CRAAG — Argelia + Magreb ─────────────────────────
    async function fetchCRAAG_Algeria(userLat, userLon) {
        try {
            var url = 'https://www.craag.dz/Seismicite/sismicite_actuelle.json';
            var d = await proxyJSON(url, 12000);
            var list = d.sismes || d.data || d.earthquakes || (Array.isArray(d) ? d : []);
            return list.map(function(ev) {
                var mag  = parseFloat(ev.magnitude || ev.mag || ev.M || 0);
                var lat  = parseFloat(ev.latitude  || ev.lat || 0);
                var lon  = parseFloat(ev.longitude || ev.lon || 0);
                var place = ev.region || ev.lieu || ev.location || 'Argelia';
                var timeMs = ev.date ? new Date(ev.date).getTime() : Date.now();
                if (!lat || !lon) return null;
                return makeAlert('craag_' + (ev.id || timeMs), mag, place,
                    lat, lon, parseFloat(ev.depth||ev.profondeur||0), timeMs,
                    'CRAAG 🇩🇿', 'https://www.craag.dz/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] CRAAG Algeria:', e); return []; }
    }

    // ── AFRICA: EMSC filtrado por zona África ──────────────────────────────
    // África del Norte + Rift Valley + Africa Austral vía EMSC
    async function fetchEMSC_Africa(userLat, userLon) {
        try {
            var url = 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=50&minmag=3.0&orderby=time&minlatitude=-35&maxlatitude=38&minlongitude=-18&maxlongitude=52';
            var d = await proxyJSON(url, 12000);
            var list = d.earthquakes || (d.features ? d.features.map(function(f){ return {properties: f.properties, geometry: f.geometry}; }) : []);
            // El formato EMSC /fdsnws devuelve GeoJSON
            var feats = d.features || [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                return makeAlert('emsc_af_' + f.id, parseFloat(p.mag||0),
                    p.flynn_region || p.place || 'África', c[1], c[0], c[2]||0,
                    p.time||Date.now(), 'EMSC África 🌍', 'https://www.emsc-csem.org/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] EMSC Africa:', e); return []; }
    }

    // ── AFRICA RIFT VALLEY: USGS filtrado zona Rift ────────────────────────
    async function fetchUSGS_Africa(userLat, userLon) {
        try {
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=3.0&limit=50&orderby=time&minlatitude=-35&maxlatitude=38&minlongitude=-18&maxlongitude=52';
            var d = await (await fetch(url, {signal: AbortSignal.timeout(10000)})).json();
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                return makeAlert('usgs_af_' + f.id, parseFloat(p.mag||0),
                    p.place||'África', c[1], c[0], c[2]||0,
                    p.time||Date.now(), 'USGS África 🌍', p.url||'', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] USGS Africa:', e); return []; }
    }

    // ── SUDÁFRICA: CGS — Council for Geoscience ────────────────────────────
    async function fetchCGS_SouthAfrica(userLat, userLon) {
        try {
            var url = 'https://www.geoscience.org.za/cgs-earthquake-data/index.php?format=json&limit=20';
            var d = await proxyJSON(url, 12000);
            var list = d.earthquakes || d.data || (Array.isArray(d) ? d : []);
            return list.map(function(ev) {
                var mag  = parseFloat(ev.magnitude || ev.mag || 0);
                var lat  = parseFloat(ev.latitude  || ev.lat || 0);
                var lon  = parseFloat(ev.longitude || ev.lon || 0);
                var place = ev.location || ev.region || 'Sudáfrica';
                var timeMs = ev.datetime ? new Date(ev.datetime).getTime() : Date.now();
                if (!lat || !lon) return null;
                return makeAlert('cgs_' + (ev.id || timeMs), mag, place,
                    lat, lon, parseFloat(ev.depth||0), timeMs,
                    'CGS 🇿🇦', 'https://www.geoscience.org.za/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] CGS South Africa:', e); return []; }
    }

    // ── CÁUCASO: ANS Armenia + EMSC zona Cáucaso ─────────────────────────
    async function fetchANS_Armenia(userLat, userLon) {
        try {
            // ANS publica datos en JSON/GeoJSON
            var url = 'http://seismo.am/en/services/seismap/catalog.json';
            var d = await proxyJSON(url, 12000);
            var list = d.earthquakes || d.data || (Array.isArray(d) ? d : []);
            return list.slice(0, 30).map(function(ev) {
                var mag  = parseFloat(ev.magnitude || ev.M || ev.mag || 0);
                var lat  = parseFloat(ev.latitude  || ev.lat || 0);
                var lon  = parseFloat(ev.longitude || ev.lon || 0);
                var place = ev.region || ev.location || 'Cáucaso';
                var timeMs = ev.datetime ? new Date(ev.datetime).getTime() : Date.now();
                if (!lat || !lon) return null;
                return makeAlert('ans_' + (ev.id || timeMs), mag, place,
                    lat, lon, parseFloat(ev.depth||0), timeMs,
                    'ANS Armenia 🇦🇲', 'http://seismo.am/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] ANS Armenia:', e); return []; }
    }

    // ── CÁUCASO: USGS filtrado zona Cáucaso/Asia Central ──────────────────
    async function fetchUSGS_Caucasus(userLat, userLon) {
        try {
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.5&limit=50&orderby=time&minlatitude=35&maxlatitude=48&minlongitude=38&maxlongitude=75';
            var d = await (await fetch(url, {signal: AbortSignal.timeout(10000)})).json();
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                return makeAlert('usgs_cau_' + f.id, parseFloat(p.mag||0),
                    p.place||'Cáucaso/Asia Central', c[1], c[0], c[2]||0,
                    p.time||Date.now(), 'USGS Cáucaso', p.url||'', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] USGS Caucasus:', e); return []; }
    }

    // ── ASIA CENTRAL: USGS filtrado Kazajistán/Uzbekistán/Tayikistán ───────
    async function fetchUSGS_CentralAsia(userLat, userLon) {
        try {
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.5&limit=50&orderby=time&minlatitude=34&maxlatitude=55&minlongitude=55&maxlongitude=87';
            var d = await (await fetch(url, {signal: AbortSignal.timeout(10000)})).json();
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                return makeAlert('usgs_cas_' + f.id, parseFloat(p.mag||0),
                    p.place||'Asia Central', c[1], c[0], c[2]||0,
                    p.time||Date.now(), 'USGS Asia Central 🌏', p.url||'', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] USGS CentralAsia:', e); return []; }
    }

    // ── ORIENTE MEDIO: GII Israel — Geological Survey Israel ───────────────
    async function fetchGII_Israel(userLat, userLon) {
        try {
            var url = 'https://eq.gsi.gov.il/api/earthquakes/recent';
            var d = await proxyJSON(url, 12000);
            var list = d.earthquakes || d.data || (Array.isArray(d) ? d : []);
            return list.slice(0, 20).map(function(ev) {
                var mag  = parseFloat(ev.magnitude || ev.mag || ev.ML || 0);
                var lat  = parseFloat(ev.lat || ev.latitude || 0);
                var lon  = parseFloat(ev.lon || ev.longitude || 0);
                var place = ev.location || ev.name || 'Israel/Oriente Medio';
                var timeMs = ev.time ? new Date(ev.time).getTime() : Date.now();
                if (!lat || !lon) return null;
                return makeAlert('gii_' + (ev.id || timeMs), mag, place,
                    lat, lon, parseFloat(ev.depth||0), timeMs,
                    'GII Israel 🇮🇱', 'https://eq.gsi.gov.il/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] GII Israel:', e); return []; }
    }

    // ── ORIENTE MEDIO: USGS filtrado Oriente Medio/Arabia ──────────────────
    async function fetchUSGS_MiddleEast(userLat, userLon) {
        try {
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.5&limit=50&orderby=time&minlatitude=12&maxlatitude=42&minlongitude=25&maxlongitude=65';
            var d = await (await fetch(url, {signal: AbortSignal.timeout(10000)})).json();
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                return makeAlert('usgs_me_' + f.id, parseFloat(p.mag||0),
                    p.place||'Oriente Medio', c[1], c[0], c[2]||0,
                    p.time||Date.now(), 'USGS Oriente Medio 🌍', p.url||'', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] USGS MiddleEast:', e); return []; }
    }

    // ── PAKISTAN/AFGANISTÁN: PMD + USGS zona ──────────────────────────────
    async function fetchUSGS_Pakistan(userLat, userLon) {
        try {
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.5&limit=50&orderby=time&minlatitude=23&maxlatitude=38&minlongitude=60&maxlongitude=75';
            var d = await (await fetch(url, {signal: AbortSignal.timeout(10000)})).json();
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                return makeAlert('usgs_pk_' + f.id, parseFloat(p.mag||0),
                    p.place||'Pakistan/Afganistán', c[1], c[0], c[2]||0,
                    p.time||Date.now(), 'USGS Pakistan 🇵🇰', p.url||'', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] USGS Pakistan:', e); return []; }
    }

    // ── ZAMG: Austria + Europa Central ─────────────────────────────────────
    async function fetchZAMG_Austria(userLat, userLon) {
        try {
            var url = 'https://www.zamg.ac.at/eqdb/api/v1/events?format=geojson&limit=50&minMag=1.5&orderBy=time';
            var d = await proxyJSON(url, 12000);
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                var mag = parseFloat(p.magnitude || p.mag || 0);
                return makeAlert('zamg_' + (p.id || f.id), mag,
                    p.region || p.place || 'Europa Central', c[1], c[0], c[2]||0,
                    p.time ? new Date(p.time).getTime() : Date.now(),
                    'ZAMG 🇦🇹', 'https://www.zamg.ac.at/', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] ZAMG Austria:', e); return []; }
    }

    // ── NEPAL/HIMALAYA: USGS filtrado zona Himalaya ────────────────────────
    async function fetchUSGS_Himalaya(userLat, userLon) {
        try {
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.5&limit=50&orderby=time&minlatitude=26&maxlatitude=40&minlongitude=70&maxlongitude=100';
            var d = await (await fetch(url, {signal: AbortSignal.timeout(10000)})).json();
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                return makeAlert('usgs_him_' + f.id, parseFloat(p.mag||0),
                    p.place||'Himalaya', c[1], c[0], c[2]||0,
                    p.time||Date.now(), 'USGS Himalaya 🏔️', p.url||'', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] USGS Himalaya:', e); return []; }
    }

    // ── EUROPA NÓRDICA: NORSAR Norway + Islandia ───────────────────────────
    async function fetchUSGS_Nordic(userLat, userLon) {
        try {
            // Islandia es muy activa volcánica/sísmicamente
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.0&limit=50&orderby=time&minlatitude=55&maxlatitude=72&minlongitude=-30&maxlongitude=32';
            var d = await (await fetch(url, {signal: AbortSignal.timeout(10000)})).json();
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                return makeAlert('usgs_nord_' + f.id, parseFloat(p.mag||0),
                    p.place||'Europa Nórdica', c[1], c[0], c[2]||0,
                    p.time||Date.now(), 'USGS Nórdico 🌋', p.url||'', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] USGS Nordic:', e); return []; }
    }

    // ── PACÍFICO SUR / ISLAS: USGS zona Pacífico SW ────────────────────────
    async function fetchUSGS_SWPacific(userLat, userLon) {
        try {
            // Vanuatu, Tonga, Fiji, Islas Salomón — zona muy activa
            var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=3.0&limit=50&orderby=time&minlatitude=-30&maxlatitude=5&minlongitude=150&maxlongitude=185';
            var d = await (await fetch(url, {signal: AbortSignal.timeout(10000)})).json();
            var feats = (d && d.features) ? d.features : [];
            return feats.map(function(f) {
                var p = f.properties, c = f.geometry && f.geometry.coordinates;
                if (!p || !c) return null;
                return makeAlert('usgs_swp_' + f.id, parseFloat(p.mag||0),
                    p.place||'Pacífico SW', c[1], c[0], c[2]||0,
                    p.time||Date.now(), 'USGS Pacífico SW 🌊', p.url||'', userLat, userLon);
            }).filter(Boolean);
        } catch(e) { console.error('[Seismic] USGS SW Pacific:', e); return []; }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DEDUPLICACIÓN: elimina alertas con mismo sismo de distintas fuentes
    // ─────────────────────────────────────────────────────────────────────────

    function deduplicateSeismic(alerts) {
        var seen = [];
        return alerts.filter(function(a) {
            if (!a.lat || !a.lon || !a._timeMs) return true; // no deduplicar sin coords
            for (var i=0; i<seen.length; i++) {
                var b = seen[i];
                if (!b.lat || !b.lon || !b._timeMs) continue;
                var sameMag   = Math.abs((a.magnitude||0) - (b.magnitude||0)) < 0.4;
                var nearTime  = Math.abs(a._timeMs - b._timeMs) < 90000; // 90 segundos
                var nearPlace = dist(a.lat, a.lon, b.lat, b.lon) < 80;   // 80 km
                if (sameMag && nearTime && nearPlace) return false;
            }
            seen.push(a);
            return true;
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FUNCIÓN PRINCIPAL: loadSeismicAlerts(lat, lon)
    // ─────────────────────────────────────────────────────────────────────────

    async function loadSeismicAlerts(userLat, userLon) {
        var region = detectRegion(userLat, userLon);
        console.log('[SeismicSources] Región detectada:', region.code, '—', region.name||'Global');

        // ── Fuentes SIEMPRE activas (globales críticas) ──────────────────────
        var always = [
            fetchUSGS_Global(userLat, userLon),      // USGS M4.5+ global
            fetchEMSC_Global(userLat, userLon),      // EMSC global
            fetchGFZ_Potsdam(userLat, userLon),      // GFZ Potsdam M4.5+ global
            fetchUSGS_Kamchatka(userLat, userLon),   // Kamchatka/Kuril — siempre activo
            fetchUSGS_SWPacific(userLat, userLon),   // Vanuatu/Tonga/Fiji — siempre activo
            fetchUSGS_Africa(userLat, userLon),      // Africa M3+ — llena el mapa vacío
            fetchPTWC_Tsunami(userLat, userLon),     // Tsunamis Pacífico
            fetchNTWC_Tsunami(userLat, userLon),     // Tsunamis Alaska/EEUU
            fetchJMA_Tsunami(userLat, userLon)       // Tsunamis Japón
        ];

        // ── Fuentes por REGIÓN del usuario ───────────────────────────────────
        var regional = [];

        switch(region.code) {
            case 'JP':
                regional.push(fetchJMA_Japan(userLat, userLon));
                regional.push(fetchUSGS_Japan(userLat, userLon));
                break;
            case 'CL':
                regional.push(fetchCSN_Chile(userLat, userLon));
                regional.push(fetchSHOA_Tsunami(userLat, userLon));
                break;
            case 'PE':
                regional.push(fetchIGP_Peru(userLat, userLon));
                break;
            case 'MX':
                regional.push(fetchSSN_Mexico(userLat, userLon));
                break;
            case 'CO':
                regional.push(fetchSGC_Colombia(userLat, userLon));
                break;
            case 'EC':
                regional.push(fetchIGEPN_Ecuador(userLat, userLon));
                break;
            case 'AR':
                regional.push(fetchINPRES_Argentina(userLat, userLon));
                break;

            case 'CA':
                regional.push(fetchNRCan_Canada(userLat, userLon));
                break;
            case 'TR':
                regional.push(fetchAFAD_Turkey(userLat, userLon));
                break;
            case 'IR':
                regional.push(fetchIRSC_Iran(userLat, userLon));
                break;
            case 'ID':
                regional.push(fetchBMKG_Indonesia(userLat, userLon));
                break;
            case 'PH':
                regional.push(fetchPHIVOLCS_Philippines(userLat, userLon));
                break;
            case 'NZ':
                regional.push(fetchGeoNet_NZ(userLat, userLon));
                break;
            case 'AU':
                regional.push(fetchGeoScience_AU(userLat, userLon));
                break;
            case 'GR':
                regional.push(fetchNOA_Greece(userLat, userLon));
                break;
            case 'IT_S':
                regional.push(fetchINGV_Italy(userLat, userLon));
                regional.push(fetchIGN_Spain(userLat, userLon));
                regional.push(fetchNOA_Greece(userLat, userLon));
                regional.push(fetchORFEUS_Europe(userLat, userLon));
                regional.push(fetchGFZ_Potsdam(userLat, userLon));
                break;
            case 'ES':
                regional.push(fetchIGN_Spain(userLat, userLon));
                break;
            case 'KR': // Corea del Sur
                regional.push(fetchKMA_Korea(userLat, userLon));
                break;
            case 'CN': // China y Asia Oriental
                regional.push(fetchCEIC_China(userLat, userLon));
                break;
            case 'IN': // India
                regional.push(fetchNCS_India(userLat, userLon));
                break;
            case 'VE': // Venezuela
                regional.push(fetchFUNVISIS_Venezuela(userLat, userLon));
                break;
            case 'BR': // Brasil
                regional.push(fetchRSBR_Brasil(userLat, userLon));
                break;
            case 'CR': // Costa Rica
                regional.push(fetchOVSICORI_CostaRica(userLat, userLon));
                break;
            case 'SA': // Sudamérica genérica
                regional.push(fetchCSN_Chile(userLat, userLon));
                regional.push(fetchIGP_Peru(userLat, userLon));
                regional.push(fetchSGC_Colombia(userLat, userLon));
                regional.push(fetchFUNVISIS_Venezuela(userLat, userLon));
                regional.push(fetchRSBR_Brasil(userLat, userLon));
                regional.push(fetchSHOA_Tsunami(userLat, userLon));
                break;
            case 'CAM': // Centroamérica
                regional.push(fetchSSN_Mexico(userLat, userLon));
                regional.push(fetchOVSICORI_CostaRica(userLat, userLon));
                break;
            case 'EU': // Europa genérica (ya tenía INGV+IGN+NOA)
                regional.push(fetchINGV_Italy(userLat, userLon));
                regional.push(fetchIGN_Spain(userLat, userLon));
                regional.push(fetchNOA_Greece(userLat, userLon));
                regional.push(fetchORFEUS_Europe(userLat, userLon)); // consolida UK, FR, AT, etc.
                regional.push(fetchGFZ_Potsdam(userLat, userLon));
                break;
            case 'US': // EEUU — Alaska como subregión separada
                regional.push(fetchUSGS_USA(userLat, userLon));
                regional.push(fetchAEC_Alaska(userLat, userLon));
                break;
            // ── RUSIA ──────────────────────────────────────────────────────
            case 'RU':
                regional.push(fetchGSRAS_Russia(userLat, userLon));
                regional.push(fetchUSGS_Kamchatka(userLat, userLon));
                regional.push(fetchUSGS_Siberia(userLat, userLon));
                break;

            // ── AFRICA ──────────────────────────────────────────────────────
            case 'DZ': // Magreb/Argelia
                regional.push(fetchCRAAG_Algeria(userLat, userLon));
                regional.push(fetchEMSC_Africa(userLat, userLon));
                break;
            case 'ZA': // Sudáfrica
                regional.push(fetchCGS_SouthAfrica(userLat, userLon));
                regional.push(fetchUSGS_Africa(userLat, userLon));
                break;
            case 'AF': // Africa genérica
                regional.push(fetchUSGS_Africa(userLat, userLon));
                regional.push(fetchEMSC_Africa(userLat, userLon));
                break;

            // ── CÁUCASO ──────────────────────────────────────────────────────
            case 'CAU':
                regional.push(fetchANS_Armenia(userLat, userLon));
                regional.push(fetchUSGS_Caucasus(userLat, userLon));
                regional.push(fetchAFAD_Turkey(userLat, userLon)); // cubre zona
                break;

            // ── ORIENTE MEDIO ────────────────────────────────────────────────
            case 'ME':
                regional.push(fetchGII_Israel(userLat, userLon));
                regional.push(fetchUSGS_MiddleEast(userLat, userLon));
                regional.push(fetchIRSC_Iran(userLat, userLon)); // Irán limítrofe
                break;

            // ── ASIA CENTRAL ─────────────────────────────────────────────────
            case 'CA':
                regional.push(fetchUSGS_CentralAsia(userLat, userLon));
                regional.push(fetchUSGS_Caucasus(userLat, userLon));
                break;

            // ── HIMALAYA/NEPAL/PAKISTAN ───────────────────────────────────────
            case 'NP':
                regional.push(fetchUSGS_Himalaya(userLat, userLon));
                break;
            case 'PK':
                regional.push(fetchUSGS_Pakistan(userLat, userLon));
                regional.push(fetchUSGS_Himalaya(userLat, userLon));
                break;

            // ── EUROPA NÓRDICA / ISLANDIA ─────────────────────────────────────
            case 'IS':
            case 'NO':
                regional.push(fetchUSGS_Nordic(userLat, userLon));
                regional.push(fetchORFEUS_Europe(userLat, userLon));
                break;

            // ── EUROPA CENTRAL (Austria, etc.) ────────────────────────────────
            case 'AT':
                regional.push(fetchZAMG_Austria(userLat, userLon));
                regional.push(fetchORFEUS_Europe(userLat, userLon));
                regional.push(fetchGFZ_Potsdam(userLat, userLon));
                break;

            // ── PACÍFICO SW (Vanuatu, Tonga, Fiji, Salomón) ──────────────────
            case 'SWP':
                regional.push(fetchUSGS_SWPacific(userLat, userLon));
                regional.push(fetchGeoNet_NZ(userLat, userLon)); // cubre zona
                break;

            default: // GLOBAL: máxima cobertura
                regional.push(fetchUSGS_Local(userLat, userLon));
                regional.push(fetchGeoNet_NZ(userLat, userLon));
                regional.push(fetchINGV_Italy(userLat, userLon));
                regional.push(fetchBMKG_Indonesia(userLat, userLon));
                regional.push(fetchIRIS_Global(userLat, userLon));
                regional.push(fetchUSGS_SWPacific(userLat, userLon)); // Pacífico SW
                break;
        }

        // ── Ejecutar todo en paralelo ────────────────────────────────────────
        var allPromises = always.concat(regional);
        var results = await Promise.allSettled(allPromises);

        var all = [];
        results.forEach(function(r) {
            if (r.status === 'fulfilled' && Array.isArray(r.value)) {
                all = all.concat(r.value);
            }
        });

        // ── Filtrar por antigüedad ───────────────────────────────────────────
        // Tsunamis: máximo 24h (alertas activas duran horas, no días)
        // Sismos: máximo 48h
        var cutoff48h = Date.now() - 48*3600000;
        var cutoff24h = Date.now() - 24*3600000;
        all = all.filter(function(a) {
            if (!a._timeMs) return true; // sin fecha → incluir siempre
            if (/TSUNAMI/.test(a.type||'')) return a._timeMs >= cutoff24h;
            return a._timeMs >= cutoff48h;
        });

        // ── Deduplicar ───────────────────────────────────────────────────────
        all = deduplicateSeismic(all);

        // ── Ordenar: más reciente primero ────────────────────────────────────
        all.sort(function(a,b) { return (b._timeMs||0) - (a._timeMs||0); });

        console.log('[SeismicSources] Total sismos+tsunamis únicos:', all.length,
                    '| Fuentes activas:', allPromises.length);
        return all;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXPORTAR
    // ─────────────────────────────────────────────────────────────────────────

    global.SeismicSources = {
        load: loadSeismicAlerts,
        detectRegion: detectRegion
    };

    // Para debug en consola
    console.log('[SeismicSources] Módulo cargado — 20 fuentes oficiales por región');

})(window);
