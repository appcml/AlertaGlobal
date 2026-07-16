// ============================================
// GESTIÓN DE UBICACIONES
// ============================================
const LocationManager = {
    KEY: 'ag_locations',
    CURRENT_KEY: 'ag_current',

    // Get saved locations
    getAll() {
        try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
        catch { return []; }
    },

    // Save a location
    save(loc) {
        const locs = this.getAll();
        // Don't duplicate
        if (locs.find(l => l.name === loc.name)) return false;
        locs.push({ name: loc.name, lat: loc.lat, lon: loc.lon, country: loc.country || '', savedAt: Date.now() });
        localStorage.setItem(this.KEY, JSON.stringify(locs));
        return true;
    },

    // Remove a saved location
    remove(name) {
        const locs = this.getAll().filter(l => l.name !== name);
        localStorage.setItem(this.KEY, JSON.stringify(locs));
    },

    // Set current active location
    setCurrent(loc) {
        localStorage.setItem(this.CURRENT_KEY, JSON.stringify({ name: loc.name, lat: loc.lat, lon: loc.lon, country: loc.country || '' }));
    },

    // Get current location
    getCurrent() {
        try { return JSON.parse(localStorage.getItem(this.CURRENT_KEY)); }
        catch { return null; }
    },

    // Search cities using Nominatim (OpenStreetMap) - free, no API key
    async search(query) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&accept-language=${currentLang}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'AlertaGlobal/1.0' } });
        const data = await res.json();
        return data.map(r => ({
            name: r.display_name.split(',').slice(0, 2).join(',').trim(),
            fullName: r.display_name,
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon),
            country: (r.address && r.address.country) || ''
        }));
    },

    // Reverse geocode (lat/lon → city name)
    async reverseGeocode(lat, lon) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=${currentLang}`;
            const res = await fetch(url, { headers: { 'User-Agent': 'AlertaGlobal/1.0' } });
            const data = await res.json();
            const addr = data.address || {};
            const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
            const state = addr.state || '';
            const country = addr.country || '';
            return { city, state, country, fullName: `${city}, ${state}, ${country}`.replace(/, ,/g, ',').replace(/^,|,$/g, '') };
        } catch {
            return { city: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, state: '', country: '', fullName: '' };
        }
    }
};
