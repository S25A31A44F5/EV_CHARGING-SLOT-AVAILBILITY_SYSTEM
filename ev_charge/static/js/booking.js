/**
 * EV Charging Slot Availability System
 * Booking Page: Interactive Time Slot Picker, Live Cost Calculator, Reservation Flow
 */

let selectedSlotTime = null;
let currentTariff = 14.50;

document.addEventListener('DOMContentLoaded', () => {
    initBookingForm();
});

function initBookingForm() {
    const stationSelect = document.getElementById('stationSelect');
    const dateInput = document.getElementById('reservationDate');
    const durationSelect = document.getElementById('durationSelect');
    const chargerSelect = document.getElementById('chargerSelect');
    const bookingForm = document.getElementById('bookingForm');

    // Date change listener
    if (dateInput) {
        dateInput.addEventListener('change', () => {
            updateSummaryDate();
            fetchAvailableSlots();
        });
    }

    // Station change listener
    if (stationSelect) {
        stationSelect.addEventListener('change', () => {
            updateStationDetails(stationSelect.value);
            fetchAvailableSlots();
        });
    }

    // Charger change listener
    if (chargerSelect) {
        chargerSelect.addEventListener('change', () => {
            const opt = chargerSelect.options[chargerSelect.selectedIndex];
            if (opt) {
                currentTariff = parseFloat(opt.getAttribute('data-price') || '14.50');
                const chargerName = opt.innerText;
                const sumCharger = document.getElementById('sumCharger');
                if (sumCharger) sumCharger.innerText = chargerName;
                calculateCost();
            }
        });
    }

    // Duration change listener
    if (durationSelect) {
        durationSelect.addEventListener('change', () => {
            const sumDuration = document.getElementById('sumDuration');
            if (sumDuration) sumDuration.innerText = durationSelect.value + ' mins';
            calculateCost();
        });
    }

    // Initial load
    updateSummaryDate();
    calculateCost();
    fetchAvailableSlots();

    // Form submission
    if (bookingForm) {
        bookingForm.addEventListener('submit', handleReservationSubmit);
    }
}

function updateSummaryDate() {
    const dateInput = document.getElementById('reservationDate');
    const sumDate = document.getElementById('sumDate');
    if (dateInput && sumDate) {
        sumDate.innerText = dateInput.value || 'Not Selected';
    }
}

async function updateStationDetails(stationId) {
    if (!stationId) return;
    try {
        const resp = await fetch(`/api/station/${stationId}`);
        const data = await resp.json();
        if (data.success) {
            const st = data.station;
            const sumStation = document.getElementById('sumStation');
            if (sumStation) sumStation.innerText = st.station_name;

            // Populate charger dropdown
            const chargerSelect = document.getElementById('chargerSelect');
            if (chargerSelect && st.chargers) {
                chargerSelect.innerHTML = st.chargers.map(c => `
                    <option value="${c.charger_id}" data-price="${c.price_per_kwh}" data-type="${c.charger_type}">
                        ${c.charger_code} (${c.charger_type} - ${c.power_rating}) - ₹${c.price_per_kwh}/kWh
                    </option>
                `).join('');

                if (st.chargers.length > 0) {
                    currentTariff = st.chargers[0].price_per_kwh;
                    const sumCharger = document.getElementById('sumCharger');
                    if (sumCharger) sumCharger.innerText = `${st.chargers[0].charger_code} (${st.chargers[0].charger_type})`;
                }
            }
            calculateCost();
        }
    } catch (e) {
        console.error('Error fetching station details:', e);
    }
}

async function fetchAvailableSlots() {
    const stationSelect = document.getElementById('stationSelect');
    const dateInput = document.getElementById('reservationDate');
    const slotsGrid = document.getElementById('slotsGrid');
    const submitBtn = document.getElementById('submitBookingBtn');

    if (!stationSelect || !dateInput || !slotsGrid) return;

    const stationId = stationSelect.value;
    const dateStr = dateInput.value;

    slotsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 24px; color: var(--text-secondary);">
            <i class="fa-solid fa-spinner fa-spin"></i> Checking slot availability...
        </div>
    `;

    try {
        const resp = await fetch(`/api/station/${stationId}/slots?date=${dateStr}`);
        const data = await resp.json();

        if (data.success) {
            renderSlots(data.slots);
        }
    } catch (err) {
        slotsGrid.innerHTML = `<div style="grid-column: 1/-1; color: #EF4444;">Failed to load time slots.</div>`;
    }
}

function renderSlots(slots) {
    const slotsGrid = document.getElementById('slotsGrid');
    if (!slotsGrid) return;

    selectedSlotTime = null;
    const sumTime = document.getElementById('sumTime');
    if (sumTime) sumTime.innerText = 'Select a time slot';

    const submitBtn = document.getElementById('submitBookingBtn');
    if (submitBtn) submitBtn.disabled = true;

    slotsGrid.innerHTML = slots.map(s => {
        const isBooked = s.status === 'Booked';
        return `
            <button type="button" 
                    class="slot-btn ${isBooked ? 'disabled' : ''}" 
                    data-time="${s.time}" 
                    ${isBooked ? 'disabled title="Slot is already fully occupied"' : ''}
                    onclick="selectTimeSlot(this, '${s.time}')">
                <div>${s.time}</div>
                <div style="font-size: 0.72rem; margin-top: 4px; font-weight: normal; color: ${isBooked ? '#EF4444' : '#10B981'};">
                    ${isBooked ? 'Booked' : 'Available'}
                </div>
            </button>
        `;
    }).join('');
}

function selectTimeSlot(buttonElement, timeStr) {
    // Unselect others
    document.querySelectorAll('.slot-btn').forEach(btn => btn.classList.remove('selected'));
    buttonElement.classList.add('selected');

    selectedSlotTime = timeStr;
    const sumTime = document.getElementById('sumTime');
    if (sumTime) sumTime.innerText = timeStr;

    const submitBtn = document.getElementById('submitBookingBtn');
    if (submitBtn) submitBtn.disabled = false;
}

function calculateCost() {
    const durationSelect = document.getElementById('durationSelect');
    const duration = parseInt(durationSelect?.value || '60');

    // Approximate energy consumed: ~22kWh per hour for typical charging speed
    const estEnergy = ((duration / 60) * 22).toFixed(1);
    const estCost = Math.round(estEnergy * currentTariff);

    const sumEnergy = document.getElementById('sumEnergy');
    const sumTotalCost = document.getElementById('sumTotalCost');

    if (sumEnergy) sumEnergy.innerText = `${estEnergy} kWh`;
    if (sumTotalCost) sumTotalCost.innerText = `₹${estCost}`;
}

async function handleReservationSubmit(e) {
    e.preventDefault();

    if (!selectedSlotTime) {
        showToast('Please select an available time slot.', 'warning');
        return;
    }

    const stationId = document.getElementById('stationSelect')?.value;
    const chargerId = document.getElementById('chargerSelect')?.value;
    const resDate = document.getElementById('reservationDate')?.value;
    const duration = document.getElementById('durationSelect')?.value;
    const vehicleType = document.getElementById('vehicleType')?.value;
    const vehicleNumber = document.getElementById('vehicleNumber')?.value;

    const payload = {
        station_id: parseInt(stationId),
        charger_id: chargerId ? parseInt(chargerId) : null,
        reservation_date: resDate,
        start_time: selectedSlotTime,
        estimated_duration: parseInt(duration),
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber
    };

    const submitBtn = document.getElementById('submitBookingBtn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reserving Slot...';

    try {
        const resp = await fetch('/api/reserve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const res = await resp.json();

        if (res.success) {
            showToast(res.message, 'success');
            setTimeout(() => {
                window.location.href = res.redirect_url;
            }, 800);
        } else {
            showToast(res.message || 'Booking failed', 'danger');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    } catch (err) {
        console.error(err);
        showToast('Network error while creating reservation', 'danger');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

