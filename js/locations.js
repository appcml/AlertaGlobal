// ============================================
// js/locations.js — Gestión de ubicaciones v2
// reverseGeocode: Nominatim → BigDataCloud → coords
// search: Nominatim → Photon (fallback)
// ============================================
var LocationManager = {

    getAll: function() {
        try { return JSON.parse(localStorage.getItem('ag_locations')) || []; }
        catch(e) { return []; }
    },

    save: function(loc) {
        var locs = this.getAll();
        for (var i = 0; i < locs.length; i++) {
            if (locs[i].name === loc.name) return false;
        }
        locs.push({ name: loc.name, lat: loc.lat, lon: loc.lon, country: loc.country || '' });
        try { localStorage.setItem('ag_locations', JSON.stringify(locs)); } catch(e) {}
        return true;
    },

    remove: function(name) {
        var locs = this.getAll().filter(function(l) { return l.name !== name; });
        try { localStorage.setItem('ag_locations', JSON.stringify(locs)); } catch(e) {}
    },

    setCurrent: function(loc) {
        try { localStorage.setItem('ag_current', JSON.stringify(loc)); } catch(e) {}
    },

    getCurrent: function() {
        try { return JSON.parse(localStorage.getItem('ag_current')); }
        catch(e) { return null; }
    },

    // ── BÚSQUEDA: Nominatim primero, Photon como fallback ──
    search: function(query) {
        var lang = (typeof currentLang !== 'undefined') ? currentLang : 'es';
        var url = 'https://nominatim.openstreetmap.org/search?format=json&q='
            + encodeURIComponent(query) + '&limit=6&addressdetails=1&accept-language=' + lang;

        return fetch(url, { headers: { 'User-Agent': 'AlertaGlobal/1.0' } })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (data && data.length) {
                    return data.map(function(r) {
                        return {
                            name: r.display_name.split(',').slice(0, 2).join(',').trim(),
                            fullName: r.display_name,
                            lat: parseFloat(r.lat),
                            lon: parseFloat(r.lon),
                            country: (r.address && r.address.country) || ''
                        };
                    });
                }
                // Nominatim no dio resultados → Photon
                return LocationManager._searchPhoton(query);
            })
            .catch(function() {
                // Nominatim falló → Photon
                return LocationManager._searchPhoton(query);
            });
    },

    _searchPhoton: function(query) {
        var url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(query) + '&limit=6&lang=es';
        return fetch(url)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (!data || !data.features) return [];
                return data.features.map(function(f) {
                    var p = f.properties || {};
                    var name = p.name || p.city || p.county || '';
                    var country = p.country || '';
                    var state = p.state || '';
                    var fullName = [name, state, country].filter(Boolean).join(', ');
                    return {
                        name: name,
                        fullName: fullName,
                        lat: f.geometry.coordinates[1],
                        lon: f.geometry.coordinates[0],
                        country: country
                    };
                }).filter(function(r) { return r.name; });
            })
            .catch(function() { return []; });
    },

    // ── REVERSE GEOCODE: Nominatim → BigDataCloud → coords ──
    reverseGeocode: function(lat, lon) {
        var lang = (typeof currentLang !== 'undefined') ? currentLang : 'es';

        // Intentar con Nominatim (timeout 5s)
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = controller ? setTimeout(function() { controller.abort(); }, 5000) : null;
        var opts = { headers: { 'User-Agent': 'AlertaGlobal/1.0' } };
        if (controller) opts.signal = controller.signal;

        var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat='
            + lat + '&lon=' + lon + '&accept-language=' + lang;

        return fetch(url, opts)
            .then(function(r) {
                if (timer) clearTimeout(timer);
                return r.json();
            })
            .then(function(data) {
                var a = data.address || {};
                var city = a.city || a.town || a.village || a.municipality
                         || a.suburb || a.county || '';
                if (!city) throw new Error('sin ciudad');
                return { city: city, state: a.state || '', country: a.country || '' };
            })
            .catch(function() {
                // Nominatim falló → BigDataCloud (sin clave, CORS libre)
                return LocationManager._reverseByBigDataCloud(lat, lon);
            });
    },

    _reverseByBigDataCloud: function(lat, lon) {
        var lang = (typeof currentLang !== 'undefined') ? currentLang : 'es';
        var url = 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude='
            + lat + '&longitude=' + lon + '&localityLanguage=' + lang;

        return fetch(url)
            .then(function(r) { return r.json(); })
            .then(function(d) {
                var city = d.city || d.locality || d.principalSubdivision || '';
                var country = d.countryName || '';
                var state = d.principalSubdivision || '';
                if (city) return { city: city, state: state, country: country };
                throw new Error('sin ciudad');
            })
            .catch(function() {
                // Último recurso: devolver coordenadas legibles
                return {
                    city: lat.toFixed(3) + ', ' + lon.toFixed(3),
                    state: '',
                    country: ''
                };
            });
    }
};
