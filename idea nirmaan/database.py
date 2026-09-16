"""
EV Charging Slot Availability System
Database Layer with Dual Engine Support:
- SQLite (Default, Zero-Setup, embedded file 'ev_charging.db')
- MySQL (Production configuration via 'USE_MYSQL = True')
"""

import os
import sqlite3
from werkzeug.security import generate_password_hash

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ev_charging.db')

# MySQL Configuration Toggle
USE_MYSQL = False
MYSQL_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'password',
    'database': 'ev_charging_db'
}

def get_connection():
    """Get database connection based on configured engine."""
    if USE_MYSQL:
        try:
            import pymysql
            conn = pymysql.connect(
                host=MYSQL_CONFIG['host'],
                user=MYSQL_CONFIG['user'],
                password=MYSQL_CONFIG['password'],
                database=MYSQL_CONFIG['database'],
                cursorclass=pymysql.cursors.DictCursor
            )
            return conn
        except Exception as e:
            print(f"[Database Warning] MySQL connection failed ({e}). Falling back to SQLite.")
    
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def query_db(query, args=(), one=False):
    """Execute read query and return dict or list of dicts."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(query, args)
    rv = cur.fetchall()
    cur.close()
    conn.close()
    if USE_MYSQL:
        return (rv[0] if rv else None) if one else rv
    else:
        results = [dict(row) for row in rv]
        return (results[0] if results else None) if one else results

def execute_db(query, args=()):
    """Execute INSERT/UPDATE/DELETE query and return lastrowid."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(query, args)
    conn.commit()
    last_id = cur.lastrowid
    cur.close()
    conn.close()
    return last_id

def init_db():
    """Initialize tables and seed initial demonstration data."""
    conn = get_connection()
    cur = conn.cursor()

    # 1. Users Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL,
        password TEXT NOT NULL,
        vehicle_type TEXT NOT NULL,
        vehicle_number TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 2. Stations Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS stations (
        station_id INTEGER PRIMARY KEY AUTOINCREMENT,
        station_name TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT DEFAULT 'Kakinada',
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        operating_hours TEXT DEFAULT '24/7 Open',
        distance_km REAL DEFAULT 2.5,
        status TEXT DEFAULT 'Available',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 3. Chargers Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS chargers (
        charger_id INTEGER PRIMARY KEY AUTOINCREMENT,
        station_id INTEGER NOT NULL,
        charger_code TEXT NOT NULL,
        charger_type TEXT NOT NULL,
        power_rating TEXT NOT NULL,
        status TEXT DEFAULT 'Available',
        price_per_kwh REAL DEFAULT 12.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE
    )
    """)

    # 4. Reservations Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS reservations (
        reservation_id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_code TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        station_id INTEGER NOT NULL,
        charger_id INTEGER NOT NULL,
        reservation_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        duration_minutes INTEGER DEFAULT 60,
        status TEXT DEFAULT 'Confirmed',
        estimated_cost REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE,
        FOREIGN KEY (charger_id) REFERENCES chargers(charger_id) ON DELETE CASCADE
    )
    """)

    # 5. Charging Sessions Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS charging_sessions (
        session_id INTEGER PRIMARY KEY AUTOINCREMENT,
        reservation_id INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        energy_consumed REAL DEFAULT 0.00,
        total_cost REAL DEFAULT 0.00,
        payment_status TEXT DEFAULT 'Completed',
        FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id) ON DELETE CASCADE
    )
    """)

    # 6. Usage History Table (For ML Training & Analytics)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS usage_history (
        record_id INTEGER PRIMARY KEY AUTOINCREMENT,
        station_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        hour INTEGER NOT NULL,
        occupancy INTEGER NOT NULL,
        energy_consumed REAL NOT NULL,
        reservations_count INTEGER NOT NULL,
        temperature_celsius REAL DEFAULT 28.5,
        FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE
    )
    """)

    conn.commit()

    # Check if stations exist; if not, seed realistic data
    cur.execute("SELECT COUNT(*) as count FROM stations")
    count = cur.fetchone()[0]
    if count == 0:
        seed_data(conn)

    conn.close()

def seed_data(conn):
    """Seed comprehensive initial sample data for college demonstration."""
    cur = conn.cursor()

    # Seed Admin & Demo Users with hashed passwords
    pw_admin = generate_password_hash('admin123')
    pw_user = generate_password_hash('user123')

    users = [
        ('Admin Officer', 'admin@evcharge.com', '+91 98765 00001', pw_admin, 'Tesla Model 3', 'AP 05 AB 1001', 'admin', 'active'),
        ('Rahul Verma', 'rahul@example.com', '+91 98765 43210', pw_user, 'Tata Nexon EV', 'AP 05 EV 1234', 'user', 'active'),
        ('Priya Sharma', 'priya@example.com', '+91 98450 12345', pw_user, 'MG ZS EV', 'AP 05 EV 5678', 'user', 'active'),
        ('Anil Kumar', 'anil@example.com', '+91 99887 76655', pw_user, 'Hyundai Kona Electric', 'AP 05 EV 9999', 'user', 'active')
    ]
    cur.executemany("""
        INSERT INTO users (name, email, phone, password, vehicle_type, vehicle_number, role, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, users)

    # Seed 6 Charging Stations
    stations = [
        (1, 'GreenCharge Station', 'Main Beach Road, Near Port Circle', 'Kakinada', 16.989065, 82.247465, '24/7 Open', 1.8, 'Available'),
        (2, 'EcoVolt Charging Hub', 'Cinema Club Road, Ramaraopeta', 'Kakinada', 16.953412, 82.235610, '06:00 AM - 11:30 PM', 2.4, 'Available'),
        (3, 'PowerDrive EV Station', 'Collectorate Junction, Bypass Road', 'Kakinada', 16.965820, 82.221450, '24/7 Open', 3.6, 'Limited'),
        (4, 'ChargePoint Central', 'Smart City IT Tower, Sarpavaram Junction', 'Kakinada', 17.012540, 82.251230, '24/7 Open', 4.2, 'Available'),
        (5, 'VoltWay Station', 'JNTU College Highway Road', 'Kakinada', 16.978120, 82.241020, '05:00 AM - Midnight', 2.9, 'Available'),
        (6, 'FastCharge Hub', 'Industrial Estate Zone, Vakalapudi', 'Kakinada', 17.025680, 82.278910, '24/7 Open', 6.5, 'Full')
    ]
    cur.executemany("""
        INSERT INTO stations (station_id, station_name, address, city, latitude, longitude, operating_hours, distance_km, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, stations)

    # Seed Chargers for all 6 stations
    chargers = [
        # Station 1 (7 chargers)
        (1, 'CH-01', 'DC Fast Charging', '60 kW', 'Available', 12.00),
        (1, 'CH-02', 'DC Fast Charging', '60 kW', 'Occupied', 12.00),
        (1, 'CH-03', 'DC Fast Charging', '60 kW', 'Available', 12.00),
        (1, 'CH-04', 'Rapid Charging', '150 kW', 'Available', 16.50),
        (1, 'CH-05', 'Rapid Charging', '150 kW', 'Available', 16.50),
        (1, 'CH-06', 'AC Charging', '22 kW', 'Occupied', 9.50),
        (1, 'CH-07', 'AC Charging', '22 kW', 'Available', 9.50),
        # Station 2 (5 chargers)
        (2, 'CH-01', 'DC Fast Charging', '50 kW', 'Available', 13.00),
        (2, 'CH-02', 'DC Fast Charging', '50 kW', 'Available', 13.00),
        (2, 'CH-03', 'Rapid Charging', '120 kW', 'Occupied', 17.00),
        (2, 'CH-04', 'AC Charging', '22 kW', 'Available', 10.00),
        (2, 'CH-05', 'AC Charging', '22 kW', 'Maintenance', 10.00),
        # Station 3 (5 chargers)
        (3, 'CH-01', 'DC Fast Charging', '60 kW', 'Occupied', 12.50),
        (3, 'CH-02', 'DC Fast Charging', '60 kW', 'Occupied', 12.50),
        (3, 'CH-03', 'Rapid Charging', '150 kW', 'Available', 18.00),
        (3, 'CH-04', 'AC Charging', '22 kW', 'Occupied', 9.00),
        (3, 'CH-05', 'AC Charging', '22 kW', 'Maintenance', 9.00),
        # Station 4 (6 chargers)
        (4, 'CH-01', 'Rapid Charging', '150 kW', 'Available', 17.50),
        (4, 'CH-02', 'Rapid Charging', '150 kW', 'Available', 17.50),
        (4, 'CH-03', 'DC Fast Charging', '60 kW', 'Available', 13.50),
        (4, 'CH-04', 'DC Fast Charging', '60 kW', 'Occupied', 13.50),
        (4, 'CH-05', 'AC Charging', '22 kW', 'Available', 10.50),
        (4, 'CH-06', 'AC Charging', '22 kW', 'Available', 10.50),
        # Station 5 (4 chargers)
        (5, 'CH-01', 'DC Fast Charging', '50 kW', 'Available', 11.50),
        (5, 'CH-02', 'DC Fast Charging', '50 kW', 'Available', 11.50),
        (5, 'CH-03', 'AC Charging', '22 kW', 'Available', 8.50),
        (5, 'CH-04', 'AC Charging', '22 kW', 'Occupied', 8.50),
        # Station 6 (4 chargers)
        (6, 'CH-01', 'Rapid Charging', '180 kW', 'Occupied', 19.00),
        (6, 'CH-02', 'Rapid Charging', '180 kW', 'Occupied', 19.00),
        (6, 'CH-03', 'DC Fast Charging', '60 kW', 'Occupied', 14.00),
        (6, 'CH-04', 'DC Fast Charging', '60 kW', 'Occupied', 14.00)
    ]
    cur.executemany("""
        INSERT INTO chargers (station_id, charger_code, charger_type, power_rating, status, price_per_kwh)
        VALUES (?, ?, ?, ?, ?, ?)
    """, chargers)

    # Seed Reservations
    reservations = [
        ('EV20260918001', 2, 1, 1, '2026-09-18', '11:00 AM', '12:00 PM', 60, 'Confirmed', 360.00),
        ('EV20260918002', 3, 2, 8, '2026-09-18', '02:00 PM', '03:00 PM', 60, 'Confirmed', 390.00),
        ('EV20260915003', 2, 1, 1, '2026-09-15', '09:00 AM', '10:00 AM', 60, 'Completed', 360.00),
        ('EV20260914004', 4, 3, 14, '2026-09-14', '04:00 PM', '05:00 PM', 60, 'Completed', 270.00),
        ('EV20260912005', 2, 4, 18, '2026-09-12', '06:00 PM', '07:00 PM', 60, 'Cancelled', 405.00)
    ]
    cur.executemany("""
        INSERT INTO reservations (booking_code, user_id, station_id, charger_id, reservation_date, start_time, end_time, duration_minutes, status, estimated_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, reservations)

    # Seed Usage History records (Last 14 days of realistic hourly data for ML & Analytics)
    import random
    history_records = []
    # 24 hours pattern across 6 stations for analytics
    for station_id in range(1, 7):
        for hour in range(24):
            # Realistic peak pattern: High in 8-11 AM and 5-9 PM
            if 8 <= hour <= 11 or 17 <= hour <= 21:
                occupancy = random.randint(3, 6)
                res_count = random.randint(4, 9)
            elif 12 <= hour <= 16:
                occupancy = random.randint(2, 4)
                res_count = random.randint(2, 5)
            else:
                occupancy = random.randint(0, 2)
                res_count = random.randint(0, 2)
            energy = round(occupancy * random.uniform(18.0, 32.0), 2)
            history_records.append((station_id, '2026-09-15', hour, occupancy, energy, res_count, round(random.uniform(27.0, 33.5), 1)))

    cur.executemany("""
        INSERT INTO usage_history (station_id, date, hour, occupancy, energy_consumed, reservations_count, temperature_celsius)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, history_records)

    conn.commit()
    print("[Database] Successfully initialized schema and seeded sample data.")

if __name__ == '__main__':
    init_db()
    print("Database test run complete.")
