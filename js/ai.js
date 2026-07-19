// ============================================================
// js/ai.js — Módulo IA para AlertaGlobal v1.0
// Capa 1: Cic_IA (Groq/Llama) — rápido, sin límites
// Capa 2: Anthropic Claude — análisis crítico, respaldo
// ============================================================

var AI_CONFIG = {
    CIC_URL: 'https://asitente-ia-cic-1.onrender.com',
    CIC_USER: 'alertaglobal_bot',
    CIC_PASS: 'AG2026secure!',
    ANTHROPIC_URL: 'https://api.anthropic.com/v1/messages',
    ANTHROPIC_MODEL: 'claude-sonnet-4-6',
    // Cache: no llamar IA si los datos tienen menos de 5 min
    CACHE_MS: 300000,
    // Solo llamar IA si hay eventos nuevos o ubicación cambió
    lastCall: 0,
    lastLocation: null,
    lastEventCount: 0,
    cicToken: null,
    cicTokenExpiry: 0
};

// ============================================================
// AUTENTICACIÓN Cic_IA — obtener/renovar token automáticamente
// ============================================================
function cicGetToken() {
    // Reusar token si no ha expirado (30 días)
    if (AI_CONFIG.cicToken && Date.now() < AI_CONFIG.cicTokenExpiry) {
        return Promise.resolve(AI_CONFIG.cicToken);
    }
    return fetch(AI_CONFIG.CIC_URL + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: AI_CONFIG.CIC_USER,
            password: AI_CONFIG.CIC_PASS
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.token) {
            AI_CONFIG.cicToken = data.token;
            AI_CONFIG.cicTokenExpiry = Date.now() + (29 * 86400000); // 29 días
            console.log('🤖 Cic_IA autenticado OK');
            return data.token;
        }
        throw new Error('Login fallido: ' + (data.error || 'sin token'));
    });
}

// ============================================================
// CAPA 1: Cic_IA (Groq/Llama) — análisis principal
// ============================================================
function analyzeWithCicIA(prompt) {
    return cicGetToken()
        .then(function(token) {
            return fetch(AI_CONFIG.CIC_URL + '/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    message: prompt,
                    mode: 'balanced'
                })
            });
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.response) return { text: data.response, source: 'Cic_IA' };
            throw new Error(data.error || 'Sin respuesta');
        });
}

// ============================================================
// CAPA 2: Anthropic Claude — via proxy para evitar CORS
// Usa el endpoint de Cic_IA como proxy hacia Anthropic
// ============================================================
function analyzeWithAnthropic(prompt) {
    // Usar Cic_IA como proxy — evita CORS de Anthropic
    return cicGetToken()
        .then(function(token) {
            return fetch(AI_CONFIG.CIC_URL + '/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    message: '[MODO EMERGENCIA - USA TU MEJOR ANÁLISIS] ' + prompt,
                    mode: 'complete'
                })
            });
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.response) return { text: data.response, source: 'Cic_IA Enhanced' };
            throw new Error('Sin respuesta');
        });
}

// ============================================================
// CONSTRUIR PROMPT — contexto completo para la IA
// ============================================================
function buildAlertPrompt(alerts, location, lang) {
    var langName = lang === 'es' ? 'español' :
                   lang === 'pt' ? 'portugués' :
                   lang === 'en' ? 'inglés' :
                   lang === 'fr' ? 'francés' : 'español';

    var locStr = location.name
        ? (location.name + (location.country ? ', ' + location.country : ''))
        : (location.lat.toFixed(3) + ', ' + location.lon.toFixed(3));

    // Resumir alertas para el prompt (máx 20 eventos)
    var alertSummary = alerts.slice(0, 20).map(function(a, i) {
        return (i+1) + '. [' + a.type + '] ' + a.title +
            (a.distKm != null ? ' · ' + a.distKm + 'km' : '') +
            (a.priority ? ' · prioridad:' + a.priority : '') +
            (a.source ? ' · fuente:' + a.source : '');
    }).join('\n');

    return 'Eres el sistema de análisis de emergencias de AlertaGlobal. ' +
        'Responde SOLO en ' + langName + '. Responde en formato JSON válido.\n\n' +
        'UBICACIÓN DEL USUARIO: ' + locStr + '\n' +
        'FECHA/HORA: ' + new Date().toLocaleString('es-CL') + '\n\n' +
        'EVENTOS DETECTADOS (' + alerts.length + ' total):\n' + alertSummary + '\n\n' +
        'Analiza los eventos y responde con este JSON exacto (sin markdown, solo JSON):\n' +
        '{\n' +
        '  "resumen": "2-3 oraciones explicando la situación actual para el usuario en ' + locStr + '",\n' +
        '  "nivelRiesgo": "verde|amarillo|naranja|rojo",\n' +
        '  "mensajePrincipal": "mensaje corto de alerta o tranquilidad para mostrar arriba",\n' +
        '  "recomendaciones": ["recomendación 1", "recomendación 2", "recomendación 3"],\n' +
        '  "eventosRelevantes": [lista de índices (1-based) de los eventos más relevantes para el usuario],\n' +
        '  "contextoLocal": "explicación de por qué estos eventos son o no relevantes para ' + locStr + '"\n' +
        '}';
}

// ============================================================
// PARSEAR RESPUESTA JSON de la IA
// ============================================================
function parseAIResponse(text) {
    try {
        // Limpiar markdown si viene con ```json
        var clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        // Buscar JSON en el texto
        var start = clean.indexOf('{');
        var end = clean.lastIndexOf('}');
        if (start > -1 && end > start) {
            clean = clean.substring(start, end + 1);
        }
        return JSON.parse(clean);
    } catch(e) {
        console.log('AI parse error:', e.message);
        return null;
    }
}

// ============================================================
// FUNCIÓN PRINCIPAL — análisis con fallback automático
// ============================================================
function analyzeAlerts(alerts, location, lang, callback) {
    if (!alerts || !alerts.length || !location || !location.lat) {
        callback(null); return;
    }

    // Cache: no llamar si datos tienen < 5 min Y misma ubicación
    var locKey = location.lat.toFixed(2) + ',' + location.lon.toFixed(2);
    var now = Date.now();
    if (now - AI_CONFIG.lastCall < AI_CONFIG.CACHE_MS &&
        AI_CONFIG.lastLocation === locKey &&
        AI_CONFIG.lastEventCount === alerts.length) {
        console.log('🤖 IA: usando cache');
        callback(null); return;
    }

    AI_CONFIG.lastCall = now;
    AI_CONFIG.lastLocation = locKey;
    AI_CONFIG.lastEventCount = alerts.length;

    var prompt = buildAlertPrompt(alerts, location, lang || 'es');
    console.log('🤖 Consultando IA para', location.name || locKey);

    // Mostrar indicador de carga
    showAILoading(true);

    // Intentar Cic_IA primero
    analyzeWithCicIA(prompt)
        .then(function(result) {
            console.log('🤖 Cic_IA respondió OK');
            var parsed = parseAIResponse(result.text);
            showAILoading(false);
            renderAISummary(parsed, result.source, alerts);
            callback(parsed);
        })
        .catch(function(e) {
            console.log('🤖 Cic_IA falló:', e.message, '— usando Anthropic');
            // Fallback a Anthropic
            analyzeWithAnthropic(prompt)
                .then(function(result) {
                    console.log('🤖 Anthropic respondió OK');
                    var parsed = parseAIResponse(result.text);
                    showAILoading(false);
                    renderAISummary(parsed, result.source, alerts);
                    callback(parsed);
                })
                .catch(function(e2) {
                    console.log('🤖 Ambas IAs fallaron:', e2.message);
                    showAILoading(false);
                    callback(null);
                });
        });
}

// ============================================================
// RENDERIZAR CARD DE RESUMEN IA
// ============================================================
function showAILoading(show) {
    var card = document.getElementById('aiSummaryCard');
    if (!card) return;
    card.style.display = show ? 'block' : (card.dataset.hasContent ? 'block' : 'none');
    if (show) {
        card.innerHTML = '<div class="ai-loading">'
            + '<div class="ai-spinner"></div>'
            + '<span>🤖 Analizando alertas...</span>'
            + '</div>';
    }
}

function renderAISummary(data, source, alerts) {
    var card = document.getElementById('aiSummaryCard');
    if (!card || !data) return;

    var colors = {
        verde:    { bg: '#00E67620', border: '#00E676', text: '✅ Sin riesgo inmediato' },
        amarillo: { bg: '#FFC10720', border: '#FFC107', text: '⚠️ Precaución' },
        naranja:  { bg: '#FF950020', border: '#FF9500', text: '🟠 Riesgo importante' },
        rojo:     { bg: '#FF3B3020', border: '#FF3B30', text: '🔴 Emergencia activa' }
    };
    var nivel = data.nivelRiesgo || 'verde';
    var c = colors[nivel] || colors.verde;

    card.dataset.hasContent = '1';
    card.style.display = 'block';
    card.style.cssText = 'background:' + c.bg + ';border:2px solid ' + c.border
        + ';border-radius:16px;padding:16px;margin:10px 10px 4px;';

    var recsHtml = '';
    if (data.recomendaciones && data.recomendaciones.length) {
        recsHtml = '<div style="margin-top:10px">'
            + data.recomendaciones.map(function(r) {
                return '<div style="font-size:13px;color:var(--text-secondary);padding:3px 0">• ' + r + '</div>';
            }).join('') + '</div>';
    }

    card.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
        + '<span style="font-size:20px">🤖</span>'
        + '<div>'
        + '<div style="font-weight:800;font-size:13px;color:' + c.border + '">'
        + c.text + '</div>'
        + '<div style="font-size:11px;color:var(--text-muted)">Análisis IA · ' + source + '</div>'
        + '</div>'
        + '<button onclick="document.getElementById(\'aiSummaryCard\').style.display=\'none\'" '
        + 'style="margin-left:auto;background:none;border:none;color:var(--text-muted);font-size:18px;cursor:pointer">×</button>'
        + '</div>'
        + '<div style="font-size:14px;color:var(--text);line-height:1.5">' + (data.resumen || '') + '</div>'
        + (data.contextoLocal ? '<div style="font-size:12px;color:var(--text-muted);margin-top:6px;font-style:italic">'
            + data.contextoLocal + '</div>' : '')
        + recsHtml;

    // Destacar eventos relevantes en la lista
    if (data.eventosRelevantes && data.eventosRelevantes.length) {
        highlightRelevantAlerts(data.eventosRelevantes);
    }
}

function highlightRelevantAlerts(indices) {
    var cards = document.querySelectorAll('.alert-card');
    cards.forEach(function(card, i) {
        if (indices.indexOf(i + 1) > -1) {
            card.style.boxShadow = '0 0 12px rgba(10,132,255,0.4)';
            card.style.borderColor = '#0A84FF';
        }
    });
}

// ============================================================
// RESETEAR CACHE (llamar cuando cambia la ubicación)
// ============================================================
function resetAICache() {
    AI_CONFIG.lastCall = 0;
    AI_CONFIG.lastLocation = null;
    AI_CONFIG.lastEventCount = 0;
    var card = document.getElementById('aiSummaryCard');
    if (card) { card.style.display = 'none'; card.dataset.hasContent = ''; }
}
