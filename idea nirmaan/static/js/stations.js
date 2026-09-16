/**
 * EV Charging Slot Availability System
 * Station Discovery, Leaflet Interactive Map & Real-time Charger Matrix
 */

window.StationManager = {
  map: null,
  markers: [],
  stations: [],
  currentStation: null,

  init() {
    this.initEventListeners();
  },

  initEventListeners() {
    const searchInput = document.getElementById('stationSearchInput');
    const typeFilter = document.getElementById('filterChargingType');
    const availFilter = document.getElementById('filterAvailability');
    const sortFilter = document.getElementById('filterSort');

    if (searchInput) searchInput.addEventListener('input', () => this.loadStations());
    if (typeFilter) typeFilter.addEventListener('change', () => this.loadStations());
    if (availFilter) availFilter.addEventListener('change', () => this.loadStations());
    if (sortFilter) sortFilter.addEventListener('change', () => this.loadStations());
  },

  async loadStations() {
    const search = document.getElementById('stationSearchInput')?.value || '';
    const type = document.getElementById('filterChargingType')?.value || 'all';
    const availability = document.getElementById('filterAvailability')?.value || 'all';
    const sort = document.getElementById('filterSort')?.value || 'distance';

    const params = new URLSearchParams({ search, type, availability, sort });

    try {
      const res = await fetch(`/api/stations?${params.toString()}`);
      const data = await res.json();
      if (!data.success) return;

      this.stations = data.stations;
      window.AppState.allStations = data.stations;

      this.renderStationCards(this.stations);
      this.initOrUpdateMap(this.stations);
    } catch (err) {
      console.error('Failed to load stations:', err);
    }
  },

  renderStationCards(stations) {
    const container = document.getElementById('stationsListContainer');
    const countEl = document.getElementById('stationsFoundCount');
    if (countEl) countEl.textContent = `${stations.length} Stations Found`;

    if (!container) return;

    if (stations.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.5rem; background: var(--bg-card); border-radius: var(--radius-lg);">
          <p style="font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 0.8rem;">No charging stations match your criteria.</p>
          <button class="btn btn-outline btn-sm" onclick="StationManager.resetFilters()">Reset Filters</button>
        </div>
      `;
      return;
    }

    container.innerHTML = stations.map(s => {
      let badgeClass = 'badge-available';
      if (s.status === 'Limited') badgeClass = 'badge-limited';
      if (s.status === 'Full') badgeClass = 'badge-full';

      return `
        <div class="station-card" onclick="StationManager.selectStation(${s.station_id})">
          <div class="station-card-header">
            <div>
              <h3 class="station-card-title">${s.station_name}</h3>
              <div class="station-location-text">
                📍 <span>${s.address}, ${s.city}</span>
              </div>
            </div>
            <span class="badge ${badgeClass}">
              <span class="badge-dot"></span>
              ${s.status}
            </span>
          </div>

          <div class="station-metrics-grid">
            <div class="metric-box">
              <span class="metric-box-label">Distance</span>
              <span class="metric-box-value">📏 ${s.distance_km} km</span>
            </div>
            <div class="metric-box">
              <span class="metric-box-label">Chargers</span>
              <span class="metric-box-value">🟢 ${s.available_chargers} / ${s.total_chargers} Free</span>
            </div>
            <div class="metric-box">
              <span class="metric-box-label">Est. Wait</span>
              <span class="metric-box-value">⌛ ${s.waiting_time_min} min</span>
            </div>
          </div>

          <div style="font-size: 0.86rem; color: var(--text-secondary); margin-bottom: 0.8rem;">
            ⚡ <strong>Type:</strong> ${s.charging_types || 'DC Fast Charging'}
          </div>

          <div class="station-card-footer">
            <div class="station-price-tag">
              ₹${s.min_price || 12} <span>/ kWh</span>
            </div>
            <div class="station-card-actions">
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); StationManager.viewDetails(${s.station_id})">
                View Details
              </button>
              <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); startBookingForStation(${s.station_id})">
                Reserve Slot
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  resetFilters() {
    if (document.getElementById('stationSearchInput')) document.getElementById('stationSearchInput').value = '';
    if (document.getElementById('filterChargingType')) document.getElementById('filterChargingType').value = 'all';
    if (document.getElementById('filterAvailability')) document.getElementById('filterAvailability').value = 'all';
    this.loadStations();
  },

  /* ---------------------------------------------------------
     Leaflet Interactive Map Setup
     --------------------------------------------------------- */
  initOrUpdateMap(stations) {
    const mapElement = document.getElementById('stationMap');
    if (!mapElement) return;

    if (!this.map) {
      // Initialize Leaflet Map centered around Kakinada, AP Smart City zone
      this.map = L.map('stationMap', {
        zoomControl: true,
        scrollWheelZoom: false
      }).setView([16.989065, 82.247465], 13);

      // Dark futuristic Map Tiles (CartoDB Dark Matter)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CartoDB</a> OpenStreetMap',
        maxZoom: 18,
        subdomains: 'abcd'
      }).addTo(this.map);
    }

    // Clear existing markers
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];

    // Add markers for stations
    stations.forEach(s => {
      let pinColor = '#10b981'; // green
      if (s.status === 'Limited') pinColor = '#f59e0b'; // orange
      if (s.status === 'Full') pinColor = '#ef4444'; // red

      // Custom SVG Pin
      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="
            background: ${pinColor};
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 14px ${pinColor};
            border: 2px solid #ffffff;
            cursor: pointer;
          ">
            <span style="transform: rotate(45deg); font-size: 14px; font-weight: bold; color: #fff;">⚡</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const marker = L.marker([s.latitude, s.longitude], { icon: customIcon }).addTo(this.map);

      const popupContent = `
        <div style="color: #0f172a; padding: 4px; font-family: Outfit, sans-serif;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700;">${s.station_name}</h4>
          <p style="margin: 0 0 6px 0; font-size: 12px; color: #475569;">${s.address}</p>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px;">
            <span><strong>Available:</strong> ${s.available_chargers} / ${s.total_chargers}</span>
            <span><strong>₹${s.min_price}</strong>/kWh</span>
          </div>
          <button onclick="startBookingForStation(${s.station_id})" style="
            background: #0ea5e9;
            color: #fff;
            border: none;
            border-radius: 4px;
            padding: 5px 10px;
            font-size: 12px;
            font-weight: 600;
            width: 100%;
            cursor: pointer;
          ">
            Reserve Slot
          </button>
        </div>
      `;

      marker.bindPopup(popupContent);
      this.markers.push(marker);
    });
  },

  selectStation(stationId) {
    const station = this.stations.find(s => s.station_id === stationId);
    if (station && this.map) {
      this.map.flyTo([station.latitude, station.longitude], 15, { duration: 1.2 });
    }
  },

  /* ---------------------------------------------------------
     Station Details View Controller
     --------------------------------------------------------- */
  async viewDetails(stationId) {
    try {
      const res = await fetch(`/api/stations/${stationId}`);
      const data = await res.json();
      if (!data.success) return;

      this.currentStation = data.station;
      window.AppState.selectedStationId = stationId;

      const s = data.station;
      document.getElementById('detailsStationName').textContent = s.station_name;
      document.getElementById('detailsStationAddress').textContent = `${s.address}, ${s.city}`;
      document.getElementById('detailsDistance').textContent = `${s.distance_km} km`;
      document.getElementById('detailsHours').textContent = s.operating_hours;
      document.getElementById('detailsPrice').textContent = `₹${s.min_price || 12}/kWh`;
      document.getElementById('detailsEstTime').textContent = s.estimated_charging_time;
      document.getElementById('detailsWaitTime').textContent = `${s.waiting_time_min} min`;
      document.getElementById('detailsTotalChargers').textContent = s.total_chargers;
      document.getElementById('detailsAvailableCount').textContent = s.available_chargers;
      document.getElementById('detailsOccupiedCount').textContent = s.occupied_chargers;

      // Render Visual Charger Matrix
      const matrixContainer = document.getElementById('detailsChargersMatrix');
      if (matrixContainer && s.chargers) {
        matrixContainer.innerHTML = s.chargers.map(c => {
          let badgeColor = 'var(--status-available)';
          if (c.status === 'Occupied') badgeColor = 'var(--status-occupied)';
          if (c.status === 'Maintenance') badgeColor = 'var(--status-maintenance)';

          return `
            <div class="charger-tile status-${c.status}">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="charger-tile-code">${c.charger_code}</span>
                <span style="font-size: 0.75rem; font-weight: 700; color: ${badgeColor};">${c.status}</span>
              </div>
              <span class="charger-tile-type">⚡ ${c.charger_type}</span>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.4rem;">
                <span class="charger-tile-power">${c.power_rating}</span>
                <span style="font-weight: 700; font-size: 0.85rem;">₹${c.price_per_kwh}/kWh</span>
              </div>
            </div>
          `;
        }).join('');
      }

      // Configure Reserve Button in Details
      const reserveBtn = document.getElementById('detailsReserveBtn');
      if (reserveBtn) {
        reserveBtn.onclick = () => startBookingForStation(s.station_id);
      }

      switchView('station-details');
    } catch (err) {
      console.error('Failed to load station details:', err);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.StationManager.init();
});
