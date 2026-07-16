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
        search_placeholder:"Ciudad, país...",search_title:"Buscar ubicación",
        no_alerts:"No hay alertas recientes",updated:"Datos actualizados",
        location_saved:"Ubicación guardada",location_removed:"Ubicación eliminada",
        allow_location:"Toca para detectar ubicación",configure_api:"Configura tu API Key",
        rec_extreme:"🔥 ¡Extremadamente caluroso! Evita salir entre 11:00 y 16:00.",
        rec_hot:"☀️ Muy caluroso. Mantente hidratado y busca sombra.",
        rec_warm:"🌤️ Caluroso. Usa protector solar y gafas de sol.",
        rec_nice:"🌈 Condiciones agradables. Disfruta tu día.",
        rec_cool:"🍂 Fresco. Lleva una chaqueta ligera.",
        rec_cold:"❄️ Frío. Abrígate bien.",
        rec_freeze:"🥶 ¡Congelante! Riesgo de hipotermia.",
        tip_uv:"Usa protector solar SPF 30+, gafas y sombrero. Evita sol entre 10:00-16:00.",
        tip_tsunami:"Si sientes un sismo fuerte cerca de la costa, dirígete a zonas altas.",
        tip_fire:"Si estás en zona de evacuación, sigue rutas designadas. Cubre boca y nariz.",
        tip_storm:"Refúgiate en interior. Evita ventanas. Desconecta aparatos eléctricos.",
        tip_rain:"Evita cruzar zonas inundadas. No conduzcas por calles con agua.",
        tip_cold_wave:"Abrígate en capas. Consume alimentos calientes. Revisa a personas mayores.",
        tip_volcano:"Usa mascarilla N95. Mantén puertas y ventanas cerradas.",
        tip_drought:"Raciona el agua. Reporta fugas. Sigue restricciones municipales.",
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
        search_placeholder:"City, country...",search_title:"Search location",
        no_alerts:"No recent alerts",updated:"Data updated",
        location_saved:"Location saved",location_removed:"Location removed",
        allow_location:"Tap to detect location",configure_api:"Set your API Key",
        rec_extreme:"🔥 Extremely hot! Avoid going out 11AM-4PM.",
        rec_hot:"☀️ Very hot. Stay hydrated.",rec_warm:"🌤️ Warm. Use sunscreen.",
        rec_nice:"🌈 Pleasant. Enjoy your day.",rec_cool:"🍂 Cool. Bring a jacket.",
        rec_cold:"❄️ Cold. Bundle up.",rec_freeze:"🥶 Freezing! Stay inside.",
        tip_uv:"Use SPF 30+ sunscreen. Avoid sun 10AM-4PM.",
        tip_tsunami:"Strong coastal earthquake? Head to higher ground.",
        tip_fire:"Follow evacuation routes. Cover mouth and nose.",
        tip_storm:"Shelter indoors. Unplug devices.",
        tip_rain:"Don't cross flooded areas.",
        tip_cold_wave:"Layer up. Check on elderly.",
        tip_volcano:"Wear N95 mask. Close windows.",
        tip_drought:"Ration water. Report leaks.",
        earthquake:"EARTHQUAKE",critical:"CRITICAL",high:"HIGH",medium:"MEDIUM",
        prevention:"PREVENTION",emergency:"EMERGENCY",caution:"CAUTION",
        global_alerts:"Global alerts"
    },
    pt: {
        tab_alerts:"Alertas",tab_weather:"Clima",tab_map:"Mapa",detecting:"Detectando...",
        search:"Buscar",earthquake:"TERREMOTO",critical:"CRÍTICO",high:"ALTO",medium:"MÉDIO",
        global_alerts:"Alertas globais",updated:"Dados atualizados"
    },
    fr: {
        tab_alerts:"Alertes",tab_weather:"Météo",tab_map:"Carte",detecting:"Détection...",
        search:"Chercher",earthquake:"SÉISME",updated:"Données mises à jour",
        global_alerts:"Alertes mondiales"
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
    var si = document.getElementById('searchInput');
    if (si) si.placeholder = t('search_placeholder');
}

currentLang = detectLanguage();
