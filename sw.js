// ============================================
// sw.js — Service Worker AlertaGlobal v2.0
// Notificaciones push en background
// Basado en deviceLocation del usuario (GPS real)
// ============================================

var CACHE_NAME = 'alertaglobal-v2';
var SW_VERSION = '2.0.0';

// ── Archivos a cachear para modo offline ──
var CACHE_FILES = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/sources.js',
    '/js/alert-engine.js',
    '/js/locations.js',
    '/js/i18n.js',
    '/js/sos.js',
    '/js/map-layers.js',
    '/manifest.json'
];

// ── Configuración de notificaciones por nivel ──
var NOTIFICATION_CONFIG = {
    CRITICO: {
        requireInteraction: true,
        vibrate: [500, 200, 500, 200, 500],
        sound: 'critical',
        badge: '/img/icon.svg',
        tag: 'alert-critical'
    },
    ALERTA: {
        requireInteraction: false,
        vibrate: [300, 100, 300],
        sound: 'alert',
        badge: '/img/icon.svg',
        tag: 'alert-high'
    },
    ADVERTENCIA: {
        requireInteraction: false,
        vibrate: [200],
        sound: 'warning',
        badge: '/img/icon.svg',
        tag: 'alert-medium'
    },
    INFORMATIVO: {
        requireInteraction: false,
        vibrate: [100],
        sound: null,
        badge: '/img/icon.svg',
        tag: 'alert-info'
    }
};

// ── Reglas de cuándo notificar por tipo de evento ──
// Solo se envía notificación si se cumplen las condiciones
var NOTIFY_RULES = {
    'TSUNAMI':            { minPriority: 85,  always: true,  timeFilter: null },
    'SISMO':              { minPriority: 76,  always: false, timeFilter: null },   // M5+
    'TORMENTA ELÉCTRICA': { minPriority: 68,  always: false, timeFilter: null },
    'MAREJADA PELIGROSA': { minPriority: 70,  always: false, timeFilter: null },
    'MAREJADA':           { minPriority: 72,  always: false, timeFilter: null },
    'VIENTO':             { minPriority: 70,  always: false, timeFilter: null },   // >80 km/h
    'LLUVIA INTENSA HOY': { minPriority: 72,  always: false, timeFilter: null },
    'UV EXTREMO':         { minPriority: 70,  always: false, timeFilter: 'morning' }, // Solo mañana
    'UV ALTO':            { minPriority: 52,  always: false, timeFilter: 'morning' },
    'INCENDIO':           { minPriority: 70,  always: false, timeFilter: null },
    'ERUPCIÓN':           { minPriority: 85,  always: true,  timeFilter: null },
    'VOLCÁN':             { minPriority: 80,  always: false, timeFilter: null },
    'ALERTA LLUVIA 24H':  { minPriority: 60,  always: false, timeFilter: null },
    'HURACÁN':            { minPriority: 85,  always: true,  timeFilter: null },
    'TORMENTA POSIBLE':   { minPriority: 55,  always: false, timeFilter: null },
    'DEFAULT':            { minPriority: 75,  always: false, timeFilter: null }
};

// ── Install: cachear archivos offline ──
self.addEventListener('install', function(e) {
    console.log('[SW] Instalando AlertaGlobal SW v' + SW_VERSION);
    e.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(CACHE_FILES).catch(function(err) {
                console.log('[SW] Cache parcial:', err);
            });
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

// ── Activate: limpiar caches viejos ──
self.addEventListener('activate', function(e) {
    console.log('[SW] Activando AlertaGlobal SW v' + SW_VERSION);
    e.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(k) { return k !== CACHE_NAME; })
                    .map(function(k) { return caches.delete(k); })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// ── Fetch: servir desde cache si disponible ──
self.addEventListener('fetch', function(e) {
    // Solo cachear requests GET a nuestro dominio
    if (e.request.method !== 'GET') return;
    var url = new URL(e.request.url);
    if (!url.hostname.includes('github.io') && !url.hostname.includes('localhost')) return;

    e.respondWith(
        caches.match(e.request).then(function(cached) {
            if (cached) return cached;
            return fetch(e.request).then(function(response) {
                if (!response || response.status !== 200) return response;
                var clone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(e.request, clone);
                });
                return response;
            }).catch(function() {
                // Sin internet → servir index.html cacheado
                return caches.match('/index.html');
            });
        })
    );
});

// ── Background Sync: verificar alertas periódicamente ──
self.addEventListener('periodicsync', function(e) {
    if (e.tag === 'check-alerts') {
        e.waitUntil(checkAlertsInBackground());
    }
});

// ── Mensaje desde la app: guardar ubicación y configuración ──
self.addEventListener('message', function(e) {
    if (!e.data) return;

    if (e.data.type === 'SET_LOCATION') {
        // La app nos pasa la ubicación GPS real del usuario
        self._deviceLat = e.data.lat;
        self._deviceLon = e.data.lon;
        self._deviceName = e.data.name || 'Tu zona';
        self._userLang = e.data.lang || 'es';
        console.log('[SW] Ubicación guardada:', self._deviceName, self._deviceLat, self._deviceLon);
    }

    if (e.data.type === 'CHECK_NOW') {
        // La app pide verificación inmediata
        checkAlertsInBackground();
    }

    if (e.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ── Push: recibir notificación del servidor (si se implementa) ──
self.addEventListener('push', function(e) {
    if (!e.data) return;
    try {
        var data = e.data.json();
        e.waitUntil(showNotification(data));
    } catch(err) {
        console.log('[SW] Push error:', err);
    }
});

// ── Click en notificación: abrir la app ──
self.addEventListener('notificationclick', function(e) {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(cls) {
            // Si la app ya está abierta, enfocarla
            for (var i = 0; i < cls.length; i++) {
                if (cls[i].url.includes('AlertaGlobal') || cls[i].url.includes('localhost')) {
                    return cls[i].focus();
                }
            }
            // Si no está abierta, abrirla
            return clients.openWindow('/AlertaGlobal/');
        })
    );
});

// ── Función principal: verificar alertas en background ──
async function checkAlertsInBackground() {
    var lat = self._deviceLat;
    var lon = self._deviceLon;
    var name = self._deviceName || 'Tu zona';

    if (!lat || !lon) {
        console.log('[SW] Sin ubicación guardada, omitiendo check');
        return;
    }

    console.log('[SW] Verificando alertas para:', name, lat, lon);

    try {
        // Consultar Open-Meteo para condiciones actuales
        var url = 'https://api.open-meteo.com/v1/forecast?' +
            'latitude='+lat+'&longitude='+lon +
            '&current=temperature_2m,relative_humidity_2m,precipitation,' +
            'rain,wind_speed_10m,wind_gusts_10m,weather_code,surface_pressure,' +
            'visibility,uv_index,is_day' +
            '&hourly=precipitation_probability,cape' +
            '&daily=precipitation_sum,wind_speed_10m_max' +
            '&forecast_days=1&timezone=auto&wind_speed_unit=kmh';

        var resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!resp.ok) throw new Error('Open-Meteo error: ' + resp.status);
        var data = await resp.json();
        var c = data.current || {};

        var alertsToNotify = [];

        // ── Evaluar condiciones ──

        // 1. VIENTO (Beaufort)
        var ws = c.wind_speed_10m || 0;
        var wg = c.wind_gusts_10m || 0;
        if (wg >= 89 || ws >= 75) {
            alertsToNotify.push({
                type: 'VIENTO', priority: 85,
                title: '🔴 Viento huracanado en ' + name,
                body: 'Ráfagas de ' + Math.round(wg) + ' km/h. PELIGRO EXTREMO. No salga.',
                level: 'CRITICO'
            });
        } else if (wg >= 62 || ws >= 50) {
            alertsToNotify.push({
                type: 'VIENTO', priority: 72,
                title: '🟠 Viento muy fuerte en ' + name,
                body: 'Ráfagas de ' + Math.round(wg) + ' km/h. Peligro para peatones.',
                level: 'ALERTA'
            });
        } else if (wg >= 50 || ws >= 39) {
            alertsToNotify.push({
                type: 'VIENTO', priority: 58,
                title: '🟡 Viento fuerte en ' + name,
                body: 'Viento de ' + Math.round(ws) + ' km/h. Tome precauciones.',
                level: 'ADVERTENCIA'
            });
        } else if (ws >= 20) {
            alertsToNotify.push({
                type: 'VIENTO', priority: 35,
                title: '🟢 Viento moderado en ' + name,
                body: 'Viento de ' + Math.round(ws) + ' km/h hoy.',
                level: 'INFORMATIVO'
            });
        }

        // 2. LLUVIA
        var rain = c.rain || c.precipitation || 0;
        var dailyRain = (data.daily && data.daily.precipitation_sum && data.daily.precipitation_sum[0]) || 0;
        if (dailyRain >= 80) {
            alertsToNotify.push({
                type: 'LLUVIA', priority: 82,
                title: '🟠 Lluvia torrencial en ' + name,
                body: 'Se esperan ' + Math.round(dailyRain) + 'mm hoy. Riesgo de inundaciones.',
                level: 'ALERTA'
            });
        } else if (dailyRain >= 40) {
            alertsToNotify.push({
                type: 'LLUVIA', priority: 62,
                title: '🟡 Lluvia intensa en ' + name,
                body: 'Se esperan ' + Math.round(dailyRain) + 'mm hoy. Conduzca con precaución.',
                level: 'ADVERTENCIA'
            });
        }

        // 3. UV
        var uvi = c.uv_index || 0;
        var hour = new Date().getHours();
        if (uvi >= 11 && c.is_day && hour >= 8 && hour <= 13) {
            alertsToNotify.push({
                type: 'UV EXTREMO', priority: 70,
                title: '🟠 UV extremo en ' + name,
                body: 'Índice UV ' + Math.round(uvi) + '. Evite exposición 10-16h. Protector 50+.',
                level: 'ALERTA'
            });
        } else if (uvi >= 8 && c.is_day && hour >= 8 && hour <= 12) {
            alertsToNotify.push({
                type: 'UV ALTO', priority: 52,
                title: '🟡 UV muy alto en ' + name,
                body: 'Índice UV ' + Math.round(uvi) + '. Use protector solar.',
                level: 'ADVERTENCIA'
            });
        }

        // 4. CAPE (tormentas eléctricas)
        if (data.hourly && data.hourly.cape) {
            var maxCape = Math.max.apply(null, data.hourly.cape.slice(0, 6));
            if (maxCape >= 2000) {
                alertsToNotify.push({
                    type: 'TORMENTA ELÉCTRICA', priority: 78,
                    title: '🟠 Tormenta eléctrica en ' + name,
                    body: 'Condiciones para tormenta severa. Busque refugio.',
                    level: 'ALERTA'
                });
            }
        }

        // 5. Presión (sistemas de tormenta)
        var pressure = c.surface_pressure || 1013;
        if (pressure < 960) {
            alertsToNotify.push({
                type: 'DEPRESIÓN PROFUNDA', priority: 80,
                title: '🟠 Sistema de tormenta en ' + name,
                body: 'Presión extremadamente baja ' + Math.round(pressure) + ' hPa. Tormenta severa.',
                level: 'ALERTA'
            });
        }

        // ── Consultar USGS para sismos cercanos ──
        try {
            var since = new Date(Date.now() - 3600000).toISOString(); // Última hora
            var eqUrl = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                '&orderby=time&limit=20&minmagnitude=3.5&starttime=' + since;
            var eqResp = await fetch(eqUrl, { signal: AbortSignal.timeout(10000) });
            if (eqResp.ok) {
                var eqData = await eqResp.json();
                (eqData.features || []).forEach(function(f) {
                    var p = f.properties;
                    var coords = f.geometry.coordinates;
                    var dist = Math.round(
                        6371 * Math.acos(
                            Math.sin(lat * Math.PI/180) * Math.sin(coords[1] * Math.PI/180) +
                            Math.cos(lat * Math.PI/180) * Math.cos(coords[1] * Math.PI/180) *
                            Math.cos((coords[0] - lon) * Math.PI/180)
                        )
                    );
                    if (dist <= 500 && p.mag >= 3.5) {
                        var level, priority;
                        if (p.mag >= 7.0)      { level = 'CRITICO';     priority = 96; }
                        else if (p.mag >= 5.5) { level = 'ALERTA';      priority = 84; }
                        else if (p.mag >= 4.5) { level = 'ADVERTENCIA'; priority = 70; }
                        else                   { level = 'ADVERTENCIA'; priority = 55; }
                        alertsToNotify.push({
                            type: 'SISMO', priority: priority,
                            title: (level === 'CRITICO' ? '🔴' : level === 'ALERTA' ? '🟠' : '🟡') +
                                   ' Sismo M' + p.mag.toFixed(1) + ' a ' + dist + 'km de ' + name,
                            body: p.place + '. Prof: ' + Math.round(coords[2]) + 'km.',
                            level: level
                        });
                    }
                });
            }
        } catch(eqErr) {}

        // ── Filtrar: solo notificar lo que supera el umbral ──
        // Evitar spam: guardar últimas notificaciones enviadas
        var lastNotified = {};
        try {
            var stored = await self.registration.sync; // dummy para compatibilidad
        } catch(e) {}

        var toSend = alertsToNotify.filter(function(a) {
            var rule = NOTIFY_RULES[a.type] || NOTIFY_RULES['DEFAULT'];
            if (a.priority < rule.minPriority) return false;
            if (rule.timeFilter === 'morning') {
                var h = new Date().getHours();
                if (h < 7 || h > 12) return false;
            }
            return true;
        });

        // Ordenar por prioridad y notificar máximo 2 a la vez
        toSend.sort(function(a, b) { return b.priority - a.priority; });
        toSend = toSend.slice(0, 2);

        for (var i = 0; i < toSend.length; i++) {
            await showNotification(toSend[i]);
        }

        // Notificar a los clientes abiertos cuántas alertas hay
        var clientList = await clients.matchAll({ type: 'window' });
        clientList.forEach(function(client) {
            client.postMessage({
                type: 'ALERTS_UPDATED',
                count: alertsToNotify.length,
                critical: alertsToNotify.filter(function(a){ return a.priority >= 85; }).length
            });
        });

    } catch(err) {
        console.log('[SW] Error verificando alertas:', err);
    }
}

// ── Mostrar notificación según nivel ──
async function showNotification(alert) {
    if (!self.registration) return;

    var config = NOTIFICATION_CONFIG[alert.level] || NOTIFICATION_CONFIG['ADVERTENCIA'];
    var icons = {
        'CRITICO': '/img/icon-critical.png',
        'ALERTA': '/img/icon-alert.png',
        'ADVERTENCIA': '/img/icon-warning.png',
        'INFORMATIVO': '/img/icon.svg'
    };

    var options = {
        body:               alert.body || '',
        icon:               icons[alert.level] || '/img/icon.svg',
        badge:              '/img/icon.svg',
        vibrate:            config.vibrate,
        requireInteraction: config.requireInteraction,
        tag:                config.tag + '-' + alert.type,
        renotify:           true,
        data: {
            type:     alert.type,
            priority: alert.priority,
            level:    alert.level,
            url:      '/AlertaGlobal/'
        },
        actions: [
            { action: 'open',    title: '📱 Ver alertas' },
            { action: 'dismiss', title: '✕ Ignorar' }
        ]
    };

    try {
        await self.registration.showNotification(alert.title, options);
        console.log('[SW] Notificación enviada:', alert.level, alert.title);
    } catch(err) {
        console.log('[SW] Error mostrando notificación:', err);
    }
}
