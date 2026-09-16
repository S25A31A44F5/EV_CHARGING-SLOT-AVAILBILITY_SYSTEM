/**
 * EV Charging Slot Availability System
 * Main Application Controller, Navigation Router & Auth State
 */

// Global State
window.AppState = {
  currentUser: null,
  currentView: 'home',
  allStations: [],
  selectedStationId: null,
  selectedChargerId: null,
  bookingDraft: null
};

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  checkAuthSession();
  initAnimatedCounters();
  fetchLiveAvailability();
  
  // Refresh live availability every 20 seconds
  setInterval(fetchLiveAvailability, 20000);
});

/* ---------------------------------------------------------
   1. NAVIGATION & VIEW ROUTER
   --------------------------------------------------------- */
function initNavigation() {
  // Nav Links
  document.querySelectorAll('[data-view-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-view-target');
      switchView(target);
      
      // Close mobile nav if open
      const mobileNav = document.getElementById('navLinks');
      if (mobileNav) mobileNav.classList.remove('mobile-open');
    });
  });

  // Mobile Hamburger Toggle
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
    });
  }
}

function switchView(viewName, params = {}) {
  window.AppState.currentView = viewName;

  // Hide all views
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });

  // Highlight active nav link
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-view-target') === viewName) {
      link.classList.add('active');
    }
  });

  // Show target view
  const targetElement = document.getElementById(`view-${viewName}`);
  if (targetElement) {
    targetElement.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Trigger view-specific loaders
  if (viewName === 'find-stations') {
    if (window.StationManager) {
      window.StationManager.loadStations();
      setTimeout(() => {
        if (window.StationManager.map) {
          window.StationManager.map.invalidateSize();
        }
      }, 300);
    }
  } else if (viewName === 'analytics') {
    if (window.AnalyticsManager) window.AnalyticsManager.loadAnalytics();
  } else if (viewName === 'ml-prediction') {
    if (window.MLPredictionManager) window.MLPredictionManager.loadPredictions();
  } else if (viewName === 'my-bookings') {
    if (window.BookingManager) window.BookingManager.loadUserBookings();
  } else if (viewName === 'dashboard') {
    loadUserDashboard();
  } else if (viewName === 'admin') {
    if (window.AdminManager) window.AdminManager.initAdminPortal();
  }
}

/* ---------------------------------------------------------
   2. AUTHENTICATION & SESSION MANAGEMENT
   --------------------------------------------------------- */
async function checkAuthSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.authenticated && data.user) {
      window.AppState.currentUser = data.user;
      renderUserAuthUI(data.user);
    } else {
      renderGuestAuthUI();
    }
  } catch (err) {
    console.error('Session check error:', err);
    renderGuestAuthUI();
  }
}

function renderUserAuthUI(user) {
  const authContainer = document.getElementById('navAuthContainer');
  if (!authContainer) return;

  const isAdmin = user.role === 'admin';

  authContainer.innerHTML = `
    <div class="user-nav-badge" id="userMenuBtn" onclick="switchView('dashboard')">
      <div class="user-nav-avatar">${user.name.charAt(0).toUpperCase()}</div>
      <span class="user-nav-name">${user.name.split(' ')[0]}</span>
    </div>
    ${isAdmin ? `<button class="btn btn-outline btn-sm" onclick="switchView('admin')">⚙️ Admin</button>` : ''}
    <button class="btn btn-secondary btn-sm" onclick="handleLogout()">Logout</button>
  `;
}

function renderGuestAuthUI() {
  const authContainer = document.getElementById('navAuthContainer');
  if (!authContainer) return;

  authContainer.innerHTML = `
    <button class="btn btn-secondary btn-sm" onclick="openModal('loginModal')">Login</button>
    <button class="btn btn-primary btn-sm" onclick="openModal('registerModal')">Register</button>
  `;
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showToast('Please enter both email and password.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (data.success) {
      window.AppState.currentUser = data.user;
      closeModal('loginModal');
      renderUserAuthUI(data.user);
      showToast(data.message, 'success');
      
      if (data.user.role === 'admin') {
        switchView('admin');
      } else {
        switchView('dashboard');
      }
    } else {
      showToast(data.message || 'Login failed.', 'error');
    }
  } catch (err) {
    showToast('Server connection error. Please try again.', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  const vehicleType = document.getElementById('regVehicleType').value;
  const vehicleNumber = document.getElementById('regVehicleNumber').value.trim();

  if (password !== confirmPassword) {
    showToast('Passwords do not match.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, email, phone, password,
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber
      })
    });
    const data = await res.json();

    if (data.success) {
      window.AppState.currentUser = data.user;
      closeModal('registerModal');
      renderUserAuthUI(data.user);
      showToast(data.message, 'success');
      switchView('dashboard');
    } else {
      showToast(data.message || 'Registration failed.', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to backend server.', 'error');
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.AppState.currentUser = null;
    renderGuestAuthUI();
    showToast('Logged out successfully.', 'success');
    switchView('home');
  } catch (err) {
    console.error('Logout error:', err);
  }
}

/* ---------------------------------------------------------
   3. MODAL CONTROLLER
   --------------------------------------------------------- */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// Close on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('active');
  }
});

/* ---------------------------------------------------------
   4. TOAST NOTIFICATIONS
   --------------------------------------------------------- */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '✓';
  if (type === 'warning') icon = '⚠';
  if (type === 'error') icon = '✕';

  toast.innerHTML = `
    <span style="font-weight: bold; font-size: 1.1rem;">${icon}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ---------------------------------------------------------
   5. LIVE AVAILABILITY WIDGET
   --------------------------------------------------------- */
async function fetchLiveAvailability() {
  try {
    const res = await fetch('/api/system/live-availability');
    const data = await res.json();
    if (!data.success) return;

    const totalEl = document.getElementById('liveTotalChargers');
    const availEl = document.getElementById('liveAvailChargers');
    const occEl = document.getElementById('liveOccChargers');
    const maintEl = document.getElementById('liveMaintChargers');

    if (totalEl) totalEl.textContent = data.total_chargers;
    if (availEl) availEl.textContent = data.available;
    if (occEl) occEl.textContent = data.occupied;
    if (maintEl) maintEl.textContent = data.maintenance;

    // Update Progress Segments
    const segAvail = document.getElementById('segAvailable');
    const segOcc = document.getElementById('segOccupied');
    const segMaint = document.getElementById('segMaintenance');

    if (segAvail && data.total_chargers > 0) {
      segAvail.style.width = `${(data.available / data.total_chargers) * 100}%`;
      segOcc.style.width = `${(data.occupied / data.total_chargers) * 100}%`;
      segMaint.style.width = `${(data.maintenance / data.total_chargers) * 100}%`;
    }
  } catch (err) {
    console.error('Failed to update live availability banner:', err);
  }
}

/* ---------------------------------------------------------
   6. ANIMATED COUNTERS FOR HERO SECTION
   --------------------------------------------------------- */
function initAnimatedCounters() {
  const counters = [
    { id: 'counterStations', target: 50, suffix: '+' },
    { id: 'counterPoints', target: 200, suffix: '+' },
    { id: 'counterReservations', target: 1500, suffix: '+' },
    { id: 'counterAvailability', target: 95, suffix: '%' }
  ];

  counters.forEach(c => {
    const el = document.getElementById(c.id);
    if (!el) return;
    
    let current = 0;
    const increment = Math.ceil(c.target / 35);
    const timer = setInterval(() => {
      current += increment;
      if (current >= c.target) {
        current = c.target;
        clearInterval(timer);
      }
      el.textContent = `${current.toLocaleString()}${c.suffix}`;
    }, 40);
  });
}

/* ---------------------------------------------------------
   7. USER DASHBOARD DATA LOADER
   --------------------------------------------------------- */
async function loadUserDashboard() {
  const user = window.AppState.currentUser;
  const greetingEl = document.getElementById('dashGreetingName');
  if (greetingEl && user) {
    greetingEl.textContent = user.name;
  }

  // Load User Stats & Upcoming Reservation
  try {
    const res = await fetch('/api/reservations?status=all');
    const data = await res.json();
    const bookings = data.reservations || [];

    const upcoming = bookings.filter(b => b.status === 'Confirmed');
    const completed = bookings.filter(b => b.status === 'Completed');
    const cancelled = bookings.filter(b => b.status === 'Cancelled');

    document.getElementById('dashUpcomingCount').textContent = upcoming.length;
    document.getElementById('dashCompletedCount').textContent = completed.length;
    document.getElementById('dashCancelledCount').textContent = cancelled.length;
    document.getElementById('dashTotalTime').textContent = `${completed.length * 60}m`;

    // Render Upcoming Reservation Banner
    const upcomingContainer = document.getElementById('dashUpcomingCard');
    if (upcoming.length > 0) {
      const nextBooking = upcoming[0];
      upcomingContainer.innerHTML = `
        <div class="booking-card" style="background: linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(17, 27, 46, 0.9)); border: 1px solid rgba(14, 165, 233, 0.4);">
          <div class="booking-card-main">
            <span class="badge badge-available" style="margin-bottom: 0.6rem;">Upcoming Confirmed</span>
            <h4>${nextBooking.station_name}</h4>
            <div class="booking-card-meta">
              <span>📅 ${nextBooking.reservation_date}</span>
              <span>⏰ ${nextBooking.start_time}</span>
              <span>⚡ Charger ${nextBooking.charger_code} (${nextBooking.charger_type})</span>
            </div>
          </div>
          <div class="station-card-actions">
            <button class="btn btn-outline btn-sm" onclick="switchView('my-bookings')">View Details</button>
            <button class="btn btn-danger btn-sm" onclick="cancelBookingFromDash(${nextBooking.reservation_id})">Cancel</button>
          </div>
        </div>
      `;
    } else {
      upcomingContainer.innerHTML = `
        <div style="padding: 2rem; background: var(--bg-surface-elevated); border-radius: var(--radius-md); text-align: center;">
          <p>No upcoming reservations currently scheduled.</p>
          <button class="btn btn-primary btn-sm" style="margin-top: 1rem;" onclick="switchView('find-stations')">Find & Book Station</button>
        </div>
      `;
    }

    // Load Recommended Stations in Dashboard
    loadRecommendedWidget('dashRecommendationsContainer');
  } catch (err) {
    console.error('Failed to load user dashboard:', err);
  }
}

async function cancelBookingFromDash(resId) {
  if (!confirm('Are you sure you want to cancel this reservation?')) return;
  try {
    const res = await fetch(`/api/reservations/${resId}/cancel`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Reservation cancelled successfully.', 'success');
      loadUserDashboard();
    }
  } catch (err) {
    showToast('Failed to cancel reservation.', 'error');
  }
}

async function loadRecommendedWidget(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const res = await fetch('/api/recommendations');
    const data = await res.json();
    const stations = data.recommendations || [];

    container.innerHTML = stations.map(s => `
      <div class="rec-card">
        <span class="rec-badge">Score: ${s.recommendation_score}</span>
        <h4 style="font-size: 1.15rem; margin-bottom: 0.3rem;">${s.station_name}</h4>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.8rem;">📍 ${s.address}</p>
        
        <div class="rec-reason">
          💡 ${s.recommendation_reason}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem; margin-bottom: 1.2rem;">
          <span>📏 ${s.distance_km} km away</span>
          <span style="color: var(--status-available); font-weight: 700;">🟢 ${s.available_chargers} Free</span>
          <span>⏳ ${s.waiting_time_min}m wait</span>
        </div>

        <button class="btn btn-primary btn-sm" style="width: 100%;" onclick="startBookingForStation(${s.station_id})">Reserve Now</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load recommendations:', err);
  }
}
