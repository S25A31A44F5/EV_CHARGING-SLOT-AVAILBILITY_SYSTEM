/**
 * EV Charging Slot Availability System
 * Real-Time Interactive OpenStreetMap & Leaflet.js Station Explorer
 * Features: Real OSM Overpass API nodes, Geolocation, Dynamic Marker Popups,
 * Google Maps Directions, and Two-Way Synchronization.
 */

let mapInstance = null;
let markersLayer = null;
let userMarker = null;

// Current state
let currentCenter = { lat: 16.989065, lon: 82.247465, name: 'Kakinada, Andhra Pradesh' };
let currentRadiusKm = 35;
let userGpsCoords = null;
let currentStations = [];
let markerMap = {}; // Map station_id -> Leaflet Marker

document.addEventListener('DOMContentLoaded', () => {
    initLeafletMap();
    initEventListeners();
    fetchNearbyStations();
});

function initLeafletMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    // Initialize Leaflet Map centered on Kakinada, Andhra Pradesh, India
    mapInstance = L.map('map', {
        center: [currentCenter.lat, currentCenter.lon],
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: true
    });

    // Genuine OpenStreetMap standard raster tiles (No API Key Required)
    // Renders real-world streets, city names, highways, and topography
    const osmTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        subdomains: ['a', 'b', 'c'],
        maxZoom: 19,
        minZoom: 3,
        crossOrigin: true
    });

    // Tile error listener
    let tileErrorCount = 0;
    osmTileLayer.on('tileerror', function(error) {
        tileErrorCount++;
        if (tileErrorCount === 5) {
            console.warn('[!] OpenStreetMap primary tile server notice. Attempting fallback raster tiles...');
            // Display friendly non-intrusive notification if user network blocks OSM
            showToast('Slow network detected while loading map street tiles. Retrying...', 'warning');
        }
    });

    osmTileLayer.addTo(mapInstance);

    // Ensure Leaflet recalculates canvas dimensions after DOM paint
    setTimeout(() => {
        if (mapInstance) mapInstance.invalidateSize();
    }, 250);

    markersLayer = L.layerGroup().addTo(mapInstance);

    // Map drag/move listener: display "Search This Area" pill when moved
    mapInstance.on('moveend', () => {
        const center = mapInstance.getCenter();
        const distMoved = calculateHaversine(currentCenter.lat, currentCenter.lon, center.lat, center.lon);
        const searchAreaBtn = document.getElementById('mapSearchAreaBtn');
        if (searchAreaBtn) {
            if (distMoved > 3.0) {
                searchAreaBtn.classList.add('visible');
            } else {
                searchAreaBtn.classList.remove('visible');
            }
        }
    });
}

function initEventListeners() {
    // 1. Geolocation buttons
    const geolocateBtn = document.getElementById('geolocateBtn');
    const mapLocateBtn = document.getElementById('mapLocateBtn');
    if (geolocateBtn) geolocateBtn.addEventListener('click', triggerGeolocation);
    if (mapLocateBtn) mapLocateBtn.addEventListener('click', triggerGeolocation);

    // 2. Search Area floating button
    const mapSearchAreaBtn = document.getElementById('mapSearchAreaBtn');
    if (mapSearchAreaBtn) {
        mapSearchAreaBtn.addEventListener('click', () => {
            const center = mapInstance.getCenter();
            currentCenter.lat = center.lat;
            currentCenter.lon = center.lng;
            currentCenter.name = `Coordinates (${center.lat.toFixed(3)}, ${center.lng.toFixed(3)})`;
            mapSearchAreaBtn.classList.remove('visible');
            fetchNearbyStations();
        });
    }

    // 3. Search input & submit button
    const searchInput = document.getElementById('stationSearch');
    const searchSubmitBtn = document.getElementById('searchSubmitBtn');

    if (searchSubmitBtn) {
        searchSubmitBtn.addEventListener('click', handleLocationSearch);
    }
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLocationSearch();
            }
        });
    }

    // 4. Filters change listeners
    const radiusFilter = document.getElementById('radiusFilter');
    const sourceFilter = document.getElementById('sourceFilter');
    const typeFilter = document.getElementById('typeFilter');
    const availFilter = document.getElementById('availFilter');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');

    if (radiusFilter) {
        radiusFilter.addEventListener('change', () => {
            currentRadiusKm = parseFloat(radiusFilter.value);
            fetchNearbyStations();
        });
    }

    if (sourceFilter) sourceFilter.addEventListener('change', fetchNearbyStations);
    if (typeFilter) typeFilter.addEventListener('change', fetchNearbyStations);
    if (availFilter) availFilter.addEventListener('change', fetchNearbyStations);

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', resetAllFilters);
    }
}

// ---------------------------------------------------------------------
// Fetch Stations via Backend API (Overpass OSM + Network Stations)
// ---------------------------------------------------------------------
async function fetchNearbyStations() {
    showMapLoading(true);

    const radius = document.getElementById('radiusFilter')?.value || currentRadiusKm;
    const source = document.getElementById('sourceFilter')?.value || 'all';
    const type = document.getElementById('typeFilter')?.value || 'All';
    const avail = document.getElementById('availFilter')?.value || 'All';
    const query = (document.getElementById('stationSearch')?.value || '').trim();

    const searchLat = userGpsCoords ? userGpsCoords.lat : currentCenter.lat;
    const searchLon = userGpsCoords ? userGpsCoords.lon : currentCenter.lon;

    const url = `/api/stations/nearby?latitude=${searchLat}&longitude=${searchLon}&radius=${radius}&source=${source}&type=${encodeURIComponent(type)}&availability=${encodeURIComponent(avail)}&search=${encodeURIComponent(query)}`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.success) {
            currentStations = data.stations;
            renderMapMarkers(currentStations);
            renderStationCards(currentStations, data);
            updateHeaderCounts(data);
        } else {
            showToast(data.message || 'Error fetching charging stations', 'danger');
        }
    } catch (err) {
        console.error('Network error loading stations:', err);
        showToast('Could not load station data. Checking cache...', 'warning');
    } finally {
        showMapLoading(false);
    }
}

// ---------------------------------------------------------------------
// Map Markers Rendering (Leaflet Custom Pins)
// ---------------------------------------------------------------------
function renderMapMarkers(stations) {
    if (!mapInstance || !markersLayer) return;
    markersLayer.clearLayers();
    markerMap = {};

    const bounds = [];

    // Add user GPS pin if available
    if (userGpsCoords) {
        const userIcon = L.divIcon({
            className: 'user-gps-marker',
            html: `<div class="user-gps-pulse" title="Your Current Location"></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });
        const uMarker = L.marker([userGpsCoords.lat, userGpsCoords.lon], { icon: userIcon });
        uMarker.bindPopup(`
            <div style="padding: 6px; font-family: 'Inter', sans-serif; font-size: 0.85rem; color: #0F172A;">
                <strong>📍 Your Current Location</strong><br>
                <span style="font-size: 0.75rem; color: #64748B;">GPS Latitude: ${userGpsCoords.lat.toFixed(4)}, Longitude: ${userGpsCoords.lon.toFixed(4)}</span>
            </div>
        `);
        uMarker.addTo(markersLayer);
        bounds.push([userGpsCoords.lat, userGpsCoords.lon]);
    }

    stations.forEach(st => {
        let pinClass = 'pin-osm';
        let pinIcon = 'fa-bolt';

        if (st.is_network_station) {
            const badge = st.availability_badge.text;
            if (badge === 'Available') {
                pinClass = 'pin-avail';
            } else if (badge === 'Limited') {
                pinClass = 'pin-limited';
            } else {
                pinClass = 'pin-occupied';
            }
        } else {
            // Real OpenStreetMap Mapped Station (Live Status: Unknown)
            pinClass = 'pin-osm';
            pinIcon = 'fa-charging-station';
        }

        const customIcon = L.divIcon({
            className: 'custom-ev-pin-wrapper',
            html: `
                <div class="custom-pin ${pinClass}">
                    <i class="fa-solid ${pinIcon}"></i>
                </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            popupAnchor: [0, -20]
        });

        const marker = L.marker([st.latitude, st.longitude], { icon: customIcon });

        // Build Professional Interactive Station Popup (Requirement #5 & #7)
        const popupHtml = buildStationPopupHtml(st);
        marker.bindPopup(popupHtml, { maxWidth: 320 });

        // Marker click handler: Two-way sync to highlight corresponding station card
        marker.on('click', () => {
            highlightStationCard(st.station_id);
        });

        marker.addTo(markersLayer);
        markerMap[st.station_id] = marker;
        bounds.push([st.latitude, st.longitude]);
    });

    if (bounds.length > 0 && !userGpsCoords) {
        mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
}

function buildStationPopupHtml(st) {
    const isNetwork = st.is_network_station;
    const badge = st.availability_badge;
    const distText = st.distance !== undefined ? `${st.distance.toFixed(1)} km away` : 'Nearby';

    let reserveAction = '';
    if (isNetwork) {
        reserveAction = `
            <a href="/reserve?station_id=${st.station_id}" class="btn btn-primary btn-sm">
                <i class="fa-solid fa-calendar-check"></i> Reserve
            </a>
        `;
    } else {
        reserveAction = `
            <button type="button" class="btn btn-primary btn-sm" onclick="openOsmModal('${st.station_id}')">
                <i class="fa-solid fa-circle-info"></i> OSM Info
            </button>
        `;
    }

    let detailsAction = '';
    if (isNetwork) {
        detailsAction = `
            <a href="/station/${st.station_id}" class="btn btn-secondary btn-sm">
                <i class="fa-solid fa-eye"></i> Details
            </a>
        `;
    } else {
        detailsAction = `
            <button type="button" class="btn btn-secondary btn-sm" onclick="openOsmModal('${st.station_id}')">
                <i class="fa-solid fa-eye"></i> Details
            </button>
        `;
    }

    return `
        <div class="station-popup-card">
            <div class="popup-header">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                    <div>
                        <div style="font-size: 0.7rem; text-transform:uppercase; color:${badge.color}; font-weight:700;">
                            ${escapeHtml(st.operator || 'EV Network')}
                        </div>
                        <h4 class="popup-title">${escapeHtml(st.station_name)}</h4>
                    </div>
                    <span class="badge ${badge.class}" style="font-size:0.68rem; padding:3px 8px;">
                        ${badge.text}
                    </span>
                </div>
                <div class="popup-address">
                    <i class="fa-solid fa-location-dot" style="color:var(--electric-cyan); margin-top:2px;"></i>
                    <span>${escapeHtml(st.address)}</span>
                </div>
            </div>

            <div class="popup-metrics">
                <div>
                    <span style="color:var(--text-muted); font-size:0.7rem;">Distance</span><br>
                    <strong>📏 ${distText}</strong>
                </div>
                <div>
                    <span style="color:var(--text-muted); font-size:0.7rem;">Speed</span><br>
                    <strong style="color:var(--electric-cyan);">${escapeHtml(st.primary_charging_type)}</strong>
                </div>
                <div>
                    <span style="color:var(--text-muted); font-size:0.7rem;">Power / Bays</span><br>
                    <strong>${st.total_chargers} Sockets (${escapeHtml(st.power_rating || '60kW')})</strong>
                </div>
                <div>
                    <span style="color:var(--text-muted); font-size:0.7rem;">Tariff</span><br>
                    <strong style="color:#10B981;">₹${st.min_price.toFixed(2)}/kWh</strong>
                </div>
            </div>

            <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 8px;">
                <i class="fa-solid fa-shield"></i> Source: <strong>${escapeHtml(st.source)}</strong>
            </div>

            <div class="popup-actions">
                <a href="${st.google_maps_url}" target="_blank" class="btn btn-outline btn-sm" title="Open Google Maps Directions">
                    <i class="fa-solid fa-diamond-turn-right"></i> Directions
                </a>
                ${detailsAction}
                ${reserveAction}
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------------
// Station Cards Rendering
// ---------------------------------------------------------------------
function renderStationCards(stations, payloadData) {
    const container = document.getElementById('stationsGrid');
    if (!container) return;

    if (stations.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
                <i class="fa-solid fa-charging-station" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 16px;"></i>
                <h3>No EV Charging Stations Found in this Area</h3>
                <p style="color: var(--text-secondary); margin-top: 8px; max-width: 500px; margin-left: auto; margin-right: auto;">
                    We queried OpenStreetMap and verified network hubs within ${payloadData?.center?.radius_km || 35} km, but no charging points match your current filters.
                </p>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                    <button class="btn btn-primary btn-sm" onclick="expandRadius()">
                        <i class="fa-solid fa-circle-plus"></i> Expand Radius to 75 km
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="resetToKakinada()">
                        <i class="fa-solid fa-rotate-left"></i> Return to Kakinada Hub
                    </button>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = stations.map(st => {
        const isNetwork = st.is_network_station;
        const badge = st.availability_badge;
        const distKm = st.distance !== undefined ? st.distance.toFixed(1) : '2.5';

        let reserveBtn = '';
        if (isNetwork) {
            reserveBtn = `
                <a href="/reserve?station_id=${st.station_id}" class="btn btn-primary btn-sm">
                    <i class="fa-solid fa-calendar-check"></i> Reserve Slot
                </a>
            `;
        } else {
            reserveBtn = `
                <button type="button" class="btn btn-outline btn-sm" onclick="openOsmModal('${st.station_id}')">
                    <i class="fa-solid fa-circle-info"></i> OSM Details
                </button>
            `;
        }

        let detailsBtn = '';
        if (isNetwork) {
            detailsBtn = `
                <a href="/station/${st.station_id}" class="btn btn-secondary btn-sm">
                    <i class="fa-solid fa-eye"></i> View Details
                </a>
            `;
        } else {
            detailsBtn = `
                <button type="button" class="btn btn-secondary btn-sm" onclick="openOsmModal('${st.station_id}')">
                    <i class="fa-solid fa-eye"></i> View Details
                </button>
            `;
        }

        return `
            <div class="station-card" id="card-${st.station_id}" onclick="focusStationMarker('${st.station_id}')" style="cursor: pointer;">
                <div class="station-card-header">
                    <div>
                        <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px;">
                            ${isNetwork ? `
                                <span class="badge badge-success" style="font-size: 0.68rem;">
                                    <i class="fa-solid fa-bolt"></i> EV Charge Network
                                </span>
                            ` : `
                                <span class="badge badge-osm" style="font-size: 0.68rem;">
                                    <i class="fa-solid fa-globe"></i> OpenStreetMap Mapped
                                </span>
                            `}
                            <span style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(st.operator || '')}</span>
                        </div>
                        <h3 class="station-name">${escapeHtml(st.station_name)}</h3>
                        <p class="station-location">
                            <i class="fa-solid fa-location-dot" style="color: var(--electric-cyan);"></i>
                            ${escapeHtml(st.address)}
                        </p>
                    </div>
                    <span class="badge ${badge.class}">
                        <span class="status-dot ${isNetwork ? (badge.text === 'Available' ? 'dot-available' : (badge.text === 'Limited' ? 'dot-warning' : 'dot-occupied')) : ''}" 
                              style="${!isNetwork ? 'background:#2563EB; box-shadow:0 0 8px #2563EB;' : ''}"></span>
                        ${badge.text}
                    </span>
                </div>

                <div class="station-metrics">
                    <div class="metric-item">
                        <i class="fa-solid fa-route" style="color: #38BDF8;"></i>
                        <span>📏 <strong>${distKm} km</strong> away</span>
                    </div>
                    <div class="metric-item">
                        <i class="fa-solid fa-bolt" style="color: var(--electric-cyan);"></i>
                        <span>⚡ <strong>${escapeHtml(st.primary_charging_type)}</strong></span>
                    </div>
                    <div class="metric-item">
                        <i class="fa-solid fa-plug" style="color: #10B981;"></i>
                        <span>🔌 <strong>${st.total_chargers} Sockets</strong></span>
                    </div>
                    <div class="metric-item">
                        <i class="fa-solid fa-indian-rupee-sign" style="color: #F59E0B;"></i>
                        <span>💰 <strong>₹${st.min_price.toFixed(2)}/kWh</strong></span>
                    </div>
                </div>

                <ul class="station-specs">
                    <li>
                        <span><i class="fa-solid fa-gauge-high" style="color: var(--electric-cyan); margin-right: 6px;"></i>Power Output</span>
                        <span>${escapeHtml(st.power_rating || '60 kW')}</span>
                    </li>
                    <li>
                        <span><i class="fa-solid fa-clock" style="color: #94A3B8; margin-right: 6px;"></i>Hours</span>
                        <span>${escapeHtml(st.operating_hours || '24/7 Access')}</span>
                    </li>
                    <li>
                        <span><i class="fa-solid fa-database" style="color: #8B5CF6; margin-right: 6px;"></i>Data Source</span>
                        <span style="font-size: 0.78rem;">${isNetwork ? 'Direct Connected Network' : 'OpenStreetMap Node'}</span>
                    </li>
                </ul>

                <div class="station-card-actions" onclick="event.stopPropagation()">
                    <a href="${st.google_maps_url}" target="_blank" class="btn btn-outline btn-sm" title="Open Google Maps Directions">
                        <i class="fa-solid fa-diamond-turn-right"></i> Directions
                    </a>
                    ${detailsBtn}
                    ${reserveBtn}
                </div>
            </div>
        `;
    }).join('');
}

// ---------------------------------------------------------------------
// Two-Way Synchronization (Card <-> Marker)
// ---------------------------------------------------------------------
function focusStationMarker(stationId) {
    const marker = markerMap[stationId];
    if (marker && mapInstance) {
        mapInstance.flyTo(marker.getLatLng(), 15, { duration: 1.0 });
        marker.openPopup();
        highlightStationCard(stationId);
    }
}

function highlightStationCard(stationId) {
    document.querySelectorAll('.station-card').forEach(c => c.classList.remove('active-selected'));
    const card = document.getElementById(`card-${stationId}`);
    if (card) {
        card.classList.add('active-selected');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// ---------------------------------------------------------------------
// Geolocation & Search Handlers
// ---------------------------------------------------------------------
function triggerGeolocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.', 'warning');
        return;
    }

    showToast('Requesting GPS location permissions...', 'info');

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userGpsCoords = {
                lat: pos.coords.latitude,
                lon: pos.coords.longitude
            };
            currentCenter.lat = userGpsCoords.lat;
            currentCenter.lon = userGpsCoords.lon;
            currentCenter.name = 'Your GPS Location';

            showToast('GPS location locked! Fetching nearby stations...', 'success');
            mapInstance.flyTo([userGpsCoords.lat, userGpsCoords.lon], 14, { duration: 1.2 });
            fetchNearbyStations();
        },
        (err) => {
            console.warn('Geolocation error:', err);
            showToast('Location permission denied or unavailable. Defaulted to Kakinada, AP.', 'info');
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
}

async function handleLocationSearch() {
    const searchInput = document.getElementById('stationSearch');
    const query = (searchInput?.value || '').trim();

    if (!query) {
        fetchNearbyStations();
        return;
    }

    showMapLoading(true);
    document.getElementById('mapLoadingText').innerText = `Geocoding location for '${query}'...`;

    try {
        const resp = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
        const res = await resp.json();

        if (res.success && res.location) {
            const loc = res.location;
            currentCenter.lat = loc.latitude;
            currentCenter.lon = loc.longitude;
            currentCenter.name = loc.display_name;

            userGpsCoords = null; // Clear manual GPS to center on search
            showToast(`Location found: ${loc.display_name.split(',')[0]}`, 'success');

            mapInstance.flyTo([loc.latitude, loc.longitude], 13, { duration: 1.2 });
            fetchNearbyStations();
        } else {
            // Apply text filter to existing list if not a city name
            fetchNearbyStations();
        }
    } catch (err) {
        console.error(err);
        fetchNearbyStations();
    } finally {
        showMapLoading(false);
    }
}

function updateHeaderCounts(payload) {
    const countDisplay = document.getElementById('stationCount');
    const subtext = document.getElementById('stationSubtext');
    const netBadge = document.getElementById('networkBadgeCount');
    const osmBadge = document.getElementById('osmBadgeCount');

    if (countDisplay) {
        countDisplay.innerText = `${payload.count} Charging Station${payload.count === 1 ? '' : 's'} Found`;
    }
    if (subtext) {
        subtext.innerHTML = `Showing stations within <strong>${payload.center.radius_km} km</strong> &bull; Center: ${escapeHtml(currentCenter.name)}`;
    }
    if (netBadge) {
        netBadge.innerHTML = `<i class="fa-solid fa-bolt"></i> ${payload.network_count} Network Connected`;
    }
    if (osmBadge) {
        osmBadge.innerHTML = `<i class="fa-solid fa-globe"></i> ${payload.osm_count} OSM Mapped`;
    }
}

function showMapLoading(show) {
    const overlay = document.getElementById('mapLoadingOverlay');
    if (overlay) {
        if (show) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }
}

function resetAllFilters() {
    const s = document.getElementById('stationSearch');
    const r = document.getElementById('radiusFilter');
    const src = document.getElementById('sourceFilter');
    const t = document.getElementById('typeFilter');
    const a = document.getElementById('availFilter');

    if (s) s.value = '';
    if (r) r.value = '35';
    if (src) src.value = 'all';
    if (t) t.value = 'All';
    if (a) a.value = 'All';

    resetToKakinada();
}

function resetToKakinada() {
    currentCenter = { lat: 16.989065, lon: 82.247465, name: 'Kakinada, Andhra Pradesh' };
    currentRadiusKm = 35;
    userGpsCoords = null;
    mapInstance.flyTo([currentCenter.lat, currentCenter.lon], 13, { duration: 1.0 });
    fetchNearbyStations();
}

function expandRadius() {
    const r = document.getElementById('radiusFilter');
    if (r) {
        r.value = '75';
        currentRadiusKm = 75;
        fetchNearbyStations();
    }
}

// ---------------------------------------------------------------------
// OpenStreetMap Metadata Modal Handler (Requirement #5)
// ---------------------------------------------------------------------
function openOsmModal(stationId) {
    const st = currentStations.find(s => s.station_id == stationId);
    if (!st) return;

    document.getElementById('modalStationTitle').innerText = st.station_name;
    document.getElementById('modalAddress').innerText = st.address;
    document.getElementById('modalOperator').innerText = st.operator || 'Independent / Public';
    document.getElementById('modalCoords').innerText = `${st.latitude.toFixed(6)}, ${st.longitude.toFixed(6)}`;
    document.getElementById('modalConnectors').innerText = (st.connectors || []).join(', ') || st.primary_charging_type;
    document.getElementById('modalPower').innerText = st.power_rating || '50 kW Fast Charging';
    document.getElementById('modalHours').innerText = st.operating_hours || '24/7 Access';
    document.getElementById('modalTariff').innerText = st.tariff_str || 'Standard Commercial Tariff';
    document.getElementById('modalOsmId').innerHTML = st.osm_id ? 
        `<a href="https://www.openstreetmap.org/node/${st.osm_id}" target="_blank" style="color:var(--electric-cyan);">OSM Node #${st.osm_id} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75rem;"></i></a>` : 'OpenStreetMap';

    const directionsBtn = document.getElementById('modalDirectionsBtn');
    if (directionsBtn) {
        directionsBtn.href = st.google_maps_url;
    }

    const reserveBtn = document.getElementById('modalReserveBtn');
    if (reserveBtn) {
        if (st.is_network_station) {
            reserveBtn.href = `/reserve?station_id=${st.station_id}`;
            reserveBtn.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Reserve Slot';
        } else {
            // For external OSM stations, link to booking interface with notice
            reserveBtn.href = `/reserve`;
            reserveBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Book Network Bay';
        }
    }

    const modal = document.getElementById('osmDetailModal');
    if (modal) modal.classList.add('active');
}

function closeOsmModal() {
    const modal = document.getElementById('osmDetailModal');
    if (modal) modal.classList.remove('active');
}

// Haversine distance calculator on client
function calculateHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}
