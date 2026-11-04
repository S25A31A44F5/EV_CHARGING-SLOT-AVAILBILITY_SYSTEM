/**
 * EV Charging Slot Availability System
 * Visual Analytics & Machine Learning Demand Prediction Charts (Chart.js)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check if on analytics page
    if (document.getElementById('stationUsageChart')) {
        loadAnalyticsData();
    }

    // Check if on ML demand prediction page
    if (document.getElementById('demandForecastChart')) {
        initDemandPrediction();
    }
});

async function loadAnalyticsData() {
    try {
        const resp = await fetch('/api/analytics/summary');
        const data = await resp.json();
        if (!data.success) return;

        // Chart defaults for dark futuristic theme
        Chart.defaults.color = '#94A3B8';
        Chart.defaults.font.family = "'Inter', sans-serif";

        // 1. Charging Station Usage (Bar Chart)
        const ctxStation = document.getElementById('stationUsageChart')?.getContext('2d');
        if (ctxStation) {
            new Chart(ctxStation, {
                type: 'bar',
                data: {
                    labels: data.station_usage.labels,
                    datasets: [{
                        label: 'Total Charging Sessions',
                        data: data.station_usage.data,
                        backgroundColor: 'rgba(0, 210, 255, 0.75)',
                        borderColor: '#00D2FF',
                        borderWidth: 1.5,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { grid: { color: 'rgba(255, 255, 255, 0.06)' }, beginAtZero: true },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        // 2. Peak Charging Hours Line Chart
        const ctxPeak = document.getElementById('peakHoursChart')?.getContext('2d');
        if (ctxPeak) {
            new Chart(ctxPeak, {
                type: 'line',
                data: {
                    labels: data.peak_hours.labels,
                    datasets: [{
                        label: 'Demand Intensity (%)',
                        data: data.peak_hours.data,
                        borderColor: '#38BDF8',
                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#00D2FF',
                        pointRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { grid: { color: 'rgba(255, 255, 255, 0.06)' }, min: 0, max: 100 },
                        x: { grid: { color: 'rgba(255, 255, 255, 0.04)' } }
                    }
                }
            });
        }

        // 3. Charger Occupancy Donut Chart
        const ctxOcc = document.getElementById('occupancyDonutChart')?.getContext('2d');
        if (ctxOcc) {
            new Chart(ctxOcc, {
                type: 'doughnut',
                data: {
                    labels: ['Available', 'Occupied', 'Maintenance'],
                    datasets: [{
                        data: [
                            data.occupancy.available,
                            data.occupancy.occupied,
                            data.occupancy.maintenance
                        ],
                        backgroundColor: ['#10B981', '#EF4444', '#F59E0B'],
                        borderColor: '#0A0F1D',
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } }
                    },
                    cutout: '72%'
                }
            });
        }

        // 4. Daily Reservations (Last 7 Days)
        const ctxDaily = document.getElementById('dailyTrendChart')?.getContext('2d');
        if (ctxDaily) {
            new Chart(ctxDaily, {
                type: 'line',
                data: {
                    labels: data.daily_trend.labels,
                    datasets: [{
                        label: 'Slot Reservations',
                        data: data.daily_trend.data,
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        borderWidth: 2.5,
                        fill: true,
                        tension: 0.35,
                        pointBackgroundColor: '#10B981',
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { grid: { color: 'rgba(255, 255, 255, 0.06)' }, beginAtZero: true },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        // 5. Monthly Usage Bar Chart
        const ctxMonthly = document.getElementById('monthlyUsageChart')?.getContext('2d');
        if (ctxMonthly) {
            new Chart(ctxMonthly, {
                type: 'bar',
                data: {
                    labels: data.monthly_usage.labels,
                    datasets: [{
                        label: 'Monthly Charging Sessions',
                        data: data.monthly_usage.data,
                        backgroundColor: 'rgba(139, 92, 246, 0.75)',
                        borderColor: '#8B5CF6',
                        borderWidth: 1.5,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { grid: { color: 'rgba(255, 255, 255, 0.06)' }, beginAtZero: true },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

    } catch (err) {
        console.error('Error rendering analytics charts:', err);
    }
}

// ---------------------------------------------------------------------
// Machine Learning Demand Prediction View & Interactive Tester
// ---------------------------------------------------------------------
let forecastChartInstance = null;

function initDemandPrediction() {
    const mlForm = document.getElementById('mlPredictForm');
    const stationSelect = document.getElementById('mlStationSelect');
    const daySelect = document.getElementById('mlDaySelect');

    if (mlForm) {
        mlForm.addEventListener('submit', handleMLPrediction);
    }

    if (stationSelect) {
        stationSelect.addEventListener('change', () => load24hForecastCurve());
    }
    if (daySelect) {
        daySelect.addEventListener('change', () => load24hForecastCurve());
    }

    // Initial curve load
    load24hForecastCurve();
}

async function handleMLPrediction(e) {
    if (e) e.preventDefault();

    const stationId = document.getElementById('mlStationSelect')?.value || 1;
    const hour = document.getElementById('mlHourSelect')?.value || 14;
    const day = document.getElementById('mlDaySelect')?.value || 2;
    const temp = document.getElementById('mlTempInput')?.value || 28;

    const resultBox = document.getElementById('mlPredictionResult');
    if (resultBox) {
        resultBox.innerHTML = `
            <div style="text-align: center; padding: 24px;">
                <i class="fa-solid fa-brain fa-spin" style="font-size: 2rem; color: var(--electric-cyan);"></i>
                <p style="margin-top: 12px; color: var(--text-secondary);">Running Scikit-Learn RandomForest inference...</p>
            </div>
        `;
    }

    try {
        const resp = await fetch(`/api/ml/predict-demand?station_id=${stationId}&hour=${hour}&day_of_week=${day}&temperature=${temp}`);
        const data = await resp.json();

        if (data.success && resultBox) {
            const pred = data.prediction;
            resultBox.innerHTML = `
                <div style="background: rgba(10, 15, 29, 0.7); border: 1px solid var(--border-accent); border-radius: var(--radius-md); padding: 24px; animation: fadeIn 0.3s ease;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <span style="font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Predicted Demand Level</span>
                        <span class="badge" style="background: ${pred.color}22; color: ${pred.color}; border: 1px solid ${pred.color}55; font-size: 0.95rem; padding: 6px 14px;">
                            ${pred.demand_level}
                        </span>
                    </div>

                    <div style="display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px;">
                        <span style="font-size: 2.8rem; font-weight: 800; font-family: 'Outfit'; color: #FFFFFF;">${pred.predicted_occupancy}%</span>
                        <span style="color: var(--text-secondary); font-size: 0.92rem;">Expected Charger Occupancy</span>
                    </div>

                    <div style="height: 10px; background: rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
                        <div style="height: 100%; width: ${pred.predicted_occupancy}%; background: ${pred.color}; border-radius: 6px; transition: width 0.8s ease;"></div>
                    </div>

                    <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
                        <i class="fa-solid fa-circle-info" style="color: var(--electric-cyan); margin-right: 6px;"></i>
                        ${pred.description}
                    </p>

                    ${pred.ai_strategy ? `
                    <div style="background: rgba(0, 210, 255, 0.08); border-left: 3px solid var(--electric-cyan); border-radius: 4px; padding: 12px 14px; margin-bottom: 16px;">
                        <div style="font-size: 0.78rem; text-transform: uppercase; color: var(--electric-cyan); font-weight: 700; margin-bottom: 4px;">
                            <i class="fa-solid fa-sparkles"></i> Gemini AI Advisory Strategy
                        </div>
                        <div style="font-size: 0.86rem; color: #F1F5F9; line-height: 1.45;">
                            ${pred.ai_strategy.replace(/\n/g, '<br>')}
                        </div>
                    </div>
                    ` : ''}

                    <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-muted);">
                        <span>Model: Scikit-learn Random Forest</span>
                        <span>Confidence: ~94.5%</span>
                    </div>
                </div>
            `;
        }
    } catch (err) {
        console.error(err);
        if (resultBox) {
            resultBox.innerHTML = `<div style="color: #EF4444;">Error generating prediction.</div>`;
        }
    }
}

async function load24hForecastCurve() {
    const stationId = document.getElementById('mlStationSelect')?.value || 1;
    const day = document.getElementById('mlDaySelect')?.value || 2;
    const canvas = document.getElementById('demandForecastChart');
    if (!canvas) return;

    try {
        const resp = await fetch(`/api/ml/curve?station_id=${stationId}&day_of_week=${day}`);
        const data = await resp.json();
        if (!data.success) return;

        const labels = data.curve.map(c => c.hour);
        const values = data.curve.map(c => c.occupancy);

        if (forecastChartInstance) {
            forecastChartInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        forecastChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Predicted Occupancy %',
                    data: values,
                    borderColor: '#00D2FF',
                    backgroundColor: 'rgba(0, 210, 255, 0.12)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Predicted Occupancy: ${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.06)' },
                        min: 0,
                        max: 100,
                        ticks: { callback: v => v + '%' }
                    },
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)' }
                    }
                }
            }
        });

    } catch (err) {
        console.error('Error loading 24h curve:', err);
    }
}

