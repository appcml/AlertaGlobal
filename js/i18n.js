// ============================================
// js/i18n.js — Internacionalización
// ============================================
var TRANSLATIONS = {
    es: {
        tab_alerts:"Alertas",tab_weather:"Clima",tab_map:"Mapa",
        detecting:"Detectando...",search:"Buscar",loading_alerts:"Cargando alertas...",
        getting_location:"Obteniendo ubicación...",humidity:"Humedad",wind:"Viento",
        feels_like:"Sensación",pressure:"Presión",magnitude:"Magnitud",
        source:"Fuente",depth:"Prof",ago_min:"Hace {n} min",ago_hr:"Hace {n}h",
        no_alerts:"No hay alertas recientes",updated:"Datos actualizados",
        location_saved:"Ubicación guardada",location_removed:"Ubicación eliminada",
        allow_location:"Toca para detectar ubicación",
        rec_extreme:"🔥 Extremadamente caluroso. Evita salir.",
        rec_hot:"☀️ Muy caluroso. Mantente hidratado.",
        rec_warm:"🌤️ Caluroso. Usa protector solar.",
        rec_nice:"🌈 Condiciones agradables.",
        rec_cool:"🍂 Fresco. Lleva chaqueta.",
        rec_cold:"❄️ Frío. Abrígate bien.",
        rec_freeze:"🥶 Congelante. No salgas sin necesidad.",
        earthquake:"SISMO",critical:"CRÍTICO",high:"ALTO",medium:"MEDIO",
        prevention:"PREVENCIÓN",emergency:"EMERGENCIA",caution:"PRECAUCIÓN",
        global_alerts:"Alertas globales"
    },
    en: {
        tab_alerts:"Alerts",tab_weather:"Weather",tab_map:"Map",
        detecting:"Detecting...",search:"Search",loading_alerts:"Loading alerts...",
        getting_location:"Getting location...",humidity:"Humidity",wind:"Wind",
        feels_like:"Feels like",pressure:"Pressure",magnitude:"Magnitude",
        source:"Source",depth:"Depth",ago_min:"{n} min ago",ago_hr:"{n}h ago",
        no_alerts:"No recent alerts",updated:"Data updated",
        location_saved:"Location saved",location_removed:"Location removed",
        allow_location:"Tap to detect location",
        rec_extreme:"🔥 Extremely hot! Avoid going out.",
        rec_hot:"☀️ Very hot. Stay hydrated.",
        rec_warm:"🌤️ Warm. Use sunscreen.",
        rec_nice:"🌈 Pleasant conditions.",
        rec_cool:"🍂 Cool. Bring a jacket.",
        rec_cold:"❄️ Cold. Bundle up.",
        rec_freeze:"🥶 Freezing! Stay inside.",
        earthquake:"EARTHQUAKE",critical:"CRITICAL",high:"HIGH",medium:"MEDIUM",
        prevention:"PREVENTION",emergency:"EMERGENCY",caution:"CAUTION",
        global_alerts:"Global alerts"
    },
    pt: {
        tab_alerts:"Alertas",tab_weather:"Clima",tab_map:"Mapa",
        detecting:"Detectando...",search:"Buscar",
        earthquake:"TERREMOTO",critical:"CRÍTICO",high:"ALTO",medium:"MÉDIO",
        prevention:"PREVENÇÃO",emergency:"EMERGÊNCIA",caution:"PRECAUÇÃO",
        global_alerts:"Alertas globais",updated:"Dados atualizados"
    },
    fr: {
        tab_alerts:"Alertes",tab_weather:"Météo",tab_map:"Carte",
        detecting:"Détection...",search:"Chercher",
        earthquake:"SÉISME",updated:"Données mises à jour",
        global_alerts:"Alertes mondiales"
    },
    de: {
        tab_alerts:"Warnungen",tab_weather:"Wetter",tab_map:"Karte",
        detecting:"Erkennung...",search:"Suchen",
        earthquake:"ERDBEBEN",updated:"Daten aktualisiert",
        global_alerts:"Globale Warnungen"
    }
};

var currentLang = 'es';

function detectLanguage() {
    try {
        var saved = localStorage.getItem('ag_lang');
        if (saved && TRANSLATIONS[saved]) return saved;
    } catch(e) {}
    var bl = (navigator.language || navigator.userLanguage || 'es').substring(0, 2);
    return TRANSLATIONS[bl] ? bl : 'es';
}

function t(key) {
    if (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) return TRANSLATIONS[currentLang][key];
    if (TRANSLATIONS['es'] && TRANSLATIONS['es'][key]) return TRANSLATIONS['es'][key];
    return key;
}

function setLanguage(lang) {
    if (!TRANSLATIONS[lang]) lang = 'es';
    currentLang = lang;
    try { localStorage.setItem('ag_lang', lang); } catch(e) {}
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
        els[i].textContent = t(els[i].getAttribute('data-i18n'));
    }
}

currentLang = detectLanguage();
