/**
 * EV Charging Slot Availability System
 * Admin Dashboard JavaScript: Modals, Status Selectors, and Action Handlers
 */

document.addEventListener('DOMContentLoaded', () => {
    // Modal openers
    const addStationBtn = document.getElementById('openAddStationModal');
    const addStationModal = document.getElementById('addStationModal');
    const closeModalBtns = document.querySelectorAll('.close-modal');

    if (addStationBtn && addStationModal) {
        addStationBtn.addEventListener('click', () => {
            addStationModal.classList.add('active');
        });
    }

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        });
    });

    // Close on backdrop click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
});

