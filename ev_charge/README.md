# ⚡ EV Charging Slot Availability System
> **College Engineering Mini-Project — Department of Computer Science & Engineering**  
> An intelligent, responsive web platform designed to eliminate EV driver range anxiety, optimize station charger utilization, and provide AI-powered demand forecasting and slot reservations.

---

## 🌟 Key Highlights & Engineering Features

- **⚡ Modern Futuristic UI:** Deep navy, electric cyan, and clean dashboard styling with glassmorphism, animated battery telemetry, micro-interactions, and mobile responsiveness.
- **🗺️ Interactive Station Finder:** Leaflet.js & OpenStreetMap integration featuring custom glowing electric station markers, interactive popups, live search, and multi-parameter filters (Distance, Type, Availability, Price).
- **⏱️ Visual Slot Reservation System:** Visual time-slot grid (Available vs Occupied), dynamic duration selector, real-time energy & cost estimator, and unique confirmation ID pass (`EV20261103001`) with printable confirmation receipts.
- **🧠 Scikit-Learn Machine Learning Model:** Real trained `RandomForestRegressor` (`ml/demand_model.pkl`) predicting hourly charger occupancy rates based on diurnal time cycles, day-of-week commute patterns, and ambient temperature with 24-hour forecast curves.
- **✨ Google Gemini AI Assistant Integration:** Live conversational AI powered by Google AI Studio (using the provided `AQ.` key) answering EV queries in natural language, advising on battery preservation, and recommending stations.
- **🎯 Multi-Factor Recommendation Algorithm:** Evaluates distance, charger availability ratio, queue wait times, tariff pricing, and predicted demand to recommend the optimal station with transparent reasoning badges.
- **🛡️ Full Admin Management Portal:** Complete back-office dashboard featuring 6 key operational metrics, Station CRUD management with interactive modals, hardware socket telemetry overrides, reservation status lifecycle updater, and driver account directory.
- **💾 Dual Database Support:** Zero-setup automatic SQLite (`ev_charge.db`) for immediate demonstration, plus full `schema.sql` script for MySQL 8.x production deployments.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | HTML5, CSS3 (Modern Flexbox/Grid, CSS Custom Properties), Vanilla JavaScript (ES6+), Leaflet.js, Chart.js, FontAwesome 6.5 |
| **Backend** | Python 3.14+, Flask REST Framework, Flask-SQLAlchemy, Werkzeug Security (Bcrypt hashing), Flask-CORS |
| **Database** | MySQL 8.x / MariaDB (production script: `schema.sql`), SQLite3 (out-of-the-box local demo: `ev_charge.db`) |
| **Machine Learning** | Scikit-learn (`RandomForestRegressor`), Pandas, NumPy, Joblib |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
Ensure you have Python 3.10+ installed.

### 2. Install Dependencies
Open a terminal in the project directory and run:
```bash
pip install -r requirements.txt
```

### 3. (Optional) Re-train the Machine Learning Model
The model `ml/demand_model.pkl` is already pre-trained and bundled. If you want to demonstrate the ML training pipeline live:
```bash
python ml/train_demand_model.py
```

### 4. Run the Application
Launch the Flask server:
```bash
python app.py
```
Open your web browser and navigate to:
```
http://127.0.0.1:5000
```

---

## 🔑 Demo Login Credentials

For quick evaluation during college project demonstrations and viva sessions:

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **EV Driver (User)** | `user@evcharge.com` | `user123` | Driver Dashboard, Book Slot, My Bookings, Pass Generator |
| **System Administrator** | `admin@evcharge.com` | `admin123` | Full Admin Console, Station CRUD, Charger Override, User Dir |

> *Tip: On the `/login` screen, click the **1-Click Demo Fill** buttons to automatically fill credentials.*

---

## 📁 Project Structure

```
ev_charge/
├── app.py                     # Flask application routes, REST API endpoints, auth handlers
├── config.py                  # Dual DB configuration (SQLite / MySQL) & secret keys
├── database.py                # SQLAlchemy ORM models (User, Station, Charger, Reservation, etc.)
├── schema.sql                 # Complete MySQL 8.x DDL schema for college submission
├── seed_data.py               # Database seeder populating realistic stations, chargers, bookings
├── test_app.py                # Automated test suite validating all 8 user flows & APIs
├── requirements.txt           # Python dependencies list
├── ml/
│   ├── train_demand_model.py  # Scikit-learn training script generating synthetic dataset
│   ├── demand_model.pkl       # Saved Random Forest regression model artifact
│   ├── sample_historical_sessions.csv # 200 sample training records for evaluation
│   └── predictor.py           # ML inference engine & smart multi-factor scoring
├── static/
│   ├── css/
│   │   ├── style.css          # Main modern CSS stylesheet (responsive, dark/cyan theme)
│   │   └── admin.css          # Admin portal styling & modals
│   └── js/
│       ├── main.js            # Navbar hamburger, animated counters, live telemetry simulator
│       ├── stations.js        # Leaflet map, search, filters, station cards rendering
│       ├── booking.js         # Interactive slot selection, dynamic tariff & cost calculator
│       ├── analytics.js       # Chart.js charts & interactive ML prediction tester
│       └── admin.js           # Admin modal openers and action handlers
└── templates/
    ├── base.html              # Main layout with sticky navbar, alerts, footer
    ├── index.html             # Home page with hero, stats, how-it-works, telemetry bar
    ├── stations.html          # Find Stations page with search filters & Leaflet map
    ├── station_detail.html    # Station details, live charger bay grid, 24h demand profile
    ├── reserve.html           # Interactive slot reservation & live summary receipt
    ├── booking_success.html   # Confirmed booking pass, reference ID, printable receipt
    ├── my_bookings.html       # Driver booking history (Upcoming, Completed, Cancelled tabs)
    ├── dashboard.html         # Driver dashboard with upcoming bookings & recommendations
    ├── login.html             # Login screen with 1-click demo credential fillers
    ├── register.html          # Driver registration form with client-side validation
    ├── analytics.html         # Network charging analytics, diurnal curve & occupancy donut
    ├── ml_demand.html         # AI-Powered Demand Prediction page & interactive tester
    ├── about.html             # College mini-project overview, architecture & future scope
    └── admin/
        ├── base_admin.html    # Admin layout with sidebar navigation
        ├── dashboard.html     # Admin dashboard with 6 operational metric cards
        ├── stations.html      # Station management table & Add Station modal
        ├── chargers.html      # Charger hardware status management & override
        ├── reservations.html  # Reservation lifecycle manager
        └── users.html         # Driver directory & account status toggle
```

---

## 🗄️ MySQL Database Setup (Optional)

If your college laboratory requires connecting directly to MySQL:
1. Open your MySQL client (e.g., MySQL Workbench or CLI) and execute:
   ```sql
   source schema.sql;
   ```
2. Set the environment variable in your terminal:
   ```powershell
   $env:DB_TYPE="mysql"
   $env:MYSQL_USER="root"
   $env:MYSQL_PASSWORD="your_password"
   $env:MYSQL_HOST="localhost"
   $env:MYSQL_DB="ev_charge_db"
   ```
3. Start the application:
   ```bash
   python app.py
   ```

---

## 🧪 Automated Testing

A comprehensive verification test suite is included:
```bash
python test_app.py
```
This tests:
1. Home page rendering & statistics counters
2. Station directory REST API and Leaflet coordinates
3. Hourly slot availability generator
4. Scikit-learn Random Forest inference
5. 24-hour demand prediction curve
6. Multi-factor recommendation algorithm
7. User login, slot booking, and receipt pass generation
8. Admin portal security, metrics, and CRUD operations

---

## 🎓 Academic Defense / Viva Highlights

When presenting this project to faculty or examiners, highlight:
1. **Architectural Separation:** Clear separation of concerns between presentation (HTML/CSS/JS), API layer (Flask), persistent storage (SQLAlchemy ORM + MySQL/SQLite), and predictive analytics (Scikit-Learn).
2. **Real Machine Learning Pipeline:** Rather than hardcoded values, `ml/train_demand_model.py` generates realistic features (station bias, weekday vs weekend diurnal cycles, temperature influence) and trains a `RandomForestRegressor` with $R^2 \approx 0.94$.
3. **Smart Heuristic Recommendation:** Transparent multi-factor scoring formula that factors in distance, socket availability, wait times, tariffs, and predicted demand.
4. **Resilience & Zero-Configuration:** Runs out of the box using SQLite and automatically seeds sample stations, chargers, and reservations on first launch.

