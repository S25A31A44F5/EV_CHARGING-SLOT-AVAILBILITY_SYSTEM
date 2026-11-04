-- =====================================================================
-- EV CHARGING SLOT AVAILABILITY SYSTEM
-- Database Schema for MySQL 8.x / MariaDB
-- College Mini-Project Implementation
-- =====================================================================

DROP DATABASE IF EXISTS ev_charge_db;
CREATE DATABASE ev_charge_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ev_charge_db;

-- ---------------------------------------------------------------------
-- 1. Table: users
-- Stores registered EV drivers and system administrators
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL,
    vehicle_type VARCHAR(50) DEFAULT 'Electric Sedan',
    vehicle_number VARCHAR(25) DEFAULT 'AP-05-EV-1001',
    role VARCHAR(20) DEFAULT 'user', -- 'user' or 'admin'
    status VARCHAR(20) DEFAULT 'active', -- 'active' or 'disabled'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. Table: stations
-- Stores physical EV charging stations, coordinates, and hours
-- ---------------------------------------------------------------------
CREATE TABLE stations (
    station_id INT AUTO_INCREMENT PRIMARY KEY,
    station_name VARCHAR(150) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(80) DEFAULT 'Kakinada',
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    operating_hours VARCHAR(80) DEFAULT '24/7 Support & Access',
    status VARCHAR(30) DEFAULT 'Operational', -- 'Operational', 'Maintenance'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_station_city (city)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. Table: chargers
-- Specific charging points installed inside each station
-- ---------------------------------------------------------------------
CREATE TABLE chargers (
    charger_id INT AUTO_INCREMENT PRIMARY KEY,
    station_id INT NOT NULL,
    charger_code VARCHAR(20) NOT NULL, -- e.g. 'CH-01', 'CH-02'
    charger_type VARCHAR(50) NOT NULL, -- 'AC Charging', 'DC Fast Charging', 'Rapid Charging'
    power_rating VARCHAR(30) NOT NULL, -- e.g. '22 kW', '60 kW', '150 kW'
    status VARCHAR(30) DEFAULT 'Available', -- 'Available', 'Occupied', 'Maintenance'
    price_per_kwh DECIMAL(6, 2) NOT NULL DEFAULT 14.50,
    current_vehicle VARCHAR(50) DEFAULT NULL,
    FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE,
    INDEX idx_charger_station (station_id),
    INDEX idx_charger_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. Table: reservations
-- Booked charging slots by EV users
-- ---------------------------------------------------------------------
CREATE TABLE reservations (
    reservation_id VARCHAR(35) PRIMARY KEY, -- e.g. 'EV20261103001'
    user_id INT NOT NULL,
    station_id INT NOT NULL,
    charger_id INT NOT NULL,
    reservation_date DATE NOT NULL,
    start_time VARCHAR(10) NOT NULL, -- e.g. '09:00 AM'
    end_time VARCHAR(10) NOT NULL,   -- e.g. '10:00 AM'
    vehicle_type VARCHAR(50) NOT NULL,
    vehicle_number VARCHAR(25) NOT NULL,
    status VARCHAR(30) DEFAULT 'Confirmed', -- 'Confirmed', 'Completed', 'Cancelled'
    estimated_duration INT DEFAULT 60, -- duration in minutes
    estimated_cost DECIMAL(8, 2) NOT NULL DEFAULT 250.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE,
    FOREIGN KEY (charger_id) REFERENCES chargers(charger_id) ON DELETE CASCADE,
    INDEX idx_res_date (reservation_date),
    INDEX idx_res_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. Table: charging_sessions
-- Live telemetry telemetry & telemetry billing records
-- ---------------------------------------------------------------------
CREATE TABLE charging_sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id VARCHAR(35) NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME DEFAULT NULL,
    energy_consumed DECIMAL(6, 2) DEFAULT 0.00, -- in kWh
    total_cost DECIMAL(8, 2) DEFAULT 0.00,
    FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. Table: usage_history
-- Historical aggregate records used by Scikit-Learn Demand Prediction ML
-- ---------------------------------------------------------------------
CREATE TABLE usage_history (
    record_id INT AUTO_INCREMENT PRIMARY KEY,
    station_id INT NOT NULL,
    date DATE NOT NULL,
    hour INT NOT NULL, -- 0 to 23
    occupancy DECIMAL(5, 2) NOT NULL, -- Percentage (e.g. 85.50%)
    energy_consumed DECIMAL(8, 2) NOT NULL, -- Total kWh consumed during the hour
    reservations_count INT NOT NULL DEFAULT 0,
    FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE,
    INDEX idx_history_date (date),
    INDEX idx_history_hour (hour)
) ENGINE=InnoDB;

-- =====================================================================
-- End of Schema Definition
-- =====================================================================

