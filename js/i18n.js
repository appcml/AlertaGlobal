// ============================================
// INTERNACIONALIZACIÓN (i18n)
// ============================================
const TRANSLATIONS = {
    es: {
        tab_alerts: "Alertas", tab_weather: "Clima", tab_map: "Mapa",
        detecting: "Detectando...", search: "Buscar", loading_alerts: "Cargando alertas...",
        getting_location: "Obteniendo ubicación...", humidity: "Humedad", wind: "Viento",
        feels_like: "Sensación", pressure: "Presión", magnitude: "Magnitud",
        source: "Fuente", depth: "Prof", ago_min: "Hace {n} min", ago_hr: "Hace {n}h",
        search_placeholder: "Ciudad, país...", search_title: "Buscar ubicación",
        saved_title: "Ubicaciones guardadas", no_alerts: "No hay alertas recientes",
        error_loading: "Error cargando datos", updated: "Datos actualizados",
        location_saved: "Ubicación guardada", location_removed: "Ubicación eliminada",
        allow_location: "Permite acceso a ubicación", configure_api: "Configura tu API Key en js/app.js",
        rec_extreme: "🔥 ¡Extremadamente caluroso! Evita salir entre 11:00 y 16:00. Protector solar SPF 50+.",
        rec_hot: "☀️ Muy caluroso. Mantente hidratado y busca sombra.",
        rec_warm: "🌤️ Caluroso. Usa protector solar y gafas de sol.",
        rec_nice: "🌈 Condiciones agradables. Disfruta tu día.",
        rec_cool: "🍂 Fresco. Lleva una chaqueta ligera.",
        rec_cold: "❄️ Frío. Abrígate bien y evita exposición prolongada.",
        rec_freeze: "🥶 ¡Congelante! Riesgo de hipotermia. Sal solo si es necesario.",
        tip_uv: "Usa protector solar SPF 30+, gafas de sol y sombrero. Evita el sol entre 10:00 y 16:00.",
        tip_tsunami: "Si sientes un sismo fuerte cerca de la costa, dirígete a zonas altas.",
        tip_fire: "Si estás en zona de evacuación, sigue las rutas designadas. Cubre boca y nariz.",
        tip_storm: "Refúgiate en interior. Evita ventanas. Desconecta aparatos eléctricos.",
        tip_rain: "Evita cruzar zonas inundadas. No conduzcas por calles con agua acumulada.",
        tip_cold_wave: "Abrígate en capas. Consume alimentos calientes. Revisa a personas mayores.",
        tip_volcano: "Usa mascarilla N95. Mantén puertas y ventanas cerradas si hay ceniza.",
        tip_drought: "Raciona el agua. Reporta fugas. Sigue restricciones municipales.",
        earthquake: "SISMO", critical: "CRÍTICO", high: "ALTO", medium: "MEDIO",
        prevention: "PREVENCIÓN", emergency: "EMERGENCIA", caution: "PRECAUCIÓN"
    },
    en: {
        tab_alerts: "Alerts", tab_weather: "Weather", tab_map: "Map",
        detecting: "Detecting...", search: "Search", loading_alerts: "Loading alerts...",
        getting_location: "Getting location...", humidity: "Humidity", wind: "Wind",
        feels_like: "Feels like", pressure: "Pressure", magnitude: "Magnitude",
        source: "Source", depth: "Depth", ago_min: "{n} min ago", ago_hr: "{n}h ago",
        search_placeholder: "City, country...", search_title: "Search location",
        saved_title: "Saved locations", no_alerts: "No recent alerts",
        error_loading: "Error loading data", updated: "Data updated",
        location_saved: "Location saved", location_removed: "Location removed",
        allow_location: "Allow location access", configure_api: "Set your API Key in js/app.js",
        rec_extreme: "🔥 Extremely hot! Avoid going out between 11AM-4PM. Use SPF 50+ sunscreen.",
        rec_hot: "☀️ Very hot. Stay hydrated and seek shade.",
        rec_warm: "🌤️ Warm. Use sunscreen and sunglasses.",
        rec_nice: "🌈 Pleasant conditions. Enjoy your day.",
        rec_cool: "🍂 Cool. Bring a light jacket.",
        rec_cold: "❄️ Cold. Bundle up and avoid prolonged exposure.",
        rec_freeze: "🥶 Freezing! Risk of hypothermia. Go out only if necessary.",
        tip_uv: "Use SPF 30+ sunscreen, sunglasses and hat. Avoid sun between 10AM-4PM.",
        tip_tsunami: "If you feel a strong earthquake near the coast, head to higher ground.",
        tip_fire: "If in evacuation zone, follow designated routes. Cover mouth and nose.",
        tip_storm: "Shelter indoors. Avoid windows. Unplug electrical devices.",
        tip_rain: "Avoid crossing flooded areas. Don't drive through flooded streets.",
        tip_cold_wave: "Layer up. Eat warm foods. Check on elderly and children.",
        tip_volcano: "Wear N95 mask. Keep doors and windows closed if ash is falling.",
        tip_drought: "Ration water. Report leaks. Follow municipal restrictions.",
        earthquake: "EARTHQUAKE", critical: "CRITICAL", high: "HIGH", medium: "MEDIUM",
        prevention: "PREVENTION", emergency: "EMERGENCY", caution: "CAUTION"
    },
    pt: {
        tab_alerts: "Alertas", tab_weather: "Clima", tab_map: "Mapa",
        detecting: "Detectando...", search: "Buscar", loading_alerts: "Carregando alertas...",
        getting_location: "Obtendo localização...", humidity: "Umidade", wind: "Vento",
        feels_like: "Sensação", pressure: "Pressão", magnitude: "Magnitude",
        source: "Fonte", depth: "Prof", ago_min: "Há {n} min", ago_hr: "Há {n}h",
        search_placeholder: "Cidade, país...", search_title: "Buscar localização",
        earthquake: "TERREMOTO", critical: "CRÍTICO", high: "ALTO", medium: "MÉDIO",
        prevention: "PREVENÇÃO", emergency: "EMERGÊNCIA", caution: "PRECAUÇÃO",
        rec_nice: "🌈 Condições agradáveis. Aproveite o dia.",
        updated: "Dados atualizados", location_saved: "Localização salva",
    },
    fr: {
        tab_alerts: "Alertes", tab_weather: "Météo", tab_map: "Carte",
        detecting: "Détection...", search: "Chercher", earthquake: "SÉISME",
        humidity: "Humidité", wind: "Vent", feels_like: "Ressenti", pressure: "Pression",
        rec_nice: "🌈 Conditions agréables. Profitez de votre journée.",
        updated: "Données mises à jour",
    }
};

let currentLang = 'es';

function detectLanguage() {
    const browserLang = (navigator.language || navigator.userLanguage || 'es').substring(0, 2);
    const saved = localStorage.getItem('ag_lang');
    if (saved && TRANSLATIONS[saved]) return saved;
    if (TRANSLATIONS[browserLang]) return browserLang;
    return 'es';
}

function t(key) {
    return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key])
        || (TRANSLATIONS['es'] && TRANSLATIONS['es'][key])
        || key;
}

function setLanguage(lang) {
    if (!TRANSLATIONS[lang]) lang = 'es';
    currentLang = lang;
    localStorage.setItem('ag_lang', lang);
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.placeholder = t('search_placeholder');
}

// Init language
currentLang = detectLanguage();// ============================================
// INTERNACIONALIZACIÓN (i18n)
// ============================================
const TRANSLATIONS = {
    es: {
        tab_alerts: "Alertas", tab_weather: "Clima", tab_map: "Mapa",
        detecting: "Detectando...", search: "Buscar", loading_alerts: "Cargando alertas...",
        getting_location: "Obteniendo ubicación...", humidity: "Humedad", wind: "Viento",
        feels_like: "Sensación", pressure: "Presión", magnitude: "Magnitud",
        source: "Fuente", depth: "Prof", ago_min: "Hace {n} min", ago_hr: "Hace {n}h",
        search_placeholder: "Ciudad, país...", search_title: "Buscar ubicación",
        saved_title: "Ubicaciones guardadas", no_alerts: "No hay alertas recientes",
        error_loading: "Error cargando datos", updated: "Datos actualizados",
        location_saved: "Ubicación guardada", location_removed: "Ubicación eliminada",
        allow_location: "Permite acceso a ubicación", configure_api: "Configura tu API Key en js/app.js",
        rec_extreme: "🔥 ¡Extremadamente caluroso! Evita salir entre 11:00 y 16:00. Protector solar SPF 50+.",
        rec_hot: "☀️ Muy caluroso. Mantente hidratado y busca sombra.",
        rec_warm: "🌤️ Caluroso. Usa protector solar y gafas de sol.",
        rec_nice: "🌈 Condiciones agradables. Disfruta tu día.",
        rec_cool: "🍂 Fresco. Lleva una chaqueta ligera.",
        rec_cold: "❄️ Frío. Abrígate bien y evita exposición prolongada.",
        rec_freeze: "🥶 ¡Congelante! Riesgo de hipotermia. Sal solo si es necesario.",
        tip_uv: "Usa protector solar SPF 30+, gafas de sol y sombrero. Evita el sol entre 10:00 y 16:00.",
        tip_tsunami: "Si sientes un sismo fuerte cerca de la costa, dirígete a zonas altas.",
        tip_fire: "Si estás en zona de evacuación, sigue las rutas designadas. Cubre boca y nariz.",
        tip_storm: "Refúgiate en interior. Evita ventanas. Desconecta aparatos eléctricos.",
        tip_rain: "Evita cruzar zonas inundadas. No conduzcas por calles con agua acumulada.",
        tip_cold_wave: "Abrígate en capas. Consume alimentos calientes. Revisa a personas mayores.",
        tip_volcano: "Usa mascarilla N95. Mantén puertas y ventanas cerradas si hay ceniza.",
        tip_drought: "Raciona el agua. Reporta fugas. Sigue restricciones municipales.",
        earthquake: "SISMO", critical: "CRÍTICO", high: "ALTO", medium: "MEDIO",
        prevention: "PREVENCIÓN", emergency: "EMERGENCIA", caution: "PRECAUCIÓN"
    },
    en: {
        tab_alerts: "Alerts", tab_weather: "Weather", tab_map: "Map",
        detecting: "Detecting...", search: "Search", loading_alerts: "Loading alerts...",
        getting_location: "Getting location...", humidity: "Humidity", wind: "Wind",
        feels_like: "Feels like", pressure: "Pressure", magnitude: "Magnitude",
        source: "Source", depth: "Depth", ago_min: "{n} min ago", ago_hr: "{n}h ago",
        search_placeholder: "City, country...", search_title: "Search location",
        saved_title: "Saved locations", no_alerts: "No recent alerts",
        error_loading: "Error loading data", updated: "Data updated",
        location_saved: "Location saved", location_removed: "Location removed",
        allow_location: "Allow location access", configure_api: "Set your API Key in js/app.js",
        rec_extreme: "🔥 Extremely hot! Avoid going out between 11AM-4PM. Use SPF 50+ sunscreen.",
        rec_hot: "☀️ Very hot. Stay hydrated and seek shade.",
        rec_warm: "🌤️ Warm. Use sunscreen and sunglasses.",
        rec_nice: "🌈 Pleasant conditions. Enjoy your day.",
        rec_cool: "🍂 Cool. Bring a light jacket.",
        rec_cold: "❄️ Cold. Bundle up and avoid prolonged exposure.",
        rec_freeze: "🥶 Freezing! Risk of hypothermia. Go out only if necessary.",
        tip_uv: "Use SPF 30+ sunscreen, sunglasses and hat. Avoid sun between 10AM-4PM.",
        tip_tsunami: "If you feel a strong earthquake near the coast, head to higher ground.",
        tip_fire: "If in evacuation zone, follow designated routes. Cover mouth and nose.",
        tip_storm: "Shelter indoors. Avoid windows. Unplug electrical devices.",
        tip_rain: "Avoid crossing flooded areas. Don't drive through flooded streets.",
        tip_cold_wave: "Layer up. Eat warm foods. Check on elderly and children.",
        tip_volcano: "Wear N95 mask. Keep doors and windows closed if ash is falling.",
        tip_drought: "Ration water. Report leaks. Follow municipal restrictions.",
        earthquake: "EARTHQUAKE", critical: "CRITICAL", high: "HIGH", medium: "MEDIUM",
        prevention: "PREVENTION", emergency: "EMERGENCY", caution: "CAUTION"
    },
    pt: {
        tab_alerts: "Alertas", tab_weather: "Clima", tab_map: "Mapa",
        detecting: "Detectando...", search: "Buscar", loading_alerts: "Carregando alertas...",
        getting_location: "Obtendo localização...", humidity: "Umidade", wind: "Vento",
        feels_like: "Sensação", pressure: "Pressão", magnitude: "Magnitude",
        source: "Fonte", depth: "Prof", ago_min: "Há {n} min", ago_hr: "Há {n}h",
        search_placeholder: "Cidade, país...", search_title: "Buscar localização",
        earthquake: "TERREMOTO", critical: "CRÍTICO", high: "ALTO", medium: "MÉDIO",
        prevention: "PREVENÇÃO", emergency: "EMERGÊNCIA", caution: "PRECAUÇÃO",
        rec_nice: "🌈 Condições agradáveis. Aproveite o dia.",
        updated: "Dados atualizados", location_saved: "Localização salva",
    },
    fr: {
        tab_alerts: "Alertes", tab_weather: "Météo", tab_map: "Carte",
        detecting: "Détection...", search: "Chercher", earthquake: "SÉISME",
        humidity: "Humidité", wind: "Vent", feels_like: "Ressenti", pressure: "Pression",
        rec_nice: "🌈 Conditions agréables. Profitez de votre journée.",
        updated: "Données mises à jour",
    }
};

let currentLang = 'es';

function detectLanguage() {
    const browserLang = (navigator.language || navigator.userLanguage || 'es').substring(0, 2);
    const saved = localStorage.getItem('ag_lang');
    if (saved && TRANSLATIONS[saved]) return saved;
    if (TRANSLATIONS[browserLang]) return browserLang;
    return 'es';
}

function t(key) {
    return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key])
        || (TRANSLATIONS['es'] && TRANSLATIONS['es'][key])
        || key;
}

function setLanguage(lang) {
    if (!TRANSLATIONS[lang]) lang = 'es';
    currentLang = lang;
    localStorage.setItem('ag_lang', lang);
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.placeholder = t('search_placeholder');
}

// Init language
currentLang = detectLanguage();
