// ============================================
// js/locations.js — Gestión de ubicaciones
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
    search: function(query) {
        var url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&limit=5&addressdetails=1&accept-language=' + currentLang;
        return fetch(url, { headers: { 'User-Agent': 'AlertaGlobal/1.0' } })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                return data.map(function(r) {
                    return {
                        name: r.display_name.split(',').slice(0, 2).join(',').trim(),
                        fullName: r.display_name,
                        lat: parseFloat(r.lat),
                        lon: parseFloat(r.lon),
                        country: (r.address && r.address.country) || ''
                    };
                });
            });
    },
    reverseGeocode: function(lat, lon) {
        var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon + '&accept-language=' + currentLang;
        return fetch(url, { headers: { 'User-Agent': 'AlertaGlobal/1.0' } })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                var a = data.address || {};
                var city = a.city || a.town || a.village || a.municipality || a.county || '';
                var state = a.state || '';
                var country = a.country || '';
                return { city: city, state: state, country: country };
            })
            .catch(function() {
                return { city: lat.toFixed(2) + ', ' + lon.toFixed(2), state: '', country: '' };
            });
    }
};v
