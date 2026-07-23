// ============================================
// js/i18n.js — Internacionalización completa
// 6 idiomas: ES, EN, PT, FR, DE, ZH
// ============================================

var TRANSLATIONS = {
    es: {
        tab_alerts:"Alertas", tab_weather:"Clima", tab_map:"Mapa", tab_sos:"Kit SOS", tab_tips:"Tips",
        detecting:"Detectando...", search:"Buscar", loading_alerts:"Cargando alertas...",
        getting_location:"Obteniendo ubicación...", humidity:"Humedad", wind:"Viento",
        feels_like:"Sensación", pressure:"Presión", magnitude:"Magnitud",
        source:"Fuente", depth:"Prof", ago_min:"Hace {n} min", ago_hr:"Hace {n}h",
        no_alerts:"No hay alertas recientes", updated:"Datos actualizados",
        location_saved:"Ubicación guardada", location_removed:"Ubicación eliminada",
        allow_location:"Toca para detectar ubicación",
        rec_extreme:"🔥 Extremadamente caluroso. Evita salir.",
        rec_hot:"☀️ Muy caluroso. Mantente hidratado.",
        rec_warm:"🌤️ Caluroso. Usa protector solar.",
        rec_nice:"🌈 Condiciones agradables.",
        rec_cool:"🍂 Fresco. Lleva chaqueta.",
        rec_cold:"❄️ Frío. Abrígate bien.",
        rec_freeze:"🥶 Congelante. No salgas sin necesidad.",
        earthquake:"SISMO", critical:"CRÍTICO", high:"ALTO", medium:"MEDIO",
        prevention:"PREVENCIÓN", emergency:"EMERGENCIA", caution:"PRECAUCIÓN",
        global_alerts:"Alertas globales",
        sos_emergency:"Contactos de Emergencia", sos_share:"Compartir Ubicación",
        sos_report:"Reportar Incidente", sos_firstaid:"Primeros Auxilios",
        sos_online:"Modo Online — Datos en tiempo real",
        lang_select:"Seleccionar idioma", theme_select:"Seleccionar tema"
    },
    en: {
        tab_alerts:"Alerts", tab_weather:"Weather", tab_map:"Map", tab_sos:"SOS Kit", tab_tips:"Tips",
        detecting:"Detecting...", search:"Search", loading_alerts:"Loading alerts...",
        getting_location:"Getting location...", humidity:"Humidity", wind:"Wind",
        feels_like:"Feels like", pressure:"Pressure", magnitude:"Magnitude",
        source:"Source", depth:"Depth", ago_min:"{n} min ago", ago_hr:"{n}h ago",
        no_alerts:"No recent alerts", updated:"Data updated",
        location_saved:"Location saved", location_removed:"Location removed",
        allow_location:"Tap to detect location",
        rec_extreme:"🔥 Extremely hot! Avoid going out.",
        rec_hot:"☀️ Very hot. Stay hydrated.",
        rec_warm:"🌤️ Warm. Use sunscreen.",
        rec_nice:"🌈 Pleasant conditions.",
        rec_cool:"🍂 Cool. Bring a jacket.",
        rec_cold:"❄️ Cold. Bundle up.",
        rec_freeze:"🥶 Freezing! Stay inside.",
        earthquake:"EARTHQUAKE", critical:"CRITICAL", high:"HIGH", medium:"MEDIUM",
        prevention:"PREVENTION", emergency:"EMERGENCY", caution:"CAUTION",
        global_alerts:"Global alerts",
        sos_emergency:"Emergency Contacts", sos_share:"Share Location",
        sos_report:"Report Incident", sos_firstaid:"First Aid",
        sos_online:"Online Mode — Real-time data",
        lang_select:"Select language", theme_select:"Select theme"
    },
    pt: {
        tab_alerts:"Alertas", tab_weather:"Clima", tab_map:"Mapa", tab_sos:"Kit SOS", tab_tips:"Dicas",
        detecting:"Detectando...", search:"Buscar", loading_alerts:"Carregando alertas...",
        getting_location:"Obtendo localização...", humidity:"Humidade", wind:"Vento",
        feels_like:"Sensação", pressure:"Pressão", magnitude:"Magnitude",
        source:"Fonte", depth:"Prof", ago_min:"Há {n} min", ago_hr:"Há {n}h",
        no_alerts:"Sem alertas recentes", updated:"Dados atualizados",
        location_saved:"Localização salva", location_removed:"Localização removida",
        allow_location:"Toque para detectar localização",
        rec_extreme:"🔥 Extremamente quente. Evite sair.",
        rec_hot:"☀️ Muito quente. Mantenha-se hidratado.",
        rec_warm:"🌤️ Quente. Use protetor solar.",
        rec_nice:"🌈 Condições agradáveis.",
        rec_cool:"🍂 Fresco. Leve um casaco.",
        rec_cold:"❄️ Frio. Agasalhe-se bem.",
        rec_freeze:"🥶 Congelante. Não saia sem necessidade.",
        earthquake:"TERREMOTO", critical:"CRÍTICO", high:"ALTO", medium:"MÉDIO",
        prevention:"PREVENÇÃO", emergency:"EMERGÊNCIA", caution:"PRECAUÇÃO",
        global_alerts:"Alertas globais",
        sos_emergency:"Contatos de Emergência", sos_share:"Compartilhar Localização",
        sos_report:"Reportar Incidente", sos_firstaid:"Primeiros Socorros",
        sos_online:"Modo Online — Dados em tempo real",
        lang_select:"Selecionar idioma", theme_select:"Selecionar tema"
    },
    fr: {
        tab_alerts:"Alertes", tab_weather:"Météo", tab_map:"Carte", tab_sos:"Kit SOS", tab_tips:"Conseils",
        detecting:"Détection...", search:"Chercher", loading_alerts:"Chargement...",
        getting_location:"Localisation...", humidity:"Humidité", wind:"Vent",
        feels_like:"Ressenti", pressure:"Pression", magnitude:"Magnitude",
        source:"Source", depth:"Prof", ago_min:"Il y a {n} min", ago_hr:"Il y a {n}h",
        no_alerts:"Aucune alerte récente", updated:"Données mises à jour",
        location_saved:"Lieu enregistré", location_removed:"Lieu supprimé",
        allow_location:"Appuyez pour détecter la position",
        rec_extreme:"🔥 Chaleur extrême. Évitez de sortir.",
        rec_hot:"☀️ Très chaud. Restez hydraté.",
        rec_warm:"🌤️ Chaud. Mettez de la crème solaire.",
        rec_nice:"🌈 Conditions agréables.",
        rec_cool:"🍂 Frais. Prenez une veste.",
        rec_cold:"❄️ Froid. Couvrez-vous bien.",
        rec_freeze:"🥶 Gel. Ne sortez pas sans nécessité.",
        earthquake:"SÉISME", critical:"CRITIQUE", high:"ÉLEVÉ", medium:"MOYEN",
        prevention:"PRÉVENTION", emergency:"URGENCE", caution:"ATTENTION",
        global_alerts:"Alertes mondiales",
        sos_emergency:"Contacts d'urgence", sos_share:"Partager la position",
        sos_report:"Signaler un incident", sos_firstaid:"Premiers secours",
        sos_online:"Mode en ligne — Données en temps réel",
        lang_select:"Choisir la langue", theme_select:"Choisir le thème"
    },
    de: {
        tab_alerts:"Warnungen", tab_weather:"Wetter", tab_map:"Karte", tab_sos:"SOS-Kit", tab_tips:"Tipps",
        detecting:"Erkennung...", search:"Suchen", loading_alerts:"Warnungen laden...",
        getting_location:"Standort ermitteln...", humidity:"Feuchtigkeit", wind:"Wind",
        feels_like:"Gefühlt", pressure:"Druck", magnitude:"Stärke",
        source:"Quelle", depth:"Tiefe", ago_min:"Vor {n} Min", ago_hr:"Vor {n}h",
        no_alerts:"Keine aktuellen Warnungen", updated:"Daten aktualisiert",
        location_saved:"Ort gespeichert", location_removed:"Ort entfernt",
        allow_location:"Tippen um Standort zu erkennen",
        rec_extreme:"🔥 Extrem heiß. Bleiben Sie drinnen.",
        rec_hot:"☀️ Sehr heiß. Trinken Sie viel.",
        rec_warm:"🌤️ Warm. Sonnenschutz auftragen.",
        rec_nice:"🌈 Angenehme Bedingungen.",
        rec_cool:"🍂 Kühl. Jacke mitnehmen.",
        rec_cold:"❄️ Kalt. Warm anziehen.",
        rec_freeze:"🥶 Gefrierend. Nicht ohne Not rausgehen.",
        earthquake:"ERDBEBEN", critical:"KRITISCH", high:"HOCH", medium:"MITTEL",
        prevention:"VORBEUGUNG", emergency:"NOTFALL", caution:"VORSICHT",
        global_alerts:"Globale Warnungen",
        sos_emergency:"Notfallkontakte", sos_share:"Standort teilen",
        sos_report:"Vorfall melden", sos_firstaid:"Erste Hilfe",
        sos_online:"Online-Modus — Echtzeit-Daten",
        lang_select:"Sprache wählen", theme_select:"Thema wählen"
    },
    zh: {
        tab_alerts:"警报", tab_weather:"天气", tab_map:"地图", tab_sos:"求救套件", tab_tips:"提示",
        detecting:"检测中...", search:"搜索", loading_alerts:"加载警报...",
        getting_location:"获取位置...", humidity:"湿度", wind:"风速",
        feels_like:"体感温度", pressure:"气压", magnitude:"震级",
        source:"来源", depth:"深度", ago_min:"{n}分钟前", ago_hr:"{n}小时前",
        no_alerts:"暂无近期警报", updated:"数据已更新",
        location_saved:"位置已保存", location_removed:"位置已删除",
        allow_location:"点击检测位置",
        rec_extreme:"🔥 极度炎热，请避免外出。",
        rec_hot:"☀️ 非常热，请保持水分。",
        rec_warm:"🌤️ 温暖，请使用防晒霜。",
        rec_nice:"🌈 天气宜人。",
        rec_cool:"🍂 凉爽，请携带外套。",
        rec_cold:"❄️ 寒冷，请注意保暖。",
        rec_freeze:"🥶 严寒，非必要请勿外出。",
        earthquake:"地震", critical:"严重", high:"高", medium:"中",
        prevention:"预防", emergency:"紧急", caution:"注意",
        global_alerts:"全球警报",
        sos_emergency:"紧急联系人", sos_share:"共享位置",
        sos_report:"报告事件", sos_firstaid:"急救",
        sos_online:"在线模式 — 实时数据",
        lang_select:"选择语言", theme_select:"选择主题"
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
    var val = (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key])
        || (TRANSLATIONS['es'] && TRANSLATIONS['es'][key])
        || key;
    return val;
}

function setLanguage(lang) {
    if (!TRANSLATIONS[lang]) lang = 'es';
    currentLang = lang;
    try { localStorage.setItem('ag_lang', lang); } catch(e) {}
    // Aplicar a todos los elementos con data-i18n
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    // Aplicar dirección RTL si aplica (ninguno de los 6 la necesita)
    document.documentElement.lang = lang;
    // Notificar al resto de la app
    if (typeof window.onLanguageChange === 'function') window.onLanguageChange(lang);
}

currentLang = detectLanguage();
