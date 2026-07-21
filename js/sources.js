// ============================================
// js/sources.js — Fuentes de datos de alertas
// Búsqueda inteligente por ubicación
// ============================================

// ========== BASE DE DATOS DE UBICACIONES ==========
if (typeof window.LocationDatabase === 'undefined') {
    window.LocationDatabase = {
        "chile":            { lat: -30.0,    lon: -71.5,   country: "Chile", region: "Nacional" },
        "santiago":         { lat: -33.4489, lon: -70.6693, country: "Chile", region: "Metropolitana" },
        "valparaiso":       { lat: -33.0472, lon: -71.6127, country: "Chile", region: "Valparaíso" },
        "concepcion":       { lat: -36.8201, lon: -73.0445, country: "Chile", region: "Biobío" },
        "tirua":            { lat: -38.2704, lon: -73.2490, country: "Chile", region: "Biobío" },
        "temuco":           { lat: -38.7362, lon: -72.5879, country: "Chile", region: "La Araucanía" },
        "puerto montt":     { lat: -41.3143, lon: -72.1481, country: "Chile", region: "Los Lagos" },
        "coyhaique":        { lat: -45.5771, lon: -71.9405, country: "Chile", region: "Aysén" },
        "punta arenas":     { lat: -53.1638, lon: -70.9181, country: "Chile", region: "Magallanes" },
        "arica":            { lat: -18.4861, lon: -70.2979, country: "Chile", region: "Arica y Parinacota" },
        "iquique":          { lat: -20.2142, lon: -70.1538, country: "Chile", region: "Tarapacá" },
        "antofagasta":      { lat: -23.6345, lon: -70.3996, country: "Chile", region: "Antofagasta" },
        "la serena":        { lat: -29.9027, lon: -71.2519, country: "Chile", region: "Coquimbo" },
        "rancagua":         { lat: -34.1703, lon: -70.7444, country: "Chile", region: "O'Higgins" },
        "talca":            { lat: -35.4264, lon: -71.6554, country: "Chile", region: "Maule" },
        "chillan":          { lat: -36.6069, lon: -72.1026, country: "Chile", region: "Ñuble" },
        "osorno":           { lat: -40.5733, lon: -73.1347, country: "Chile", region: "Los Lagos" },
        "lima":             { lat: -12.0464, lon: -77.0428, country: "Peru",     region: "Lima" },
        "bogota":           { lat: 4.7110,   lon: -74.0721, country: "Colombia", region: "Bogotá" },
        "buenos aires":     { lat: -34.6037, lon: -58.3816, country: "Argentina", region: "Buenos Aires" },
        "sao paulo":        { lat: -23.5505, lon: -46.6333, country: "Brasil",   region: "São Paulo" },
        "ciudad de mexico": { lat: 19.4326,  lon: -99.1332, country: "Mexico",  region: "CDMX" },
        "nueva york":       { lat: 40.7128,  lon: -74.0060, country: "EEUU",     region: "Nueva York" },
        "los angeles":      { lat: 34.0522,  lon: -118.2437, country: "EEUU",    region: "California" },
        "miami":            { lat: 25.7617,  lon: -80.1918, country: "EEUU",     region: "Florida" },
        "madrid":           { lat: 40.4168,  lon: -3.7038,  country: "España",   region: "Madrid" },
        "barcelona":        { lat: 41.3851,  lon: 2.1734,   country: "España",   region: "Cataluña" },
        "tokyo":            { lat: 35.6762,  lon: 139.6503, country: "Japón",    region: "Tokio" }
    };
}

function searchLocation(query) {
    if (!query) return null;
    const q = query.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const db = window.LocationDatabase;
    for (let key in db) {
        const k = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (k === q) return { ...db[key], name: key };
    }
    for (let key in db) {
        const k = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (k.includes(q) || q.includes(k)) return { ...db[key], name: key };
    }
    return null;
}

function calcDistance(lat1, lon1, lat2, lon2) {
    if (lat2 == null || lon2 == null) return 99999;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getMagnitudeColor(mag) {
    if (!mag) return "#999";
    if (mag < 2) return "#FFFF00";
    if (mag < 3) return "#FFA500";
    if (mag < 4) return "#FF6600";
    if (mag < 5) return "#FF3300";
    return "#990000";
}

async function getEarthquakesData(latitude, longitude, radiusKm) {
    try {
        const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=150&minmagnitude=1.5';
        const response = await fetch(url);
        const data = await response.json();
        return data.features.map(f => {
            const p = f.properties;
            const c = f.geometry.coordinates;
            return {
                id: p.code || ('eq_' + Date.now() + Math.random()),
                type: "SISMO",
                icon: "🔴",
                title: 'Sismo M' + (p.mag ? p.mag.toFixed(1) : '?'),
                description: p.place || 'Sin ubicación',
                lat: c[1], lon: c[0],
                magnitude: p.mag,
                depth: c[2],
                distKm: Math.round(calcDistance(latitude, longitude, c[1], c[0])),
                time: new Date(p.time).toLocaleString('es-CL'),
                source: "USGS",
                priority: Math.min(100, (p.mag || 0) * 15),
                color: getMagnitudeColor(p.mag),
                link: p.url
            };
        });
    } catch(e) { console.error("Error sismos:", e); return []; }
}

async function getVolcanoesData(latitude, longitude) {
    const list = [
        { name: "Villarrica",    lat: -39.4233, lon: -71.9311, country: "Chile",      alert: "Activo" },
        { name: "Calbuco",       lat: -41.3295, lon: -72.6084, country: "Chile",      alert: "Activo" },
        { name: "Copahue",       lat: -37.8560, lon: -71.1730, country: "Chile",      alert: "Activo" },
        { name: "Llaima",        lat: -38.6920, lon: -71.7290, country: "Chile",      alert: "Activo" },
        { name: "Osorno",        lat: -41.1000, lon: -72.4930, country: "Chile",      alert: "Vigilancia" },
        { name: "Popocatépetl",  lat: 19.0230,  lon: -98.6280, country: "México",     alert: "Activo" },
        { name: "Tungurahua",    lat: -1.4670,  lon: -78.4420, country: "Ecuador",    alert: "Activo" },
        { name: "Cotopaxi",      lat: -0.6770,  lon: -78.4360, country: "Ecuador",    alert: "Vigilancia" },
        { name: "Sabancaya",     lat: -15.7870, lon: -71.8570, country: "Perú",       alert: "Activo" },
        { name: "Nevado del Ruiz",lat:4.8920,   lon: -75.3240, country: "Colombia",   alert: "Activo" },
        { name: "Etna",          lat: 37.7510,  lon: 14.9990,  country: "Italia",     alert: "Activo" },
        { name: "Kilauea",       lat: 19.4210,  lon: -155.2870,country: "EEUU",       alert: "Activo" },
        { name: "Merapi",        lat: -7.5410,  lon: 110.4460, country: "Indonesia",  alert: "Activo" }
    ];
    return list.map(v => ({
        id: 'volcano_' + v.name.replace(/\s/g,'_'),
        type: "VOLCÁN",
        icon: "🌋",
        title: 'Volcán ' + v.name,
        description: v.alert + ' — ' + v.country,
        lat: v.lat, lon: v.lon,
        distKm: Math.round(calcDistance(latitude, longitude, v.lat, v.lon)),
        time: new Date().toLocaleString('es-CL'),
        source: "Smithsonian GVP",
        priority: v.alert === 'Activo' ? 70 : 55,
        color: "#FF6600"
    }));
}

async function getWeatherAlertsData(latitude, longitude) {
    try {
        const key = '6fe6e0dcca264864dbd631bf620aad64';
        const r = await fetch('https://api.openweathermap.org/data/2.5/weather?lat='+latitude+'&lon='+longitude+'&appid='+key+'&units=metric&lang=es');
        const d = await r.json();
        const alerts = [];
        if (d.alerts) {
            d.alerts.forEach(a => alerts.push({
                id: 'wx_'+a.start, type:"ALERTA CLIMÁTICA", icon:"⛈️",
                title: a.event, description: a.description||'',
                lat: latitude, lon: longitude, distKm:0,
                time: new Date(a.start*1000).toLocaleString('es-CL'),
                source:"OpenWeather", priority:65, color:"#FF6B6B"
            }));
        }
        if (d.wind && d.wind.speed > 15) alerts.push({
            id:'wind_'+Date.now(), type:"VIENTO FUERTE", icon:"💨",
            title:'Viento '+Math.round(d.wind.speed*3.6)+' km/h',
            description:'Ráfagas detectadas en la zona',
            lat:latitude, lon:longitude, distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:"OpenWeather", priority:55, color:"#87CEEB"
        });
        if (d.main && d.main.temp > 35) alerts.push({
            id:'heat_'+Date.now(), type:"CALOR EXTREMO", icon:"🔥",
            title:'Temperatura '+Math.round(d.main.temp)+'°C',
            description:'Condiciones de calor extremo',
            lat:latitude, lon:longitude, distKm:0,
            time:new Date().toLocaleString('es-CL'),
            source:"OpenWeather", priority:60, color:"#FF4500"
        });
        return alerts;
    } catch(e) { console.error("Error clima:", e); return []; }
}

async function loadAlertsForLocation(locationInput, radiusKm) {
    radiusKm = radiusKm || 500;
    let lat, lon;
    if (typeof locationInput === 'object' && locationInput.lat) {
        lat = locationInput.lat; lon = locationInput.lon;
    } else {
        const loc = searchLocation(locationInput);
        if (!loc) return [];
        lat = loc.lat; lon = loc.lon;
    }
    const [eq, vo, wx] = await Promise.all([
        getEarthquakesData(lat, lon, radiusKm),
        getVolcanoesData(lat, lon),
        getWeatherAlertsData(lat, lon)
    ]);
    return [...eq, ...vo, ...wx]
        .filter(a => !a.distKm || a.distKm <= radiusKm || a.distKm === 0)
        .sort((a,b) => (b.priority||0)-(a.priority||0));
}

async function loadGlobalAlerts() {
    console.log("🌍 Cargando alertas globales...");
    const [eq, vo] = await Promise.all([
        getEarthquakesData(0, 0, 20000),
        getVolcanoesData(0, 0)
    ]);
    return [...eq, ...vo]
        .filter(a => (a.priority||0) >= 50)
        .sort((a,b) => (b.priority||0)-(a.priority||0))
        .slice(0, 100);
}

window.searchLocation        = searchLocation;
window.loadAlertsForLocation = loadAlertsForLocation;
window.loadGlobalAlerts      = loadGlobalAlerts;
window.calcDistance          = calcDistance;

window.loadExternalSources = function(callback) {
    loadGlobalAlerts()
        .then(function(alerts) {
            console.log("✅ Alertas globales cargadas:", alerts.length);
            if (callback) callback(alerts);
        })
        .catch(function(e) {
            console.error("Error:", e);
            if (callback) callback([]);
        });
};
