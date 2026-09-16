/**
 * EV Charging Slot Availability System
 * Interactive Chart.js Visualizations for Analytics Dashboard
 */

window.AnalyticsManager = {
  charts: {},

  async loadAnalytics() {
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      if (!data.success) return;

      this.renderStationUsageChart(data.station_usage);
      this.renderPeakHoursChart(data.peak_hours);
      this.renderChargerOccupancyChart(data.charger_occupancy);
      this.renderDailyTrendChart(data.daily_trend);
      this.renderMonthlyUsageChart(data.monthly_data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  },

  renderStationUsageChart(stationData) {
    const ctx = document.getElementById('chartStationUsage');
    if (!ctx) return;

    if (this.charts.stationUsage) this.charts.stationUsage.destroy();

    const labels = stationData.map(d => d.station_name.replace(' Station', '').replace(' Hub', ''));
    const values = stationData.map(d => d.total_bookings);

    this.charts.stationUsage = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Sessions Booked',
          data: values,
          backgroundColor: 'rgba(14, 165, 233, 0.75)',
          borderColor: '#0ea5e9',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0e1626',
            titleColor: '#fff',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
            grid: { color: 'rgba(255,255,255,0.05)' }
          }
        }
      }
    });
  },

  renderPeakHoursChart(peakData) {
    const ctx = document.getElementById('chartPeakHours');
    if (!ctx) return;

    if (this.charts.peakHours) this.charts.peakHours.destroy();

    const labels = peakData.map(d => d.hour);
    const values = peakData.map(d => d.sessions);

    this.charts.peakHours = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Charging Demand (Vehicles / hr)',
          data: values,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.15)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#0ea5e9',
          pointBorderColor: '#fff',
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
            grid: { color: 'rgba(255,255,255,0.05)' }
          }
        }
      }
    });
  },

  renderChargerOccupancyChart(occData) {
    const ctx = document.getElementById('chartOccupancyDonut');
    if (!ctx) return;

    if (this.charts.occupancy) this.charts.occupancy.destroy();

    this.charts.occupancy = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Available', 'Occupied', 'Maintenance'],
        datasets: [{
          data: [occData.Available, occData.Occupied, occData.Maintenance],
          backgroundColor: ['#10b981', '#ef4444', '#64748b'],
          borderColor: '#111b2e',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { family: 'Outfit' }, boxWidth: 14 }
          }
        },
        cutout: '70%'
      }
    });
  },

  renderDailyTrendChart(dailyData) {
    const ctx = document.getElementById('chartDailyTrend');
    if (!ctx) return;

    if (this.charts.dailyTrend) this.charts.dailyTrend.destroy();

    this.charts.dailyTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dailyData.map(d => d.date),
        datasets: [{
          label: 'Daily Reservations',
          data: dailyData.map(d => d.reservations),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#10b981',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  },

  renderMonthlyUsageChart(monthlyData) {
    const ctx = document.getElementById('chartMonthlyUsage');
    if (!ctx) return;

    if (this.charts.monthlyUsage) this.charts.monthlyUsage.destroy();

    this.charts.monthlyUsage = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthlyData.map(d => d.month),
        datasets: [{
          label: 'Charging Sessions',
          data: monthlyData.map(d => d.sessions),
          backgroundColor: 'rgba(56, 189, 248, 0.65)',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }
};
