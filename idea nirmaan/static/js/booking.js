/**
 * EV Charging Slot Availability System
 * Visual Slot Reservation, Cost Calculation & Booking Ticket Management
 */

window.BookingManager = {
  selectedStation: null,
  selectedCharger: null,
  selectedTimeSlot: null,
  selectedDate: new Date().toISOString().split('T')[0],
  durationMinutes: 60,

  init() {
    this.initListeners();
  },

  initListeners() {
    const dateInput = document.getElementById('bookingDateInput');
    const chargerSelect = document.getElementById('bookingChargerSelect');
    const durationSelect = document.getElementById('bookingDurationSelect');

    if (dateInput) {
      dateInput.value = this.selectedDate;
      dateInput.min = new Date().toISOString().split('T')[0];
      dateInput.addEventListener('change', (e) => {
        this.selectedDate = e.target.value;
        this.loadAvailableSlots();
      });
    }

    if (chargerSelect) {
      chargerSelect.addEventListener('change', (e) => {
        const chargerId = parseInt(e.target.value);
        this.selectedCharger = this.selectedStation.chargers.find(c => c.charger_id === chargerId);
        this.loadAvailableSlots();
        this.updateCostCalculation();
      });
    }

    if (durationSelect) {
      durationSelect.addEventListener('change', (e) => {
        this.durationMinutes = parseInt(e.target.value);
        this.updateCostCalculation();
      });
    }

    const confirmBtn = document.getElementById('confirmReservationBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.submitReservation());
    }

    // My Bookings Tab Toggles
    document.querySelectorAll('[data-booking-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-booking-tab]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.loadUserBookings(tab.getAttribute('data-booking-tab'));
      });
    });
  },

  async startBooking(stationId) {
    try {
      const res = await fetch(`/api/stations/${stationId}`);
      const data = await res.json();
      if (!data.success) return;

      this.selectedStation = data.station;
      window.AppState.selectedStationId = stationId;

      // Populate UI Station Info
      document.getElementById('bookingStationName').textContent = this.selectedStation.station_name;
      document.getElementById('bookingStationLocation').textContent = `${this.selectedStation.address}, ${this.selectedStation.city}`;
      document.getElementById('bookingStationDistance').textContent = `📏 ${this.selectedStation.distance_km} km`;

      // Populate Chargers Dropdown
      const chargerSelect = document.getElementById('bookingChargerSelect');
      if (chargerSelect && this.selectedStation.chargers) {
        chargerSelect.innerHTML = this.selectedStation.chargers.map(c => `
          <option value="${c.charger_id}" ${c.status !== 'Available' ? 'disabled' : ''}>
            ${c.charger_code} - ${c.charger_type} (${c.power_rating}) [₹${c.price_per_kwh}/kWh] ${c.status !== 'Available' ? `(${c.status})` : ''}
          </option>
        `).join('');

        // Default to first available charger
        const firstAvail = this.selectedStation.chargers.find(c => c.status === 'Available') || this.selectedStation.chargers[0];
        if (firstAvail) {
          chargerSelect.value = firstAvail.charger_id;
          this.selectedCharger = firstAvail;
        }
      }

      // Pre-fill user vehicle if logged in
      if (window.AppState.currentUser) {
        const vInput = document.getElementById('bookingVehicleType');
        if (vInput) vInput.value = window.AppState.currentUser.vehicle_type;
      }

      this.selectedTimeSlot = null;
      this.updateCostCalculation();
      this.loadAvailableSlots();

      // Show booking view
      document.getElementById('bookingFormWrapper').style.display = 'block';
      document.getElementById('bookingSuccessWrapper').style.display = 'none';
      switchView('reserve-slot');
    } catch (err) {
      console.error('Error starting booking:', err);
    }
  },

  async loadAvailableSlots() {
    if (!this.selectedStation || !this.selectedCharger) return;

    const container = document.getElementById('timeSlotsContainer');
    if (!container) return;

    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">Loading available time slots...</p>`;

    try {
      const res = await fetch(`/api/reservations/slots?station_id=${this.selectedStation.station_id}&charger_id=${this.selectedCharger.charger_id}&date=${this.selectedDate}`);
      const data = await res.json();
      if (!data.success) return;

      container.innerHTML = data.slots.map(s => {
        const isBooked = !s.available;
        return `
          <button type="button" class="time-slot-btn ${isBooked ? 'booked' : 'available'}" 
            ${isBooked ? 'disabled' : ''}
            onclick="BookingManager.selectSlot('${s.time}', this)">
            <span class="slot-time">${s.time}</span>
            <span class="slot-status">${s.status}</span>
          </button>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load slots:', err);
    }
  },

  selectSlot(time, element) {
    this.selectedTimeSlot = time;
    document.querySelectorAll('.time-slot-btn').forEach(btn => btn.classList.remove('selected'));
    element.classList.add('selected');

    // Update Summary
    document.getElementById('summaryTime').textContent = time;
    this.updateCostCalculation();
  },

  updateCostCalculation() {
    if (!this.selectedStation || !this.selectedCharger) return;

    const rate = this.selectedCharger.price_per_kwh || 12.0;
    // Estimated kWh delivered in selected duration based on charger power rating
    let kw = 50;
    if (this.selectedCharger.power_rating.includes('150')) kw = 120;
    else if (this.selectedCharger.power_rating.includes('60')) kw = 50;
    else if (this.selectedCharger.power_rating.includes('22')) kw = 20;

    const estKwh = (kw * (this.durationMinutes / 60)) * 0.85; // practical charging efficiency
    const estCost = Math.round(estKwh * rate);

    document.getElementById('summaryStation').textContent = this.selectedStation.station_name;
    document.getElementById('summaryDate').textContent = this.selectedDate;
    document.getElementById('summaryTime').textContent = this.selectedTimeSlot || 'Select a slot';
    document.getElementById('summaryCharger').textContent = `${this.selectedCharger.charger_code} (${this.selectedCharger.charger_type})`;
    document.getElementById('summaryDuration').textContent = `${this.durationMinutes} Minutes`;
    document.getElementById('summaryCost').textContent = `₹${estCost}`;
    
    this.estimatedCost = estCost;
  },

  async submitReservation() {
    if (!this.selectedTimeSlot) {
      showToast('Please select an available time slot.', 'warning');
      return;
    }

    const payload = {
      station_id: this.selectedStation.station_id,
      charger_id: this.selectedCharger.charger_id,
      reservation_date: this.selectedDate,
      start_time: this.selectedTimeSlot,
      duration_minutes: this.durationMinutes,
      estimated_cost: this.estimatedCost
    };

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showToast('Reservation confirmed successfully.', 'success');
        this.renderBookingSuccess(data.reservation);
      } else {
        showToast(data.message || 'Booking conflict or error.', 'error');
      }
    } catch (err) {
      showToast('Failed to connect to reservation system.', 'error');
    }
  },

  renderBookingSuccess(reservation) {
    document.getElementById('bookingFormWrapper').style.display = 'none';
    const successWrapper = document.getElementById('bookingSuccessWrapper');
    successWrapper.style.display = 'block';

    document.getElementById('ticketBookingId').textContent = reservation.booking_code;
    document.getElementById('ticketStation').textContent = reservation.station_name;
    document.getElementById('ticketAddress').textContent = reservation.station_address;
    document.getElementById('ticketDate').textContent = reservation.reservation_date;
    document.getElementById('ticketTime').textContent = reservation.start_time;
    document.getElementById('ticketCharger').textContent = `${reservation.charger_code} - ${reservation.charger_type}`;
    document.getElementById('ticketCost').textContent = `₹${reservation.estimated_cost}`;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  printTicket() {
    window.print();
  },

  /* ---------------------------------------------------------
     My Bookings Page Controller
     --------------------------------------------------------- */
  async loadUserBookings(status = 'all') {
    const container = document.getElementById('userBookingsList');
    if (!container) return;

    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Loading your reservations...</p>`;

    try {
      const res = await fetch(`/api/reservations?status=${status}`);
      const data = await res.json();
      const bookings = data.reservations || [];

      if (bookings.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem; background: var(--bg-card); border-radius: var(--radius-lg);">
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">No ${status === 'all' ? '' : status.toLowerCase()} reservations found.</p>
            <button class="btn btn-primary btn-sm" onclick="switchView('find-stations')">Find Stations to Reserve</button>
          </div>
        `;
        return;
      }

      container.innerHTML = bookings.map(b => {
        let badgeClass = 'badge-available';
        if (b.status === 'Completed') badgeClass = 'badge-maintenance';
        if (b.status === 'Cancelled') badgeClass = 'badge-occupied';

        return `
          <div class="booking-card">
            <div class="booking-card-main">
              <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.4rem;">
                <span class="badge ${badgeClass}">${b.status}</span>
                <span style="font-family: 'JetBrains Mono'; font-size: 0.85rem; color: var(--electric-cyan);">${b.booking_code}</span>
              </div>
              <h4>${b.station_name}</h4>
              <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.6rem;">📍 ${b.station_address}</p>
              <div class="booking-card-meta">
                <span>📅 ${b.reservation_date}</span>
                <span>⏰ ${b.start_time} (${b.duration_minutes} min)</span>
                <span>⚡ Charger ${b.charger_code} (${b.charger_type})</span>
                <span style="color: #fff; font-weight: 700;">₹${b.estimated_cost}</span>
              </div>
            </div>

            <div class="station-card-actions">
              ${b.status === 'Confirmed' ? `
                <button class="btn btn-danger btn-sm" onclick="BookingManager.cancelBooking(${b.reservation_id})">
                  Cancel Booking
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-sm" onclick="BookingManager.showBookingTicket('${b.booking_code}', '${b.station_name}', '${b.reservation_date}', '${b.start_time}', '${b.charger_code}', '${b.estimated_cost}')">
                View Slip
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load reservations:', err);
    }
  },

  async cancelBooking(resId) {
    if (!confirm('Are you sure you want to cancel this reservation?')) return;
    try {
      const res = await fetch(`/api/reservations/${resId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Reservation cancelled successfully.', 'success');
        this.loadUserBookings();
      }
    } catch (err) {
      showToast('Failed to cancel reservation.', 'error');
    }
  },

  showBookingTicket(code, station, date, time, charger, cost) {
    this.renderBookingSuccess({
      booking_code: code,
      station_name: station,
      station_address: 'Smart City Corridor, Kakinada',
      reservation_date: date,
      start_time: time,
      charger_code: charger,
      charger_type: 'High Speed Port',
      estimated_cost: cost
    });
    switchView('reserve-slot');
  }
};

// Global shorthand for reserve buttons
function startBookingForStation(stationId) {
  if (window.BookingManager) {
    window.BookingManager.startBooking(stationId);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.BookingManager.init();
});
