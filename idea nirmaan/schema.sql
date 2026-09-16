-- ==========================================================
-- EV Charging Slot Availability System
-- College Engineering Mini-Project Database Schema
-- Compatible with MySQL 8.0+ and MariaDB
-- ==========================================================

DROP DATABASE IF EXISTS ev_charging_db;
CREATE DATABASE IF NOT EXISTS ev_charging_db;
USE ev_charging_db;

-- ----------------------------------------------------------
-- 1. USERS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    vehicle_number VARCHAR(30) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    status ENUM('active', 'disabled') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------
-- 2. STATIONS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS stations (
    station_id INT AUTO_INCREMENT PRIMARY KEY,
    station_name VARCHAR(150) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(80) DEFAULT 'Kakinada',
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    operating_hours VARCHAR(100) DEFAULT '24/7 Open',
    distance_km DECIMAL(4, 1) DEFAULT 2.5,
    status ENUM('Available', 'Limited', 'Full', 'Maintenance') DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------
-- 3. CHARGERS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS chargers (
    charger_id INT AUTO_INCREMENT PRIMARY KEY,
    station_id INT NOT NULL,
    charger_code VARCHAR(20) NOT NULL,
    charger_type ENUM('AC Charging', 'DC Fast Charging', 'Rapid Charging') NOT NULL,
    power_rating VARCHAR(30) NOT NULL, -- e.g. '22 kW', '60 kW', '150 kW'
    status ENUM('Available', 'Occupied', 'Maintenance') DEFAULT 'Available',
    price_per_kwh DECIMAL(6, 2) NOT NULL DEFAULT 12.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------
-- 4. RESERVATIONS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_code VARCHAR(40) NOT NULL UNIQUE, -- e.g. EV20260918001
    user_id INT NOT NULL,
    station_id INT NOT NULL,
    charger_id INT NOT NULL,
    reservation_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 60,
    status ENUM('Confirmed', 'Completed', 'Cancelled') DEFAULT 'Confirmed',
    estimated_cost DECIMAL(8, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE,
    FOREIGN KEY (charger_id) REFERENCES chargers(charger_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------
-- 5. CHARGING SESSIONS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS charging_sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    energy_consumed DECIMAL(6, 2) DEFAULT 0.00, -- in kWh
    total_cost DECIMAL(8, 2) DEFAULT 0.00,
    payment_status ENUM('Pending', 'Completed', 'Waived') DEFAULT 'Completed',
    FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------
-- 6. USAGE HISTORY TABLE (FOR ML & ANALYTICS)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_history (
    record_id INT AUTO_INCREMENT PRIMARY KEY,
    station_id INT NOT NULL,
    date DATE NOT NULL,
    hour INT NOT NULL, -- 0 to 23
    occupancy INT NOT NULL, -- number of occupied chargers
    energy_consumed DECIMAL(8, 2) NOT NULL,
    reservations_count INT NOT NULL,
    temperature_celsius DECIMAL(4, 1) DEFAULT 28.5,
    FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================================
-- REALISTIC SAMPLE DATA INSERTIONS
-- ==========================================================

-- Seed Users (Default admin and demo drivers)
INSERT INTO users (name, email, phone, password, vehicle_type, vehicle_number, role) VALUES
('Admin Officer', 'admin@evcharge.com', '+91 98765 00001', 'pbkdf2:sha256:admin123', 'Tesla Model 3', 'AP 05 AB 1001', 'admin'),
('Rahul Verma', 'rahul@example.com', '+91 98765 43210', 'pbkdf2:sha256:user123', 'Tata Nexon EV', 'AP 05 EV 1234', 'user'),
('Priya Sharma', 'priya@example.com', '+91 98450 12345', 'pbkdf2:sha256:user123', 'MG ZS EV', 'AP 05 EV 5678', 'user'),
('Anil Kumar', 'anil@example.com', '+91 99887 76655', 'pbkdf2:sha256:user123', 'Hyundai Kona Electric', 'AP 05 EV 9999', 'user');

-- Seed Stations (At least 6 Stations around Kakinada / Smart City corridor)
INSERT INTO stations (station_id, station_name, address, city, latitude, longitude, operating_hours, distance_km, status) VALUES
(1, 'GreenCharge Station', 'Main Beach Road, Near Port Circle', 'Kakinada', 16.989065, 82.247465, '24/7 Open', 1.8, 'Available'),
(2, 'EcoVolt Charging Hub', 'Cinema Club Road, Ramaraopeta', 'Kakinada', 16.953412, 82.235610, '06:00 AM - 11:30 PM', 2.4, 'Available'),
(3, 'PowerDrive EV Station', 'Collectorate Junction, Bypass Road', 'Kakinada', 16.965820, 82.221450, '24/7 Open', 3.6, 'Limited'),
(4, 'ChargePoint Central', 'Smart City IT Tower, Sarpavaram Junction', 'Kakinada', 17.012540, 82.251230, '24/7 Open', 4.2, 'Available'),
(5, 'VoltWay Station', 'JNTU College Highway Road', 'Kakinada', 16.978120, 82.241020, '05:00 AM - Midnight', 2.9, 'Available'),
(6, 'FastCharge Hub', 'Industrial Estate Zone, Vakalapudi', 'Kakinada', 17.025680, 82.278910, '24/7 Open', 6.5, 'Full');

-- Seed Chargers for Station 1 (GreenCharge Station - 7 chargers)
INSERT INTO chargers (station_id, charger_code, charger_type, power_rating, status, price_per_kwh) VALUES
(1, 'CH-01', 'DC Fast Charging', '60 kW', 'Available', 12.00),
(1, 'CH-02', 'DC Fast Charging', '60 kW', 'Occupied', 12.00),
(1, 'CH-03', 'DC Fast Charging', '60 kW', 'Available', 12.00),
(1, 'CH-04', 'Rapid Charging', '150 kW', 'Available', 16.50),
(1, 'CH-05', 'Rapid Charging', '150 kW', 'Available', 16.50),
(1, 'CH-06', 'AC Charging', '22 kW', 'Occupied', 9.50),
(1, 'CH-07', 'AC Charging', '22 kW', 'Available', 9.50);

-- Seed Chargers for Station 2 (EcoVolt Charging Hub - 5 chargers)
INSERT INTO chargers (station_id, charger_code, charger_type, power_rating, status, price_per_kwh) VALUES
(2, 'CH-01', 'DC Fast Charging', '50 kW', 'Available', 13.00),
(2, 'CH-02', 'DC Fast Charging', '50 kW', 'Available', 13.00),
(2, 'CH-03', 'Rapid Charging', '120 kW', 'Occupied', 17.00),
(2, 'CH-04', 'AC Charging', '22 kW', 'Available', 10.00),
(2, 'CH-05', 'AC Charging', '22 kW', 'Maintenance', 10.00);

-- Seed Chargers for Station 3 (PowerDrive EV Station - 5 chargers)
INSERT INTO chargers (station_id, charger_code, charger_type, power_rating, status, price_per_kwh) VALUES
(3, 'CH-01', 'DC Fast Charging', '60 kW', 'Occupied', 12.50),
(3, 'CH-02', 'DC Fast Charging', '60 kW', 'Occupied', 12.50),
(3, 'CH-03', 'Rapid Charging', '150 kW', 'Available', 18.00),
(3, 'CH-04', 'AC Charging', '22 kW', 'Occupied', 9.00),
(3, 'CH-05', 'AC Charging', '22 kW', 'Maintenance', 9.00);

-- Seed Chargers for Station 4 (ChargePoint Central - 6 chargers)
INSERT INTO chargers (station_id, charger_code, charger_type, power_rating, status, price_per_kwh) VALUES
(4, 'CH-01', 'Rapid Charging', '150 kW', 'Available', 17.50),
(4, 'CH-02', 'Rapid Charging', '150 kW', 'Available', 17.50),
(4, 'CH-03', 'DC Fast Charging', '60 kW', 'Available', 13.50),
(4, 'CH-04', 'DC Fast Charging', '60 kW', 'Occupied', 13.50),
(4, 'CH-05', 'AC Charging', '22 kW', 'Available', 10.50),
(4, 'CH-06', 'AC Charging', '22 kW', 'Available', 10.50);

-- Seed Chargers for Station 5 (VoltWay Station - 4 chargers)
INSERT INTO chargers (station_id, charger_code, charger_type, power_rating, status, price_per_kwh) VALUES
(5, 'CH-01', 'DC Fast Charging', '50 kW', 'Available', 11.50),
(5, 'CH-02', 'DC Fast Charging', '50 kW', 'Available', 11.50),
(5, 'CH-03', 'AC Charging', '22 kW', 'Available', 8.50),
(5, 'CH-04', 'AC Charging', '22 kW', 'Occupied', 8.50);

-- Seed Chargers for Station 6 (FastCharge Hub - 4 chargers)
INSERT INTO chargers (station_id, charger_code, charger_type, power_rating, status, price_per_kwh) VALUES
(6, 'CH-01', 'Rapid Charging', '180 kW', 'Occupied', 19.00),
(6, 'CH-02', 'Rapid Charging', '180 kW', 'Occupied', 19.00),
(6, 'CH-03', 'DC Fast Charging', '60 kW', 'Occupied', 14.00),
(6, 'CH-04', 'DC Fast Charging', '60 kW', 'Occupied', 14.00);

-- Seed Initial Reservations
INSERT INTO reservations (booking_code, user_id, station_id, charger_id, reservation_date, start_time, end_time, duration_minutes, status, estimated_cost) VALUES
('EV20260918001', 2, 1, 1, '2026-09-18', '11:00:00', '12:00:00', 60, 'Confirmed', 360.00),
('EV20260918002', 3, 2, 8, '2026-09-18', '14:00:00', '15:00:00', 60, 'Confirmed', 390.00),
('EV20260915003', 2, 1, 1, '2026-09-15', '09:00:00', '10:00:00', 60, 'Completed', 360.00),
('EV20260914004', 4, 3, 14, '2026-09-14', '16:00:00', '17:00:00', 60, 'Completed', 270.00),
('EV20260912005', 2, 4, 18, '2026-09-12', '18:00:00', '19:00:00', 60, 'Cancelled', 405.00);
