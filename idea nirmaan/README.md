# EV Charging Slot Availability System ⚡
**College Engineering Mini-Project — Capstone Demonstration**

A complete, modern, responsive full-stack web application designed for Electric Vehicle (EV) drivers to locate charging stations, monitor live socket availability, reserve guaranteed charging slots, and leverage machine learning for charging demand forecasting.

---

## 1. Key Features

- **Futuristic & Clean UI/UX**: Deep navy theme (`#070b14`), electric blue accents (`#0ea5e9`), smooth micro-animations, glassmorphism cards, and responsive layouts across mobile, tablet, and desktop.
- **Station Search & Interactive Map**:
  - Distance, Charging Type (AC, DC Fast, Rapid), and Availability (Green/Orange/Red) filters.
  - Interactive Leaflet.js map with custom glowing EV markers and station popups.
- **Live Charger Socket Telemetry**:
  - Visual matrix showing individual charger bays (e.g., `Charger 01 — Available`, `Charger 02 — Occupied`, `Charger 03 — Maintenance`).
- **Visual Slot Reservation System**:
  - Visual grid of time slots (`08:00 AM Available`, `10:00 AM Booked`, etc.).
  - Dynamic duration selector and live charging cost calculator.
  - Instant ticket generation with a unique booking ID (e.g., `EV20260918001`) and printable ticket pass.
- **Machine Learning Demand Prediction (Scikit-Learn)**:
  - Architecture: `Historical Data → Data Preprocessing → ML Model → Demand Prediction`.
  - Trained `RandomForestRegressor` predicting 24-hour demand levels (`Low`, `Medium`, `High`, `Very High`).
  - Interactive simulator to test the model against temperature, day of week, and capacity.
- **Smart Station Recommendations**:
  - Multi-factor composite scoring: Distance, available chargers, wait time, price, and demand level.
  - Generates clear reasoning tags (e.g., *"5 chargers available + Short waiting time (≤5 min) + Close distance (1.8 km)"*).
- **Interactive Analytics Dashboard**:
  - Chart.js charts for Station Usage, Peak Charging Hours, Charger Occupancy donut, Daily 7-day trend, and Monthly sessions.
- **Dedicated Admin Management Portal**:
  - KPI overview metrics (Total stations, chargers, active users, today's bookings).
  - Station CRUD (+ Add Charging Station modal, edit, delete).
  - Charger status toggle (Available / Occupied / Maintenance).
  - Reservations log management.
  - User driver accounts management (disable/enable).

---

## 2. Technology Stack

- **Frontend**: HTML5, CSS3 (Vanilla design tokens, responsive grid/flexbox), JavaScript (ES6+), Leaflet.js (OpenStreetMap), Chart.js.
- **Backend**: Python 3, Flask REST API framework, Werkzeug security (PBKDF2 password hashing & session management).
- **Database**:
  - **SQLite (Default Out-of-the-Box)**: Zero-configuration embedded database (`ev_charging.db`), pre-seeded with 6 stations, 31 chargers, and realistic historical logs.
  - **MySQL Support (`schema.sql`)**: Full production schema ready for MySQL 8.0+.
- **Machine Learning**: Python, Scikit-learn, Pandas, NumPy, Joblib.

---

## 3. Quick Start (How to Run)

### Step 1: Install Python Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Run the Application Server
```bash
python app.py
```
The server will start on:
👉 **`http://127.0.0.1:5000`**

Open your web browser and navigate to `http://127.0.0.1:5000`.

---

## 4. Demo Login Credentials

| Role | Email | Password | Access |
| :--- | :--- | :--- | :--- |
| **Admin Officer** | `admin@evcharge.com` | `admin123` | Full Admin Portal, Station CRUD, Charger control, User management |
| **EV Driver** | `rahul@example.com` | `user123` | Slot reservation, Driver dashboard, My Bookings |

You can also register a new driver account directly via the **Register** button with your vehicle type and number.

---

## 5. API Key Configuration

The provided API key has been configured in `.env` and `config.py`:
```ini
API_KEY=AQ.Ab8RN6IAGzZNjOp70LZ0ti9IFEcSjokcFujDn7PF7tNzZvQwvQ
```

---

## 6. Project File Structure

```
idea nirmaan/
│
├── app.py                     # Flask backend application & REST API routes
├── config.py                  # Environment settings & API key loader
├── database.py                # Database connection (SQLite default + MySQL ready)
├── ml_engine.py               # Machine Learning model (Scikit-Learn) for demand prediction
├── schema.sql                 # MySQL schema with tables & sample seed data
├── requirements.txt           # Python dependencies
├── .env                       # Environment configuration and API keys
├── test_endpoints.py          # Automated verification test suite
│
├── static/
│   ├── css/
│   │   ├── style.css          # Core design tokens, modern EV palette, typography
│   │   └── components.css     # Navbar, hero, cards, badges, modal, tables, charts
│   └── js/
│       ├── app.js             # Navigation router, toast notifications, auth sessions
│       ├── stations.js        # Station search, filtering, Leaflet map, charger matrix
│       ├── booking.js         # Slot selection matrix, booking confirmation, ticket pass
│       ├── analytics.js       # Chart.js visualizations
│       ├── ml_prediction.js   # AI demand prediction visualizer & simulator
│       └── admin.js           # Admin management portal (Stations, Chargers, Bookings, Users)
│
└── templates/
    └── index.html             # Multi-view responsive web application
```

---

## 7. Verification & Testing

To run the automated test suite verifying all 12 API endpoints and ML models:
```bash
python test_endpoints.py
```

---

*Developed for College Engineering Mini-Project Demonstration.*
