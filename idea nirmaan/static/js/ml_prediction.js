/**
 * EV Charging Slot Availability System
 * AI & Machine Learning Demand Prediction Visualizer
 */

window.MLPredictionManager = {
  demandChart: null,

  async loadPredictions() {
    const chargers = document.getElementById('simChargersInput')?.value || 6;
    const day = document.getElementById('simDaySelect')?.value || 2;
    const temp = document.getElementById('simTempInput')?.value || 30.0;

    try {
      const res = await fetch(`/api/demand/forecast?chargers=${chargers}&day_of_week=${day}&temp=${temp}`);
      const data = await res.json();
      if (!data.success) return;

      // Render Highlight Key Hours Cards
      this.renderHighlightPills(data.highlight_table);

      // Render 24-Hour Demand Curve
      this.renderDemandCurveChart(data.full_forecast);

      // Render Model Performance Metrics
      this.renderModelMetrics(data.metrics);

      // Render Smart Station Recommendations
      loadRecommendedWidget('mlRecommendationsGrid');
    } catch (err) {
      console.error('Failed to load ML demand prediction:', err);
    }
  },

  renderHighlightPills(highlights) {
    const container = document.getElementById('demandHighlightsContainer');
    if (!container) return;

    container.innerHTML = highlights.map(item => {
      let levelClass = 'text-available';
      if (item.demand_level === 'Medium') levelClass = 'text-limited';
      if (item.demand_level === 'High' || item.demand_level === 'Very High') levelClass = 'text-occupied';

      return `
        <div class="demand-pill-card">
          <div class="time">${item.time_label}</div>
          <div style="font-size: 1.15rem; font-weight: 800;" class="${levelClass}">
            ${item.demand_level}
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.3rem;">
            ${item.demand_percentage}% Load (~${item.estimated_occupied} cars)
          </div>
        </div>
      `;
    }).join('');
  },

  renderDemandCurveChart(forecast) {
    const ctx = document.getElementById('chartDemandCurve');
    if (!ctx) return;

    if (this.demandChart) this.demandChart.destroy();

    const labels = forecast.map(f => f.time_label);
    const dataPoints = forecast.map(f => f.demand_percentage);

    this.demandChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'AI Predicted Utilization (%)',
          data: dataPoints,
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14, 165, 233, 0.18)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#38bdf8',
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: '#94a3b8', font: { family: 'Outfit' } } },
          tooltip: {
            callbacks: {
              label: (context) => `Predicted Demand: ${context.parsed.y}%`
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#94a3b8',
              maxTicksLimit: 12,
              font: { family: 'Outfit' }
            },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              color: '#94a3b8',
              callback: (val) => `${val}%`,
              font: { family: 'Outfit' }
            },
            grid: { color: 'rgba(255,255,255,0.05)' }
          }
        }
      }
    });
  },

  renderModelMetrics(metrics) {
    const elR2 = document.getElementById('mlMetricR2');
    const elMae = document.getElementById('mlMetricMae');
    const elSamples = document.getElementById('mlMetricSamples');

    if (elR2) elR2.textContent = metrics.r2_score;
    if (elMae) elMae.textContent = metrics.mae;
    if (elSamples) elSamples.textContent = metrics.samples.toLocaleString();
  }
};
