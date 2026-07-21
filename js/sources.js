// ============================================
// js/sources.js — Fuentes de datos de alertas
// Con búsqueda INTELIGENTE por localidad
// ============================================

// ========== GEOLOCALIZACIÓN INTELIGENTE ==========
/**
 * Búsqueda de ubicación por nombre
 * Soporta: ciudad, provincia, país
 */
const LocationDatabase = {
    // CHILE - Principales ciudades y sus coordenadas
    "chile": { lat: -30.0, lon: -71.5, country: "Chile", region: "Nacional" },
    
    // REGIÓN METROPOLITANA
    "santiago": { lat: -33.4489, lon: -70.6693, country: "Chile", region: "Metropolitana", province: "Santiago" },
    "santiago de chile": { lat: -33.4489, lon: -70.6693, country: "Chile", region: "Metropolitana" },
    "puente alto": { lat: -33.6146, lon: -70.5563, country: "Chile", region: "Metropolitana" },
    "maipú": { lat: -33.5233, lon: -70.7597, country: "Chile", region: "Metropolitana" },
    
    // REGIÓN VALPARAÍSO
    "valparaíso": { lat: -33.0472, lon: -71.6127, country: "Chile", region: "Valparaíso" },
    "viña del mar": { lat: -33.0246, lon: -71.5519, country: "Chile", region: "Valparaíso" },
    "con con": { lat: -32.9468, lon: -71.5443, country: "Chile", region: "Valparaíso" },
    
    // REGIÓN BÍOBÍO
    "concepción": { lat: -36.8201, lon: -73.0445, country: "Chile", region: "Biobío", province: "Concepción" },
    "los ángeles": { lat: -37.4667, lon: -72.3333, country: "Chile", region: "Biobío" },
    "tirúa": { lat: -38.2704, lon: -73.2490, country: "Chile", region: "Biobío", province: "Arauco" },
    "arauco": { lat: -37.2333, lon: -73.6333, country: "Chile", region: "Biobío" },
    "lebu": { lat: -37.5975, lon: -73.6520, country: "Chile", region: "Biobío" },
    
    // REGIÓN LA ARAUCANÍA
    "temuco": { lat: -38.7362, lon: -72.5879, country: "Chile", region: "La Araucanía" },
    "puente cautín": { lat: -38.7000, lon: -72.4000, country: "Chile", region: "La Araucanía" },
    
    // REGIÓN DE LOS LAGOS
    "puerto montt": { lat: -41.3143, lon: -72.1481, country: "Chile", region: "Los Lagos" },
    "osorno": { lat: -40.5833, lon: -72.3333, country: "Chile", region: "Los Lagos" },
    "puerto varas": { lat: -41.3179, lon: -72.2077, country: "Chile", region: "Los Lagos" },
    
    // REGIÓN DE AYSÉN
    "coyhaique": { lat: -45.5771, lon: -71.9405, country: "Chile", region: "Aysén" },
    
    // REGIÓN MAGALLANES
    "punta arenas": { lat: -53.1638, lon: -70.9181, country: "Chile", region: "Magallanes" },
    
    // NORTE GRANDE
    "arica": { lat: -18.4861, lon: -70.2979, country: "Chile", region: "Arica y Parinacota" },
    "iquique": { lat: -20.2142, lon: -70.1538, country: "Chile", region: "Tarapacá" },
    "antofagasta": { lat: -23.6345, lon: -70.3996, country: "Chile", region: "Antofagasta" },
    "copiapó": { lat: -27.3627, lon: -70.3327, country: "Chile", region: "Atacama" }
};

/**
 * Buscar ubicación por nombre
 */
function searchLocation(query) {
    if (!query) return null;
    
    const normalized = query.toLowerCase().trim();
    
    // Búsqueda exacta
    if (LocationDatabase[normalized]) {
        return LocationDatabase[normalized];
    }
    
    // Búsqueda parcial
    for (let key in LocationDatabase) {
        if (key.includes(normalized) || normalized.includes(key)) {
            return LocationDatabase[key];
        }
    }
    
    return null;
}

// ========== FUENTES DE DATOS ==========

/**
 * 1. SISMOS - USGS (United States Geological Survey)
 */
async function getEarthquakesData(latitude, longitude, radiusKm = 500) {
    try {
        const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=100&minmagnitude=2.0`;
        const response = await fetch(url);
        const data = await response.json();
        
        return data.features.map(feature => {
            const props = feature.properties;
            const coords = feature.geometry.coordinates;
            const dist = calcDistance(latitude, longitude, coords[1], coords[0]);
            
            return {
                id: props.id,
                type: "SISMO",
                icon: "🔴",
                title: `Sismo M${props.mag}`,
                description: props.place,
                lat: coords[1],
                lon: coords[0],
                magnitude: props.mag,
                depth: coords[2],
                distKm: Math.round(dist),
                time: new Date(props.time).toLocaleString('es-CL'),
                source: "USGS",
                priority: Math.min(100, props.mag * 15),
                color: getMagnitudeColor(props.mag),
                link: props.url
            };
        });
    } catch (e) {
        console.error("Error cargando sismos:", e);
        return [];
    }
}

/**
 * 2. DESASTRES GLOBALES - GDACS (Global Disaster Alert & Coordination System)
 */
async function getGDACSData(latitude, longitude, radiusKm = 500) {
    try {
        const url = `https://www.gdacs.org/api/v1/events?limit=500&status=CURRENT`;
        const response = await fetch(url);
        const data = await response.json();
        
        return data.events.map(event => {
            const dist = calcDistance(latitude, longitude, event.lat, event.lon);
            const typeMap = {
                "FL": "INUNDACIÓN",
                "DR": "SEQUÍA",
                "EQ": "SISMO",
                "TC": "HURACÁN",
                "VO": "VOLCÁN",
                "TS": "TSUNAMI"
            };
            
            return {
                id: event.eventid,
                type: typeMap[event.eventtype] || event.eventtype,
                icon: getDisasterIcon(event.eventtype),
                title: event.disastername || typeMap[event.eventtype],
                description: event.description || "",
                lat: event.lat,
                lon: event.lon,
                distKm: Math.round(dist),
                time: new Date(event.eventdate).toLocaleString('es-CL'),
                source: "GDACS",
                priority: event.severity || 70,
                color: getDisasterColor(event.eventtype),
                link: `https://www.gdacs.org/Events/index.aspx?eventid=${event.eventid}`
            };
        });
    } catch (e) {
        console.error("Error cargando GDACS:", e);
        return [];
    }
}

/**
 * 3. CLIMA - OpenWeatherMap
 */
async function getWeatherAlertsData(latitude, longitude, radiusKm = 500) {
    try {
        const apiKey = '6fe6e0dcca264864dbd631bf620aad64';
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&lang=es`;
        const response = await fetch(url);
        const data = await response.json();
        
        const alerts = [];
        
        if (data.alerts && data.alerts.length > 0) {
            data.alerts.forEach(alert => {
                alerts.push({
                    id: `weather_${alert.start}`,
                    type: "ALERTA CLIMÁTICA",
                    icon: "🌡️",
                    title: alert.event,
                    description: alert.description || "",
                    lat: latitude,
                    lon: longitude,
                    distKm: 0,
                    time: new Date(alert.start * 1000).toLocaleString('es-CL'),
                    source: "OpenWeather",
                    priority: 65,
                    color: "#FF6B6B",
                    link: ""
                });
            });
        }
        
        // Agregar alerta por temperatura extrema
        const temp = data.main.temp;
        if (temp > 35) {
            alerts.push({
                id: `temp_high_${Date.now()}`,
                type: "CALOR EXTREMO",
                icon: "🔥",
                title: `Temperatura: ${Math.round(temp)}°C`,
                description: "Condiciones de calor extremo detectadas",
                lat: latitude,
                lon: longitude,
                distKm: 0,
                time: new Date().toLocaleString('es-CL'),
                source: "OpenWeather",
                priority: 60,
                color: "#FF3300"
            });
        }
        
        return alerts;
    } catch (e) {
        console.error("Error cargando clima:", e);
        return [];
    }
}

/**
 * 4. INCENDIOS - NASA FIRMS (Fire Information for Resource Management System)
 */
async function getFiresData(latitude, longitude, radiusKm = 500) {
    try {
        // Nota: NASA FIRMS requiere autenticación. Usando aproximación con datos públicos
        const url = `https://firms.modaps.eosdis.nasa.gov/api/country/csv/MODIS_SP/Chile/7`;
        const response = await fetch(url);
        const text = await response.text();
        const lines = text.split('\n');
        
        return lines.slice(1).filter(l => l.trim()).map(line => {
            const cols = line.split(',');
            const dist = calcDistance(latitude, longitude, parseFloat(cols[0]), parseFloat(cols[1]));
            
            return {
                id: `fire_${cols[0]}_${cols[1]}`,
                type: "INCENDIO",
                icon: "🔥",
                title: "Incendio Activo",
                description: `Confianza: ${cols[8]}%`,
                lat: parseFloat(cols[0]),
                lon: parseFloat(cols[1]),
                distKm: Math.round(dist),
                time: cols[5],
                source: "NASA FIRMS",
                priority: 80,
                color: "#FF4500",
                link: "https://firms.modaps.eosdis.nasa.gov/"
            };
        });
    } catch (e) {
        console.error("Error cargando incendios:", e);
        return [];
    }
}

/**
 * 5. VOLCANES - Smithsonian Institution
 */
async function getVolcanoesData(latitude, longitude, radiusKm = 1000) {
    try {
        // API pública de volcanes activos
        const url = `https://www.volcanoapi.com/api/v1/volcanos?country=CL`;
        
        // Fallback a datos estáticos de volcanes en Chile si falla la API
        const chilenVolcanoes = [
            { name: "Villarrica", lat: -39.4233, lon: -71.9311 },
            { name: "Calbuco", lat: -41.3295, lon: -72.6084 },
            { name: "San Pedro", lat: -22.9089, lon: -68.1986 },
            { name: "Licancabur", lat: -23.3951, lon: -67.8675 },
            { name: "Nevados de Ruiz", lat: -5.0214, lon: -75.3041 }
        ];
        
        return chilenVolcanoes.map(volcano => {
            const dist = calcDistance(latitude, longitude, volcano.lat, volcano.lon);
            return {
                id: `volcano_${volcano.name}`,
                type: "VOLCÁN",
                icon: "🌋",
                title: `Volcán ${volcano.name}`,
                description: "Monitoreo activo",
                lat: volcano.lat,
                lon: volcano.lon,
                distKm: Math.round(dist),
                time: new Date().toLocaleString('es-CL'),
                source: "Smithsonian",
                priority: 70,
                color: "#FF6600",
                link: "https://volcano.si.edu/"
            };
        }).filter(v => v.distKm <= radiusKm);
    } catch (e) {
        console.error("Error cargando volcanes:", e);
        return [];
    }
}

// ========== FUNCIONES AUXILIARES ==========

function calcDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function getMagnitudeColor(mag) {
    if (mag < 3) return "#FFFF00";
    if (mag < 4) return "#FFA500";
    if (mag < 5) return "#FF6600";
    if (mag < 6) return "#FF3300";
    if (mag < 7) return "#CC0000";
    return "#990000";
}

function getDisasterColor(type) {
    const colors = {
        "FL": "#0099FF", // Azul - Inundación
        "DR": "#FF9900", // Naranja - Sequía
        "EQ": "#FF0000", // Rojo - Sismo
        "TC": "#9933FF", // Púrpura - Huracán
        "VO": "#FF6600", // Naranja oscuro - Volcán
        "TS": "#0066FF"  // Azul oscuro - Tsunami
    };
    return colors[type] || "#999999";
}

function getDisasterIcon(type) {
    const icons = {
        "FL": "💧", // Inundación
        "DR": "🏜️", // Sequía
        "EQ": "🔴", // Sismo
        "TC": "🌀", // Huracán
        "VO": "🌋", // Volcán
        "TS": "🌊"  // Tsunami
    };
    return icons[type] || "⚠️";
}

/**
 * FUNCIÓN PRINCIPAL: Obtener todas las alertas para una localidad
 */
async function loadAlertsForLocation(locationName, radiusKm = 500) {
    console.log(`🔍 Buscando alertas para: ${locationName}`);
    
    const location = searchLocation(locationName);
    if (!location) {
        console.error("Ubicación no encontrada:", locationName);
        return [];
    }
    
    console.log(`📍 Ubicación encontrada: ${location.region}, Chile`);
    
    // Obtener todas las alertas de todas las fuentes en PARALELO
    const [earthquakes, gdacs, weather, fires, volcanoes] = await Promise.all([
        getEarthquakesData(location.lat, location.lon, radiusKm),
        getGDACSData(location.lat, location.lon, radiusKm),
        getWeatherAlertsData(location.lat, location.lon, radiusKm),
        getFiresData(location.lat, location.lon, radiusKm),
        getVolcanoesData(location.lat, location.lon, radiusKm)
    ]);
    
    // Combinar todas las alertas
    const allAlerts = [
        ...earthquakes,
        ...gdacs,
        ...weather,
        ...fires,
        ...volcanoes
    ];
    
    // Filtrar por radio y ordenar por prioridad
    return allAlerts
        .filter(a => a.distKm <= radiusKm || a.distKm === 0)
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

/**
 * Obtener alertas GLOBALES activas (para el mapa)
 */
async function loadGlobalAlerts() {
    console.log("🌍 Cargando alertas globales...");
    
    // Centro del mundo aprox
    const [earthquakes, gdacs, volcanoes] = await Promise.all([
        getEarthquakesData(0, 0, 20000), // radio grande
        getGDACSData(0, 0, 20000),
        getVolcanoesData(0, 0, 20000)
    ]);
    
    return [
        ...earthquakes,
        ...gdacs,
        ...volcanoes
    ].filter(a => a.priority >= 70) // Solo las importantes
     .sort((a, b) => (b.priority || 0) - (a.priority || 0))
     .slice(0, 50); // Top 50
}

// ========== EXPORTAR FUNCIONES ==========
window.LocationDatabase = LocationDatabase;
window.searchLocation = searchLocation;
window.loadAlertsForLocation = loadAlertsForLocation;
window.loadGlobalAlerts = loadGlobalAlerts;
