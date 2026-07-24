// ============================================
// js/sos.js — Kit SOS + Idiomas + Temas v2
// ============================================

// ── TEMAS (4) ──
var THEMES = {
    dark:  {'--bg':'#0a0a0f','--bg2':'#111122','--card':'#1a1a2e','--text':'#eee','--accent':'#ff6666','--border':'#333'},
    light: {'--bg':'#f5f5f5','--bg2':'#ffffff','--card':'#ffffff','--text':'#111','--accent':'#cc2222','--border':'#ddd'},
    blue:  {'--bg':'#030d1a','--bg2':'#0a1628','--card':'#0d2040','--text':'#e0eeff','--accent':'#4488ff','--border':'#1a3060'},
    green: {'--bg':'#040d04','--bg2':'#0a1a0a','--card':'#0d220d','--text':'#e0ffe0','--accent':'#44cc44','--border':'#1a401a'}
};
function applyTheme(name) {
    var theme = THEMES[name]; if (!theme) return;
    Object.keys(theme).forEach(function(k) { document.documentElement.style.setProperty(k, theme[k]); });
    try { localStorage.setItem('ag_theme', name); } catch(e) {}
    var p = document.getElementById('themePopup'); if (p) p.style.display = 'none';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme['--bg'];
}

// ── IDIOMAS ──
function selectLanguage(lang) {
    if (typeof setLanguage === 'function') setLanguage(lang);
    document.querySelectorAll('.lang-option').forEach(function(b) {
        var a = b.dataset.lang === lang;
        b.style.borderColor = a ? 'var(--accent)' : '#444';
        b.style.background  = a ? '#2a1a1a' : '#222';
    });
    var p = document.getElementById('langPopup'); if (p) p.style.display = 'none';
    applySosI18n();
    renderSOSNumbers();
    if (typeof refreshSmartTips === 'function') refreshSmartTips();
}
function applySosI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
        if (typeof t === 'function') el.textContent = t(el.getAttribute('data-i18n'));
    });
}
window.onLanguageChange = function(lang) { applySosI18n(); renderSOSNumbers(); };

// ── NÚMEROS DE EMERGENCIA ──
// Números de emergencia por país — actualizados y verificados
var EMERGENCY_NUMBERS = {
    // América del Sur
    CL:[
        {label:'Bomberos',     n:'132',  icon:'🚒'},
        {label:'Carabineros',  n:'133',  icon:'👮'},
        {label:'SAMU',         n:'131',  icon:'🚑'},
        {label:'Emergencias',  n:'112',  icon:'🆘'},
        {label:'SENAPRED',     n:'1455', icon:'🌊'},
        {label:'PDI',          n:'134',  icon:'🔍'}
    ],
    AR:[{label:'Policía',n:'101',icon:'👮'},{label:'Bomberos',n:'100',icon:'🚒'},
        {label:'Ambulancia',n:'107',icon:'🚑'},{label:'Emergencias',n:'911',icon:'🆘'}],
    PE:[{label:'Policía',n:'105',icon:'👮'},{label:'Bomberos',n:'116',icon:'🚒'},
        {label:'Emergencias',n:'117',icon:'🆘'},{label:'INDECI',n:'115',icon:'🌊'}],
    BR:[{label:'Polícia',n:'190',icon:'👮'},{label:'Bombeiros',n:'193',icon:'🚒'},
        {label:'SAMU',n:'192',icon:'🚑'},{label:'Emergências',n:'190',icon:'🆘'}],
    CO:[{label:'Policía',n:'112',icon:'👮'},{label:'Bomberos',n:'119',icon:'🚒'},
        {label:'Ambulancia',n:'132',icon:'🚑'},{label:'Emergencias',n:'123',icon:'🆘'}],
    VE:[{label:'Policía',n:'171',icon:'👮'},{label:'Bomberos',n:'166',icon:'🚒'},
        {label:'Emergencias',n:'171',icon:'🆘'}],
    EC:[{label:'Policía',n:'101',icon:'👮'},{label:'Bomberos',n:'102',icon:'🚒'},
        {label:'Emergencias',n:'911',icon:'🆘'}],
    BO:[{label:'Policía',n:'110',icon:'👮'},{label:'Bomberos',n:'119',icon:'🚒'},
        {label:'Emergencias',n:'118',icon:'🆘'}],
    PY:[{label:'Policía',n:'911',icon:'👮'},{label:'Bomberos',n:'132',icon:'🚒'},
        {label:'Emergencias',n:'911',icon:'🆘'}],
    UY:[{label:'Policía',n:'911',icon:'👮'},{label:'Bomberos',n:'104',icon:'🚒'},
        {label:'Emergencias',n:'911',icon:'🆘'}],
    // América del Norte y Central
    MX:[{label:'Emergencias',n:'911',icon:'🆘'},{label:'Policía',n:'911',icon:'👮'},
        {label:'Bomberos',n:'068',icon:'🚒'},{label:'Cruz Roja',n:'065',icon:'🚑'}],
    US:[{label:'Emergency',n:'911',icon:'🆘'},{label:'Police/Fire/EMS',n:'911',icon:'👮'},
        {label:'FEMA',n:'1-800-621-3362',icon:'🏛️'},{label:'Poison Control',n:'1-800-222-1222',icon:'☠️'}],
    CA:[{label:'Emergency',n:'911',icon:'🆘'},{label:'Police',n:'911',icon:'👮'},
        {label:'Ambulance',n:'911',icon:'🚑'}],
    // Europa
    ES:[{label:'Emergencias',n:'112',icon:'🆘'},{label:'Policía',n:'091',icon:'👮'},
        {label:'Bomberos',n:'080',icon:'🚒'},{label:'Ambulancia',n:'061',icon:'🚑'}],
    FR:[{label:'Urgences',n:'112',icon:'🆘'},{label:'Police',n:'17',icon:'👮'},
        {label:'Pompiers',n:'18',icon:'🚒'},{label:'SAMU',n:'15',icon:'🚑'}],
    DE:[{label:'Notruf',n:'112',icon:'🆘'},{label:'Polizei',n:'110',icon:'👮'},
        {label:'Feuerwehr',n:'112',icon:'🚒'},{label:'Rettungsdienst',n:'112',icon:'🚑'}],
    IT:[{label:'Emergenze',n:'112',icon:'🆘'},{label:'Polizia',n:'113',icon:'👮'},
        {label:'Vigili del Fuoco',n:'115',icon:'🚒'},{label:'Ambulanza',n:'118',icon:'🚑'}],
    GB:[{label:'Emergency',n:'999',icon:'🆘'},{label:'Police/Fire/Ambulance',n:'999',icon:'👮'},
        {label:'Non-emergency police',n:'101',icon:'🔍'}],
    PT:[{label:'Emergência',n:'112',icon:'🆘'},{label:'Polícia',n:'112',icon:'👮'},
        {label:'Bombeiros',n:'112',icon:'🚒'},{label:'INEM',n:'112',icon:'🚑'}],
    // Asia-Pacífico
    JP:[{label:'警察 (Police)',n:'110',icon:'👮'},{label:'消防 (Fire/EMS)',n:'119',icon:'🚒'},
        {label:'緊急 (Emergency)',n:'119',icon:'🆘'}],
    AU:[{label:'Emergency',n:'000',icon:'🆘'},{label:'Police/Fire/Ambulance',n:'000',icon:'👮'},
        {label:'SES',n:'132 500',icon:'🌊'}],
    CN:[{label:'警察 (Police)',n:'110',icon:'👮'},{label:'消防 (Fire)',n:'119',icon:'🚒'},
        {label:'急救 (EMS)',n:'120',icon:'🚑'}],
    // Predeterminado internacional
    DEFAULT:[{label:'Emergencias / Emergency',n:'112',icon:'🆘'},
             {label:'Policía / Police',n:'101/110/133',icon:'👮'},
             {label:'Ambulancia / Ambulance',n:'118/119/131',icon:'🚑'},
             {label:'Bomberos / Fire',n:'100/119/132',icon:'🚒'}]
};
// Mapa de códigos de país ISO → código interno
var ISO_TO_CODE = {
    'cl':'CL','ar':'AR','pe':'PE','br':'BR','co':'CO','ve':'VE','ec':'EC',
    'bo':'BO','py':'PY','uy':'UY','mx':'MX','us':'US','ca':'CA','es':'ES',
    'fr':'FR','de':'DE','it':'IT','gb':'GB','pt':'PT','jp':'JP','au':'AU',
    'cn':'CN','ru':'RU','kr':'KR','in':'IN','za':'ZA','ng':'NG','eg':'EG',
    'tr':'TR','sa':'SA','id':'ID','ph':'PH','th':'TH','vn':'VN','my':'MY'
};

// Números para países adicionales
EMERGENCY_NUMBERS['RU'] = [{label:'Policía',n:'102',icon:'👮'},{label:'Bomberos',n:'101',icon:'🚒'},{label:'Ambulancia',n:'103',icon:'🚑'},{label:'Emergencias',n:'112',icon:'🆘'}];
EMERGENCY_NUMBERS['KR'] = [{label:'Police',n:'112',icon:'👮'},{label:'Fire/EMS',n:'119',icon:'🚒'},{label:'Emergency',n:'119',icon:'🆘'}];
EMERGENCY_NUMBERS['IN'] = [{label:'Police',n:'100',icon:'👮'},{label:'Fire',n:'101',icon:'🚒'},{label:'Ambulance',n:'102',icon:'🚑'},{label:'Emergency',n:'112',icon:'🆘'}];

function detectCountryCode() {
    // Intentar desde focusLocation primero, luego deviceLocation
    var loc = window.focusLocation || window.deviceLocation;
    var country = (loc && loc.country) || '';
    
    // Si tenemos código ISO directo (de Nominatim viene como country_code)
    if (loc && loc.countryCode) {
        var iso = loc.countryCode.toLowerCase();
        if (ISO_TO_CODE[iso]) return ISO_TO_CODE[iso];
    }
    
    // Detectar por coordenadas geográficas (más fiable que el nombre)
    if (loc && loc.lat && loc.lon) {
        var lat = loc.lat, lon = loc.lon;
        // Bounding boxes aproximados de países clave
        if (lat>=-56&&lat<=-17&&lon>=-76&&lon<=-65) return 'CL'; // Chile
        if (lat>=-55&&lat<=-21&&lon>=-74&&lon<=-53) return 'AR'; // Argentina
        if (lat>=-18&&lat<=0&&lon>=-81&&lon<=-68)   return 'PE'; // Perú
        if (lat>=-34&&lat<=5&&lon>=-74&&lon<=-28)   return 'BR'; // Brasil
        if (lat>=-5&&lat<=13&&lon>=-79&&lon<=-66)   return 'CO'; // Colombia
        if (lat>=14&&lat<=33&&lon>=-118&&lon<=-86)  return 'MX'; // México
        if (lat>=24&&lat<=50&&lon>=-125&&lon<=-65)  return 'US'; // USA
        if (lat>=42&&lat<=84&&lon>=-141&&lon<=-52)  return 'CA'; // Canadá
        if (lat>=36&&lat<=44&&lon>=-9&&lon<=4)      return 'ES'; // España
        if (lat>=41&&lat<=51&&lon>=-5&&lon<=9)      return 'FR'; // Francia
        if (lat>=47&&lat<=55&&lon>=6&&lon<=15)      return 'DE'; // Alemania
        if (lat>=36&&lat<=47&&lon>=6&&lon<=18)      return 'IT'; // Italia
        if (lat>=50&&lat<=61&&lon>=-8&&lon<=2)      return 'GB'; // UK
        if (lat>=37&&lat<=42&&lon>=-9&&lon<=-6)     return 'PT'; // Portugal
        if (lat>=30&&lat<=46&&lon>=26&&lon<=45)     return 'TR'; // Turquía
        if (lat>=50&&lat<=80&&lon>=26&&lon<=180)    return 'RU'; // Rusia
        if (lat>=30&&lat<=45&&lon>=125&&lon<=146)   return 'JP'; // Japón
        if (lat>=-44&&lat<=-10&&lon>=113&&lon<=154) return 'AU'; // Australia
        if (lat>=20&&lat<=54&&lon>=73&&lon<=135)    return 'CN'; // China
        if (lat>=8&&lat<=37&&lon>=68&&lon<=97)      return 'IN'; // India
    }
    
    if (!country) return 'DEFAULT';
    var cn = country.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    // América del Sur
    if (cn.includes('chile'))                                       return 'CL';
    if (cn.includes('argentina'))                                   return 'AR';
    if (cn.includes('peru') || cn.includes('per'))                  return 'PE';
    if (cn.includes('brasil') || cn.includes('brazil'))             return 'BR';
    if (cn.includes('colombia'))                                    return 'CO';
    if (cn.includes('venezuela'))                                   return 'VE';
    if (cn.includes('ecuador'))                                     return 'EC';
    if (cn.includes('bolivia'))                                     return 'BO';
    if (cn.includes('paraguay'))                                    return 'PY';
    if (cn.includes('uruguay'))                                     return 'UY';
    // América del Norte y Central
    if (cn.includes('mexico') || cn.includes('mejico'))             return 'MX';
    if (cn.includes('united states') || cn.includes('eeuu') ||
        cn.includes('estados unidos'))                              return 'US';
    if (cn.includes('canada'))                                      return 'CA';
    // Europa
    if (cn.includes('espana') || cn.includes('spain'))              return 'ES';
    if (cn.includes('france') || cn.includes('francia'))            return 'FR';
    if (cn.includes('germany') || cn.includes('alemania') ||
        cn.includes('deutschland'))                                 return 'DE';
    if (cn.includes('italy') || cn.includes('italia'))              return 'IT';
    if (cn.includes('united kingdom') || cn.includes('reino unido') ||
        cn.includes('england') || cn.includes('great britain'))     return 'GB';
    if (cn.includes('portugal'))                                    return 'PT';
    // Asia-Pacífico
    if (cn.includes('japan') || cn.includes('japon'))               return 'JP';
    if (cn.includes('australia'))                                   return 'AU';
    if (cn.includes('china') || cn.includes('china'))               return 'CN';
    return 'DEFAULT';
}
function renderSOSNumbers() {
    var c = document.getElementById('sosEmergencyNumbers'); if (!c) return;
    var nums = EMERGENCY_NUMBERS[detectCountryCode()]||EMERGENCY_NUMBERS.DEFAULT;
    c.innerHTML = nums.map(function(n) {
        return '<a href="tel:'+n.n+'" style="display:flex;align-items:center;gap:10px;padding:11px 12px;background:#1a1a2e;border:1px solid #333;border-radius:8px;text-decoration:none;color:#fff;">' +
            '<span style="font-size:22px">'+n.icon+'</span>' +
            '<div><div style="font-size:11px;color:#aaa;text-transform:uppercase">'+n.label+'</div>' +
            '<div style="font-size:20px;font-weight:bold;color:var(--accent)">'+n.n+'</div></div>' +
            '<span style="margin-left:auto;font-size:16px;opacity:0.5">📞</span></a>';
    }).join('');
}

// ── EMERGENCIA PRINCIPAL ──
function triggerSOS() {
    var code = detectCountryCode();
    var num = {CL:'112',AR:'911',PE:'117',BR:'190',MX:'911',US:'911'}[code]||'112';
    if (confirm('¿Llamar al '+num+' — Emergencias?')) window.location.href='tel:'+num;
}

// ── COMPARTIR UBICACIÓN ──
function shareEmergencyLocation() {
    var loc = window.focusLocation||window.deviceLocation;
    if (!loc||!loc.lat) { alert('Activa el GPS primero.'); return; }
    var msg = '🆘 EMERGENCIA - Necesito ayuda\n📍 '+(loc.name||'Mi ubicación')+
              '\nLat: '+loc.lat.toFixed(5)+', Lon: '+loc.lon.toFixed(5)+
              '\nhttps://maps.google.com/?q='+loc.lat+','+loc.lon;
    if (navigator.share) navigator.share({title:'🆘 EMERGENCIA',text:msg}).catch(function(){});
    else navigator.clipboard.writeText(msg).then(function(){alert('📋 Copiado. Pega en WhatsApp o SMS.');})
        .catch(function(){window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');});
}

// ── LINTERNA SOS INTERMITENTE ──
var _flashOn = false, _flashTrack = null, _sosInterval = null;
// Patrón SOS Morse: ···−−−··· (3 cortos, 3 largos, 3 cortos)
var SOS_PATTERN = [
    200,200, 200,200, 200,600,   // ···
    600,200, 600,200, 600,600,   // −−−
    200,200, 200,200, 200,2000   // ···  pausa larga
];

function toggleFlashlight() {
    var btn = document.getElementById('btnFlashlight');
    if (!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) {
        alert('Linterna no disponible en este dispositivo.'); return;
    }
    if (!_flashOn) {
        navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
            .then(function(stream) {
                _flashTrack = stream.getVideoTracks()[0];
                _flashOn = true;
                if (btn) { btn.textContent = '🆘 Detener SOS'; btn.style.color='#ff4444'; }
                startSOSPattern();
            }).catch(function() { alert('No se pudo activar la linterna.'); });
    } else {
        stopFlashlight();
        if (btn) { btn.textContent = '🔦 Señal SOS'; btn.style.color=''; }
    }
}

function startSOSPattern() {
    var idx = 0;
    var isOn = false;
    function step() {
        if (!_flashOn || !_flashTrack) return;
        isOn = !isOn;
        _flashTrack.applyConstraints({advanced:[{torch: isOn}]}).catch(function(){});
        idx = (idx + 1) % SOS_PATTERN.length;
        _sosInterval = setTimeout(step, SOS_PATTERN[idx]);
    }
    step();
}

function stopFlashlight() {
    if (_sosInterval) { clearTimeout(_sosInterval); _sosInterval = null; }
    if (_flashTrack) {
        _flashTrack.applyConstraints({advanced:[{torch:false}]}).catch(function(){});
        _flashTrack.stop();
        _flashTrack = null;
    }
    _flashOn = false;
}

// ── RADIO DE EMERGENCIA ──
// Frecuencias de emergencia internacionales + apps de radio
var RADIO_INFO = {
    CL: {
        freqs: [
            {name:'Radio Cooperativa', freq:'95.3 FM / 88.5 FM Santiago', desc:'Noticias nacionales 24h'},
            {name:'Radio Bío-Bío', freq:'99.3 FM Concepción / Streaming', desc:'Cobertura de emergencias'},
            {name:'SENAPRED Oficial', freq:'Emergencias: llamar al 1455', desc:'Sistema nacional de alerta'},
            {name:'Radio Patagonia', freq:'101.7 FM Zona Sur', desc:'Cobertura regional'}
        ],
        apps: [
            {name:'Zello Walkie Talkie', url:'https://zello.com', desc:'Push-to-talk por internet, ideal para emergencias'},
            {name:'Broadcastify', url:'https://www.broadcastify.com/listen/', desc:'Radio de escáneres de policía y bomberos en vivo'},
            {name:'Radio Garden', url:'https://radio.garden', desc:'Radios locales de todo Chile en tiempo real'}
        ]
    },
    DEFAULT: {
        freqs: [
            {name:'Frecuencia Internacional SOS', freq:'156.8 MHz (Canal 16 VHF)', desc:'Canal de socorro marítimo mundial'},
            {name:'Radio AM Emergencias', freq:'AM 530-1600 kHz', desc:'Sintoniza emisoras locales de noticias'},
            {name:'Frecuencia Aviación', freq:'121.5 MHz', desc:'Frecuencia internacional de emergencia aérea'}
        ],
        apps: [
            {name:'Zello Walkie Talkie', url:'https://zello.com', desc:'Comunicación push-to-talk por internet'},
            {name:'Broadcastify', url:'https://www.broadcastify.com/listen/', desc:'Escáner de radio policial y emergencias en vivo'},
            {name:'Radio Garden', url:'https://radio.garden', desc:'Radios locales de todo el mundo'}
        ]
    }
};

function openRadioPanel() {
    var popup = document.getElementById('radioPopup');
    var ct = document.getElementById('radioContent');
    if (!popup||!ct) return;
    var info = RADIO_INFO[detectCountryCode()]||RADIO_INFO.DEFAULT;
    ct.innerHTML =
        '<div style="margin-bottom:16px;">' +
        '<div style="color:#aaa;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📻 Frecuencias de Emergencia</div>' +
        info.freqs.map(function(f) {
            return '<div style="padding:10px;background:#1a1a2e;border-radius:6px;margin-bottom:6px;border-left:3px solid var(--accent);">' +
                '<div style="font-weight:bold;font-size:13px;color:#fff">'+f.name+'</div>' +
                '<div style="font-size:12px;color:var(--accent);margin:2px 0">📡 '+f.freq+'</div>' +
                '<div style="font-size:11px;color:#aaa">'+f.desc+'</div></div>';
        }).join('') +
        '</div>' +
        '<div>' +
        '<div style="color:#aaa;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📱 Apps Walkie-Talkie / Radio Online</div>' +
        info.apps.map(function(a) {
            return '<a href="'+a.url+'" target="_blank" style="display:block;padding:10px;background:#1a1a2e;border-radius:6px;margin-bottom:6px;text-decoration:none;border:1px solid #333;">' +
                '<div style="font-weight:bold;font-size:13px;color:var(--accent)">'+a.name+' ↗</div>' +
                '<div style="font-size:11px;color:#aaa;margin-top:2px">'+a.desc+'</div></a>';
        }).join('') +
        '</div>' +
        '<div style="padding:10px;background:#0a1628;border-radius:6px;margin-top:12px;font-size:11px;color:#88aaff;">' +
        '💡 <b>Nota:</b> Los celulares modernos tienen chip FM pero requieren auriculares como antena. ' +
        'Conecta auriculares y usa una app FM para captar señales locales sin internet.' +
        '</div>';
    popup.style.display = 'flex';
}

// ── PRIMEROS AUXILIOS (movido a Tips — aquí solo guía rápida) ──
var FIRST_AID_QUICK = {
    es:[
        {t:'🫀 RCP',s:['Llama al 112','30 compresiones centro del pecho fuerte y rápido','2 respiraciones de rescate','Repite hasta que llegue ayuda']},
        {t:'🩸 Hemorragia',s:['Presiona con tela limpia 10 min','No retires la tela','Eleva la extremidad','Llama al 131']},
        {t:'🔥 Quemaduras',s:['Agua fría 20 min','No uses hielo ni cremas','Cubre con tela húmeda','Busca urgencias']},
        {t:'🌍 Terremoto',s:['Agáchate, cúbrete, agárrate','Lejos de ventanas','Espera que pare','Aléjate de la costa']},
        {t:'🌊 Tsunami',s:['ALÉJATE de la costa YA','Sube a 30m+ de altura','No esperes ver el mar','Sigue a SENAPRED']},
        {t:'🔴 Atragantamiento',s:['5 golpes entre omóplatos','5 compresiones abdominales','Alterna hasta que salga','Llama al 131']}
    ],
    en:[
        {t:'🫀 CPR',s:['Call 911','30 hard chest compressions','2 rescue breaths','Repeat until help arrives']},
        {t:'🩸 Bleeding',s:['Press firmly 10 min','Do not remove cloth','Elevate limb','Call emergency services']},
        {t:'🌍 Earthquake',s:['Drop, Cover, Hold On','Away from windows','Wait until stops','Move away from coast']}
    ]
};

function openFirstAid() {
    var lang = (typeof currentLang!=='undefined')?currentLang:'es';
    var guides = FIRST_AID_QUICK[lang]||FIRST_AID_QUICK.es;
    var popup = document.getElementById('firstAidPopup'), ct = document.getElementById('firstAidDetail');
    if (!popup||!ct) return;
    ct.innerHTML = guides.map(function(g) {
        return '<div style="margin-bottom:14px;padding:12px;background:#1a1a2e;border-radius:8px;border-left:3px solid var(--accent);">' +
            '<div style="font-weight:bold;font-size:14px;color:var(--accent);margin-bottom:8px;">'+g.t+'</div>' +
            '<ol style="margin:0;padding-left:18px;">'+g.s.map(function(s){return '<li style="margin-bottom:5px;">'+s+'</li>';}).join('')+'</ol></div>';
    }).join('');
    popup.style.display = 'flex';
}
function openOfflineGuide(){openFirstAid();}

// ── INICIALIZACIÓN ──
document.addEventListener('DOMContentLoaded', function() {
    // Aplicar tema guardado
    var savedTheme = localStorage.getItem('ag_theme')||'dark';
    if (savedTheme !== 'dark') applyTheme(savedTheme);

    // Marcar idioma activo
    var savedLang = localStorage.getItem('ag_lang')||'es';
    document.querySelectorAll('.lang-option').forEach(function(b) {
        if (b.dataset.lang === savedLang) { b.style.borderColor='var(--accent)'; b.style.background='#2a1a1a'; }
    });

    // Botón idioma
    var btnLang = document.getElementById('btnLang');
    if (btnLang) btnLang.addEventListener('click', function() {
        applySosI18n();
        document.getElementById('langPopup').style.display='flex';
    });
    // Botón tema
    var btnTheme = document.getElementById('btnTheme');
    if (btnTheme) btnTheme.addEventListener('click', function() {
        document.getElementById('themePopup').style.display='flex';
    });

    // Cerrar popups al click fuera
    ['langPopup','themePopup','firstAidPopup','radioPopup'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('click', function(e){ if(e.target===this) this.style.display='none'; });
    });

    // Al entrar en tab SOS
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            if (this.dataset.tab==='sos') {
                setTimeout(function(){ renderSOSNumbers(); applySosI18n(); }, 50);
            }
            if (this.dataset.tab==='tips') {
                setTimeout(function(){ if(typeof refreshSmartTips==='function') refreshSmartTips(); }, 50);
            }
        });
    });

    // Limpiar linterna al salir de la página
    window.addEventListener('beforeunload', stopFlashlight);

    setTimeout(applySosI18n, 200);
    setTimeout(renderSOSNumbers, 300);
    // Reintentar después de que geolocalización tenga tiempo de completarse
    setTimeout(renderSOSNumbers, 2000);
    setTimeout(renderSOSNumbers, 5000);
    
    // Observer: re-renderizar cuando cambie el nombre de ubicación
    var _locObserver = new MutationObserver(function() {
        renderSOSNumbers();
    });
    var _locEl = document.getElementById('currentLocationName');
    if (_locEl) _locObserver.observe(_locEl, { childList: true, characterData: true, subtree: true });
});
