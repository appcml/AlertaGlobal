// ============================================
// js/sos.js — Kit SOS + Idiomas + Temas
// ============================================

// ── TEMAS (4) ──
var THEMES = {
    dark:  {'--bg':'#0a0a0f','--bg2':'#111122','--card':'#1a1a2e','--text':'#eee','--accent':'#ff6666','--border':'#333'},
    light: {'--bg':'#f5f5f5','--bg2':'#ffffff','--card':'#ffffff','--text':'#111','--accent':'#cc2222','--border':'#ddd'},
    blue:  {'--bg':'#030d1a','--bg2':'#0a1628','--card':'#0d2040','--text':'#e0eeff','--accent':'#4488ff','--border':'#1a3060'},
    green: {'--bg':'#040d04','--bg2':'#0a1a0a','--card':'#0d220d','--text':'#e0ffe0','--accent':'#44cc44','--border':'#1a401a'}
};

function applyTheme(name) {
    var theme = THEMES[name];
    if (!theme) return;
    Object.keys(theme).forEach(function(k) {
        document.documentElement.style.setProperty(k, theme[k]);
    });
    try { localStorage.setItem('ag_theme', name); } catch(e) {}
    var popup = document.getElementById('themePopup');
    if (popup) popup.style.display = 'none';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme['--bg'];
}

// ── IDIOMAS ──
function selectLanguage(lang) {
    if (typeof setLanguage === 'function') setLanguage(lang);
    // Marcar activo
    document.querySelectorAll('.lang-option').forEach(function(b) {
        var isActive = b.dataset.lang === lang;
        b.style.borderColor = isActive ? 'var(--accent)' : '#444';
        b.style.background  = isActive ? '#2a1a1a' : '#222';
    });
    var popup = document.getElementById('langPopup');
    if (popup) popup.style.display = 'none';
    // Reaplicar i18n manualmente a elementos dinámicos del SOS
    applySosI18n();
    renderSOSNumbers();
}

function applySosI18n() {
    // Aplicar traducciones a todos los data-i18n de la página
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
        var key = el.getAttribute('data-i18n');
        if (typeof t === 'function') el.textContent = t(key);
    });
}

// ── NÚMEROS DE EMERGENCIA POR PAÍS ──
var EMERGENCY_NUMBERS = {
    CL: [
        {label:'Bomberos',      n:'132',  icon:'🚒'},
        {label:'Carabineros',   n:'133',  icon:'👮'},
        {label:'SAMU',          n:'131',  icon:'🚑'},
        {label:'Emergencias',   n:'112',  icon:'🆘'},
        {label:'SENAPRED',      n:'1455', icon:'🌊'}
    ],
    AR: [
        {label:'Policía',       n:'101',  icon:'👮'},
        {label:'Bomberos',      n:'100',  icon:'🚒'},
        {label:'Ambulancia',    n:'107',  icon:'🚑'},
        {label:'Emergencias',   n:'911',  icon:'🆘'}
    ],
    PE: [
        {label:'Policía',       n:'105',  icon:'👮'},
        {label:'Bomberos',      n:'116',  icon:'🚒'},
        {label:'Emergencias',   n:'117',  icon:'🆘'}
    ],
    BR: [
        {label:'Polícia',       n:'190',  icon:'👮'},
        {label:'Bombeiros',     n:'193',  icon:'🚒'},
        {label:'SAMU',          n:'192',  icon:'🚑'},
        {label:'Emergências',   n:'190',  icon:'🆘'}
    ],
    MX: [
        {label:'Emergencias',   n:'911',  icon:'🆘'},
        {label:'Policía',       n:'911',  icon:'👮'},
        {label:'Cruz Roja',     n:'065',  icon:'🚑'}
    ],
    US: [
        {label:'Emergency',     n:'911',  icon:'🆘'},
        {label:'FEMA',          n:'1-800-621-3362', icon:'🏛️'}
    ],
    DEFAULT: [
        {label:'Emergencias',   n:'112',  icon:'🆘'},
        {label:'Policía local', n:'101/133', icon:'👮'},
        {label:'Ambulancia',    n:'118/131', icon:'🚑'}
    ]
};

function detectCountryCode() {
    var country = 'DEFAULT';
    if (window.focusLocation && window.focusLocation.country) {
        var cn = (window.focusLocation.country || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        if (cn.includes('chile'))                                    country = 'CL';
        else if (cn.includes('argentina'))                           country = 'AR';
        else if (cn.includes('peru') || cn.includes('per'))          country = 'PE';
        else if (cn.includes('brasil') || cn.includes('brazil'))     country = 'BR';
        else if (cn.includes('mexico') || cn.includes('mejico'))     country = 'MX';
        else if (cn.includes('united states') || cn.includes('eeuu')) country = 'US';
    }
    return country;
}

function renderSOSNumbers() {
    var container = document.getElementById('sosEmergencyNumbers');
    if (!container) return;
    var code = detectCountryCode();
    var nums = EMERGENCY_NUMBERS[code] || EMERGENCY_NUMBERS.DEFAULT;
    container.innerHTML = nums.map(function(n) {
        return '<a href="tel:' + n.n + '" style="display:flex;align-items:center;gap:10px;padding:11px 12px;' +
            'background:#1a1a2e;border:1px solid #333;border-radius:8px;text-decoration:none;color:#fff;transition:border-color 0.2s;" ' +
            'onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'#333\'">' +
            '<span style="font-size:24px">' + n.icon + '</span>' +
            '<div><div style="font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px">' + n.label + '</div>' +
            '<div style="font-size:22px;font-weight:bold;color:var(--accent);line-height:1.1">' + n.n + '</div></div>' +
            '<span style="margin-left:auto;font-size:18px;color:#aaa">📞</span></a>';
    }).join('');
}

// ── BOTÓN EMERGENCIA PRINCIPAL ──
function triggerSOS() {
    var code = detectCountryCode();
    var num = code === 'CL' ? '112' :
              code === 'AR' ? '911' :
              code === 'PE' ? '117' :
              code === 'BR' ? '190' :
              code === 'US' ? '911' : '112';
    if (confirm('¿Llamar al ' + num + ' — Número de Emergencias?')) {
        window.location.href = 'tel:' + num;
    }
}

// ── COMPARTIR UBICACIÓN DE EMERGENCIA ──
function shareEmergencyLocation() {
    var loc = window.focusLocation || window.deviceLocation;
    var lat = loc && loc.lat;
    var lon = loc && loc.lon;
    var name = (loc && loc.name) || 'Mi ubicación';
    if (!lat || !lon) {
        alert('No se pudo obtener la ubicación. Activa el GPS e intenta de nuevo.');
        return;
    }
    var msg = '🆘 EMERGENCIA - Necesito ayuda\n' +
              '📍 ' + name + '\n' +
              'Coordenadas: ' + lat.toFixed(5) + ', ' + lon.toFixed(5) + '\n' +
              '🗺️ https://maps.google.com/?q=' + lat + ',' + lon;
    if (navigator.share) {
        navigator.share({ title: '🆘 EMERGENCIA', text: msg }).catch(function(){});
    } else {
        navigator.clipboard.writeText(msg)
            .then(function() { alert('📋 Copiado. Pega en WhatsApp, SMS o cualquier app.'); })
            .catch(function() { window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank'); });
    }
}

// ── LINTERNA ──
var _flashOn = false, _flashTrack = null;
function toggleFlashlight() {
    var btn = document.getElementById('btnFlashlight');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Linterna no disponible en este dispositivo o navegador.');
        return;
    }
    if (!_flashOn) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(function(stream) {
                _flashTrack = stream.getVideoTracks()[0];
                return _flashTrack.applyConstraints({ advanced: [{ torch: true }] });
            })
            .then(function() {
                _flashOn = true;
                if (btn) { btn.textContent = '🌑 Apagar'; btn.style.color = '#ff6666'; }
            })
            .catch(function() { alert('No se pudo activar la linterna. Intenta desde la app nativa.'); });
    } else {
        if (_flashTrack) {
            _flashTrack.applyConstraints({ advanced: [{ torch: false }] });
            _flashTrack.stop();
            _flashTrack = null;
        }
        _flashOn = false;
        if (btn) { btn.textContent = '💡 Encender'; btn.style.color = ''; }
    }
}

// ── PRIMEROS AUXILIOS ──
var FIRST_AID_GUIDES = {
    es: [
        { t:'🫀 RCP (Reanimación Cardiopulmonar)', s:[
            'Llama al número de emergencias INMEDIATAMENTE',
            'Acuesta a la persona boca arriba en superficie dura',
            '30 compresiones en el centro del pecho: fuerte (5cm) y rápido (100/min)',
            '2 respiraciones de rescate: sella la boca y sopla hasta ver subir el pecho',
            'Repite ciclos 30:2 hasta que llegue la ayuda o la persona reaccione'
        ]},
        { t:'🩸 Hemorragia grave', s:[
            'Presiona la herida con tela limpia o gasas con firmeza',
            'Mantén presión constante por mínimo 10 minutos SIN soltar',
            'Si la tela se empapa, agrega más encima (no la retires)',
            'Eleva la extremidad afectada por encima del corazón si es posible',
            'Llama al 131 (SAMU) o número de emergencias local'
        ]},
        { t:'🔥 Quemaduras', s:[
            'Enfría con agua fría corriente por 20 minutos MÍNIMO',
            'No uses hielo, mantequilla, pasta de dientes ni cremas',
            'Cubre con tela limpia y húmeda (no algodón)',
            'No revientes las ampollas que se formen',
            'Busca atención médica urgente si es extensa o en cara/manos'
        ]},
        { t:'🌍 Terremoto (durante)', s:[
            'AGÁCHATE, CÚBRETE y AGÁRRATE — no corras',
            'Protégete bajo una mesa sólida o junto a un muro interior resistente',
            'Cúbrete la cabeza con los brazos si no hay refugio',
            'Si estás afuera, aléjate de edificios, postes y cables eléctricos',
            'Espera a que el movimiento pare COMPLETAMENTE antes de moverte'
        ]},
        { t:'🌊 Tsunami (alerta)', s:[
            'ALÉJATE DE LA COSTA INMEDIATAMENTE — no esperes confirmación',
            'Sube a terreno elevado: mínimo 30 metros sobre el nivel del mar',
            'Si el mar retrocede bruscamente, es señal: CORRE hacia arriba',
            'Lleva solo lo esencial, no pierdas tiempo con objetos',
            'No regreses a la costa hasta autorización oficial de SENAPRED'
        ]},
        { t:'🔴 Atragantamiento', s:[
            'Si puede toser, anímale a toser fuerte con fuerza',
            'Si no puede: 5 golpes fuertes en la espalda entre los omóplatos',
            '5 compresiones abdominales (maniobra de Heimlich): abraza por detrás y empuja hacia arriba',
            'Alterna 5 golpes espalda + 5 compresiones abdominales',
            'Llama al número de emergencias si no mejora en 1 minuto'
        ]},
        { t:'🐍 Mordedura de serpiente', s:[
            'Mantén calma y limita el movimiento de la zona afectada',
            'Retira anillos, relojes o ropa ajustada cerca de la mordedura',
            'NO hagas cortes, NO chupes el veneno, NO apliques torniquete',
            'Mantén la extremidad por DEBAJO del nivel del corazón',
            'Lleva a urgencias INMEDIATAMENTE con descripción de la serpiente'
        ]}
    ],
    en: [
        { t:'🫀 CPR', s:[
            'Call emergency services IMMEDIATELY',
            'Lay person on their back on a hard surface',
            '30 chest compressions: hard (2in) and fast (100/min) on center of chest',
            '2 rescue breaths: seal mouth and blow until chest rises',
            'Repeat 30:2 until help arrives or person responds'
        ]},
        { t:'🩸 Severe Bleeding', s:[
            'Apply firm pressure with clean cloth or gauze',
            'Hold constant pressure for at least 10 minutes without releasing',
            'Add more cloth on top if soaked (do not remove)',
            'Elevate the limb above heart level if possible',
            'Call emergency services immediately'
        ]},
        { t:'🌍 Earthquake (during)', s:[
            'DROP, COVER, and HOLD ON — do not run',
            'Get under a sturdy table or against an interior wall',
            'Cover your head with your arms if no shelter available',
            'If outside, move away from buildings, poles, and power lines',
            'Wait until shaking stops completely before moving'
        ]},
        { t:'🌊 Tsunami', s:[
            'Move AWAY from coast IMMEDIATELY',
            'Go to high ground: at least 30 meters above sea level',
            'If the sea recedes suddenly, RUN uphill',
            'Take only essentials, do not waste time',
            'Do not return until official all-clear'
        ]}
    ]
};

function openFirstAid() {
    var lang = (typeof currentLang !== 'undefined') ? currentLang : 'es';
    var guides = FIRST_AID_GUIDES[lang] || FIRST_AID_GUIDES.es;
    var popup = document.getElementById('firstAidPopup');
    var ct = document.getElementById('firstAidDetail');
    if (!popup || !ct) return;
    ct.innerHTML = guides.map(function(g) {
        return '<div style="margin-bottom:16px;padding:14px;background:#1a1a2e;border-radius:8px;border-left:3px solid var(--accent);">' +
            '<div style="font-weight:bold;font-size:14px;color:var(--accent);margin-bottom:10px;">' + g.t + '</div>' +
            '<ol style="margin:0;padding-left:20px;">' +
            g.s.map(function(s) { return '<li style="margin-bottom:6px;line-height:1.5;">' + s + '</li>'; }).join('') +
            '</ol></div>';
    }).join('');
    popup.style.display = 'flex';
}

function openOfflineGuide() { openFirstAid(); }

// ── INICIALIZACIÓN ──
document.addEventListener('DOMContentLoaded', function() {
    // Aplicar tema guardado
    var savedTheme = localStorage.getItem('ag_theme') || 'dark';
    if (savedTheme !== 'dark') applyTheme(savedTheme);

    // Marcar idioma activo en el popup
    var savedLang = localStorage.getItem('ag_lang') || 'es';
    document.querySelectorAll('.lang-option').forEach(function(b) {
        if (b.dataset.lang === savedLang) {
            b.style.borderColor = 'var(--accent)';
            b.style.background  = '#2a1a1a';
        }
    });

    // Conectar botón 🌐
    var btnLang = document.getElementById('btnLang');
    if (btnLang) btnLang.addEventListener('click', function() {
        applySosI18n(); // actualizar traducciones antes de mostrar
        document.getElementById('langPopup').style.display = 'flex';
    });

    // Conectar botón 🎨
    var btnTheme = document.getElementById('btnTheme');
    if (btnTheme) btnTheme.addEventListener('click', function() {
        document.getElementById('themePopup').style.display = 'flex';
    });

    // Cerrar popups al hacer click fuera
    ['langPopup', 'themePopup', 'firstAidPopup'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('click', function(e) {
            if (e.target === this) this.style.display = 'none';
        });
    });

    // Renderizar números al entrar en tab SOS
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            if (this.dataset.tab === 'sos') {
                setTimeout(function() {
                    renderSOSNumbers();
                    applySosI18n();
                }, 50);
            }
        });
    });

    // Aplicar i18n al cargar
    setTimeout(applySosI18n, 200);
    setTimeout(renderSOSNumbers, 300);
});

// Hook para cuando cambia el idioma desde app.js
window.onLanguageChange = function(lang) {
    applySosI18n();
    renderSOSNumbers();
};
