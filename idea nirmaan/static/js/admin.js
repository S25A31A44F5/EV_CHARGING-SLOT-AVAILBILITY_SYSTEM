/**
 * EV Charging Slot Availability System
 * Admin Management Portal Controller (Stations, Chargers, Reservations, Users)
 */

window.AdminManager = {
  currentTab: 'stations',

  async initAdminPortal() {
    this.initEventListeners();
    await this.loadAdminStats();
    this.switchAdminTab(this.currentTab);
  },

  initEventListeners() {
    document.querySelectorAll('[data-admin-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-admin-tab');
        this.switchAdminTab(tab);
      });
    });

    const addStationForm = document.getElementById('addStationForm');
    if (addStationForm) {
      addStationForm.addEventListener('submit', (e) => this.handleAddStation(e));
    }
  },

  switchAdminTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');

    const target = document.getElementById(`adminTab-${tabName}`);
    if (target) target.style.display = 'block';

    if (tabName === 'stations') this.loadStationsTable();
    else if (tabName === 'reservations') this.loadReservationsTable();
    else if (tabName === 'users') this.loadUsersTable();
    else if (tabName === 'chargers') this.loadChargersTable();
  },

  async loadAdminStats() {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (!data.success) return;

      const s = data.stats;
      document.getElementById('admStatStations').textContent = s.total_stations;
      document.getElementById('admStatChargers').textContent = s.total_chargers;
      document.getElementById('admStatAvailable').textContent = s.available_chargers;
      document.getElementById('admStatOccupied').textContent = s.occupied_chargers;
      document.getElementById('admStatReservations').textContent = s.today_reservations;
      document.getElementById('admStatUsers').textContent = s.active_users;
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    }
  },

  /* ---------------------------------------------------------
     1. Stations Management
     --------------------------------------------------------- */
  async loadStationsTable() {
    const tbody = document.getElementById('adminStationsTableBody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/stations');
      const data = await res.json();
      const stations = data.stations || [];

      tbody.innerHTML = stations.map(s => {
        let badgeClass = 'badge-available';
        if (s.status === 'Limited') badgeClass = 'badge-limited';
        if (s.status === 'Full') badgeClass = 'badge-full';

        return `
          <tr>
            <td><strong>${s.station_name}</strong></td>
            <td>📍 ${s.address}</td>
            <td>${s.total_chargers}</td>
            <td><span class="text-available font-bold">🟢 ${s.available_chargers}</span></td>
            <td><span class="text-occupied font-bold">🔴 ${s.occupied_chargers}</span></td>
            <td><span class="badge ${badgeClass}">${s.status}</span></td>
            <td>
              <div style="display: flex; gap: 0.4rem;">
                <button class="btn btn-secondary btn-sm" onclick="StationManager.viewDetails(${s.station_id})">View</button>
                <button class="btn btn-outline btn-sm" onclick="AdminManager.editStationPrompt(${s.station_id}, '${s.station_name.replace(/'/g, "\\'")}', '${s.address.replace(/'/g, "\\'")}', '${s.operating_hours}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="AdminManager.deleteStation(${s.station_id})">Delete</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load admin stations table:', err);
    }
  },

  async handleAddStation(e) {
    e.preventDefault();
    const payload = {
      station_name: document.getElementById('newStationName').value.trim(),
      address: document.getElementById('newStationAddress').value.trim(),
      city: document.getElementById('newStationCity').value.trim() || 'Kakinada',
      latitude: parseFloat(document.getElementById('newStationLat').value),
      longitude: parseFloat(document.getElementById('newStationLng').value),
      operating_hours: document.getElementById('newStationHours').value.trim() || '24/7 Open',
      distance_km: parseFloat(document.getElementById('newStationDist').value) || 2.5,
      num_chargers: parseInt(document.getElementById('newStationChargersCount').value) || 4,
      pricing: parseFloat(document.getElementById('newStationPricing').value) || 12.0
    };

    try {
      const res = await fetch('/api/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('New charging station created.', 'success');
        closeModal('addStationModal');
        document.getElementById('addStationForm').reset();
        this.loadAdminStats();
        this.loadStationsTable();
        // Refresh home/finder stations
        if (window.StationManager) window.StationManager.loadStations();
      } else {
        showToast(data.message || 'Failed to create station.', 'error');
      }
    } catch (err) {
      showToast('Error connecting to backend.', 'error');
    }
  },

  async editStationPrompt(stationId, currentName, currentAddress, currentHours) {
    const newName = prompt('Update Station Name:', currentName);
    if (!newName) return;
    const newAddress = prompt('Update Address:', currentAddress);
    if (!newAddress) return;
    const newHours = prompt('Update Operating Hours:', currentHours);

    try {
      const res = await fetch(`/api/stations/${stationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_name: newName,
          address: newAddress,
          operating_hours: newHours || '24/7 Open'
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Station updated.', 'success');
        this.loadStationsTable();
      }
    } catch (err) {
      showToast('Failed to update station.', 'error');
    }
  },

  async deleteStation(stationId) {
    if (!confirm('Are you sure you want to delete this charging station? All related chargers and reservations will be removed.')) return;
    try {
      const res = await fetch(`/api/stations/${stationId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Station deleted.', 'success');
        this.loadAdminStats();
        this.loadStationsTable();
      }
    } catch (err) {
      showToast('Failed to delete station.', 'error');
    }
  },

  /* ---------------------------------------------------------
     2. Reservations Management
     --------------------------------------------------------- */
  async loadReservationsTable() {
    const tbody = document.getElementById('adminReservationsTableBody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/reservations?status=all');
      const data = await res.json();
      const reservations = data.reservations || [];

      tbody.innerHTML = reservations.map(r => {
        let badgeClass = 'badge-available';
        if (r.status === 'Completed') badgeClass = 'badge-maintenance';
        if (r.status === 'Cancelled') badgeClass = 'badge-occupied';

        return `
          <tr>
            <td><code class="font-mono text-electric">${r.booking_code}</code></td>
            <td>${r.user_name}</td>
            <td><strong>${r.station_name}</strong></td>
            <td>${r.reservation_date}</td>
            <td>${r.start_time}</td>
            <td>${r.charger_code} (${r.charger_type})</td>
            <td><span class="badge ${badgeClass}">${r.status}</span></td>
            <td>
              <div style="display: flex; gap: 0.4rem;">
                ${r.status === 'Confirmed' ? `
                  <button class="btn btn-primary btn-sm" onclick="AdminManager.updateResStatus(${r.reservation_id}, 'Completed')">Complete</button>
                  <button class="btn btn-danger btn-sm" onclick="AdminManager.updateResStatus(${r.reservation_id}, 'Cancelled')">Cancel</button>
                ` : `
                  <span style="color: var(--text-muted); font-size: 0.8rem;">Finalized</span>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load admin reservations:', err);
    }
  },

  async updateResStatus(resId, newStatus) {
    try {
      const res = await fetch(`/api/reservations/${resId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Reservation marked as ${newStatus}.`, 'success');
        this.loadReservationsTable();
      }
    } catch (err) {
      showToast('Failed to update status.', 'error');
    }
  },

  /* ---------------------------------------------------------
     3. User Management
     --------------------------------------------------------- */
  async loadUsersTable() {
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      const users = data.users || [];

      tbody.innerHTML = users.map(u => `
        <tr>
          <td>#${u.user_id}</td>
          <td><strong>${u.name}</strong></td>
          <td>${u.email}</td>
          <td>${u.phone}</td>
          <td>${u.vehicle_type} (${u.vehicle_number})</td>
          <td>${u.total_bookings} Bookings</td>
          <td>
            <span class="badge ${u.status === 'active' ? 'badge-available' : 'badge-occupied'}">
              ${u.status}
            </span>
          </td>
          <td>
            ${u.role !== 'admin' ? `
              <button class="btn ${u.status === 'active' ? 'btn-danger' : 'btn-primary'} btn-sm"
                onclick="AdminManager.toggleUserStatus(${u.user_id}, '${u.status === 'active' ? 'disabled' : 'active'}')">
                ${u.status === 'active' ? 'Disable' : 'Enable'}
              </button>
            ` : `<span style="font-size: 0.8rem; color: var(--electric-cyan);">SuperAdmin</span>`}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load admin users:', err);
    }
  },

  async toggleUserStatus(userId, targetStatus) {
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`User status set to ${targetStatus}.`, 'success');
        this.loadUsersTable();
      }
    } catch (err) {
      showToast('Failed to update user status.', 'error');
    }
  },

  /* ---------------------------------------------------------
     4. Chargers Management
     --------------------------------------------------------- */
  async loadChargersTable() {
    const tbody = document.getElementById('adminChargersTableBody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/stations');
      const data = await res.json();
      const stations = data.stations || [];

      // Collect all chargers
      let allChargers = [];
      for (const s of stations) {
        const dRes = await fetch(`/api/stations/${s.station_id}`);
        const dData = await dRes.json();
        if (dData.success && dData.station.chargers) {
          dData.station.chargers.forEach(c => {
            c.station_name = s.station_name;
            allChargers.push(c);
          });
        }
      }

      tbody.innerHTML = allChargers.map(c => `
        <tr>
          <td><strong class="font-mono text-electric">${c.charger_code}</strong></td>
          <td>${c.station_name}</td>
          <td>⚡ ${c.charger_type}</td>
          <td>${c.power_rating}</td>
          <td>₹${c.price_per_kwh}/kWh</td>
          <td>
            <select class="filter-select" style="padding: 0.2rem 0.5rem;" onchange="AdminManager.changeChargerStatus(${c.charger_id}, this.value)">
              <option value="Available" ${c.status === 'Available' ? 'selected' : ''}>🟢 Available</option>
              <option value="Occupied" ${c.status === 'Occupied' ? 'selected' : ''}>🔴 Occupied</option>
              <option value="Maintenance" ${c.status === 'Maintenance' ? 'selected' : ''}>⚪ Maintenance</option>
            </select>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load admin chargers:', err);
    }
  },

  async changeChargerStatus(chargerId, newStatus) {
    try {
      const res = await fetch(`/api/chargers/${chargerId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        this.loadAdminStats();
        fetchLiveAvailability();
      }
    } catch (err) {
      showToast('Failed to update charger status.', 'error');
    }
  }
};
