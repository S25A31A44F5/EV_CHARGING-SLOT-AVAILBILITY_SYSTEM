from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    user_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(20), nullable=False)
    password = db.Column(db.String(255), nullable=False)
    vehicle_type = db.Column(db.String(50), default='Electric Sedan')
    vehicle_number = db.Column(db.String(25), default='AP-05-EV-1001')
    role = db.Column(db.String(20), default='user')  # 'user' or 'admin'
    status = db.Column(db.String(20), default='active')  # 'active' or 'disabled'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    reservations = db.relationship('Reservation', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, raw_password):
        self.password = generate_password_hash(raw_password)

    def check_password(self, raw_password):
        return check_password_hash(self.password, raw_password)

    def to_dict(self):
        return {
            'user_id': self.user_id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'vehicle_type': self.vehicle_type,
            'vehicle_number': self.vehicle_number,
            'role': self.role,
            'status': self.status,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else ''
        }


class Station(db.Model):
    __tablename__ = 'stations'

    station_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    station_name = db.Column(db.String(150), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    city = db.Column(db.String(80), default='Kakinada')
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    operating_hours = db.Column(db.String(80), default='24/7 Support & Access')
    status = db.Column(db.String(30), default='Operational')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    chargers = db.relationship('Charger', backref='station', lazy=True, cascade='all, delete-orphan')
    reservations = db.relationship('Reservation', backref='station', lazy=True, cascade='all, delete-orphan')
    usage_records = db.relationship('UsageHistory', backref='station', lazy=True, cascade='all, delete-orphan')

    @property
    def total_chargers(self):
        return len(self.chargers)

    @property
    def available_chargers(self):
        return sum(1 for c in self.chargers if c.status == 'Available')

    @property
    def occupied_chargers(self):
        return sum(1 for c in self.chargers if c.status == 'Occupied')

    @property
    def maintenance_chargers(self):
        return sum(1 for c in self.chargers if c.status == 'Maintenance')

    @property
    def occupancy_rate(self):
        if not self.chargers:
            return 0
        return round((self.occupied_chargers / len(self.chargers)) * 100, 1)

    @property
    def waiting_time(self):
        # Dynamic calculation of waiting time in minutes
        total = self.total_chargers
        avail = self.available_chargers
        if total == 0:
            return 0
        if avail >= 2:
            return 0
        elif avail == 1:
            return 5
        elif avail == 0:
            return 25
        return 0

    @property
    def estimated_charge_time(self):
        # Average estimated charge time across chargers
        has_rapid = any('Rapid' in c.charger_type for c in self.chargers)
        has_dc = any('DC' in c.charger_type for c in self.chargers)
        if has_rapid:
            return "25-35 min"
        elif has_dc:
            return "35-45 min"
        return "60-90 min"

    @property
    def availability_badge(self):
        avail = self.available_chargers
        total = self.total_chargers
        if total == 0 or avail == 0:
            return {'text': 'Full', 'class': 'badge-danger', 'color': '#EF4444'}
        elif avail <= 2 or (avail / total) < 0.35:
            return {'text': 'Limited', 'class': 'badge-warning', 'color': '#F59E0B'}
        else:
            return {'text': 'Available', 'class': 'badge-success', 'color': '#10B981'}

    @property
    def primary_charging_type(self):
        types = [c.charger_type for c in self.chargers]
        if any('Rapid' in t for t in types):
            return 'Rapid Charging'
        if any('DC' in t for t in types):
            return 'DC Fast Charging'
        return 'AC Charging'

    @property
    def min_price(self):
        if not self.chargers:
            return 12.0
        return min(c.price_per_kwh for c in self.chargers)

    def to_dict(self, distance=None):
        return {
            'station_id': self.station_id,
            'station_name': self.station_name,
            'address': self.address,
            'city': self.city,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'operating_hours': self.operating_hours,
            'status': self.status,
            'total_chargers': self.total_chargers,
            'available_chargers': self.available_chargers,
            'occupied_chargers': self.occupied_chargers,
            'maintenance_chargers': self.maintenance_chargers,
            'occupancy_rate': self.occupancy_rate,
            'waiting_time': self.waiting_time,
            'estimated_charge_time': self.estimated_charge_time,
            'primary_charging_type': self.primary_charging_type,
            'min_price': float(self.min_price),
            'availability_badge': self.availability_badge,
            'distance': distance or 2.5
        }


class Charger(db.Model):
    __tablename__ = 'chargers'

    charger_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    station_id = db.Column(db.Integer, db.ForeignKey('stations.station_id', ondelete='CASCADE'), nullable=False)
    charger_code = db.Column(db.String(20), nullable=False)  # e.g., 'CH-01'
    charger_type = db.Column(db.String(50), nullable=False)  # 'AC Charging', 'DC Fast Charging', 'Rapid Charging'
    power_rating = db.Column(db.String(30), nullable=False)  # '22 kW', '60 kW', '150 kW'
    status = db.Column(db.String(30), default='Available')  # 'Available', 'Occupied', 'Maintenance'
    price_per_kwh = db.Column(db.Float, default=14.50)
    current_vehicle = db.Column(db.String(50), nullable=True)

    reservations = db.relationship('Reservation', backref='charger', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'charger_id': self.charger_id,
            'station_id': self.station_id,
            'charger_code': self.charger_code,
            'charger_type': self.charger_type,
            'power_rating': self.power_rating,
            'status': self.status,
            'price_per_kwh': float(self.price_per_kwh),
            'current_vehicle': self.current_vehicle or 'None'
        }


class Reservation(db.Model):
    __tablename__ = 'reservations'

    reservation_id = db.Column(db.String(35), primary_key=True)  # 'EV20261103001'
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    station_id = db.Column(db.Integer, db.ForeignKey('stations.station_id', ondelete='CASCADE'), nullable=False)
    charger_id = db.Column(db.Integer, db.ForeignKey('chargers.charger_id', ondelete='CASCADE'), nullable=False)
    reservation_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.String(10), nullable=False)  # e.g. '09:00 AM'
    end_time = db.Column(db.String(10), nullable=False)    # e.g. '10:00 AM'
    vehicle_type = db.Column(db.String(50), default='Electric Car')
    vehicle_number = db.Column(db.String(25), default='AP-05-EV-1001')
    status = db.Column(db.String(30), default='Confirmed')  # 'Confirmed', 'Completed', 'Cancelled'
    estimated_duration = db.Column(db.Integer, default=60)  # minutes
    estimated_cost = db.Column(db.Float, default=250.00)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    session = db.relationship('ChargingSession', backref='reservation', uselist=False, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'reservation_id': self.reservation_id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else 'User',
            'user_email': self.user.email if self.user else '',
            'station_id': self.station_id,
            'station_name': self.station.station_name if self.station else 'Unknown Station',
            'station_address': self.station.address if self.station else '',
            'charger_id': self.charger_id,
            'charger_code': self.charger.charger_code if self.charger else 'CH-01',
            'charger_type': self.charger.charger_type if self.charger else 'DC Fast Charging',
            'power_rating': self.charger.power_rating if self.charger else '60 kW',
            'reservation_date': self.reservation_date.strftime('%Y-%m-%d') if self.reservation_date else '',
            'start_time': self.start_time,
            'end_time': self.end_time,
            'vehicle_type': self.vehicle_type,
            'vehicle_number': self.vehicle_number,
            'status': self.status,
            'estimated_duration': self.estimated_duration,
            'estimated_cost': float(self.estimated_cost),
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else ''
        }


class ChargingSession(db.Model):
    __tablename__ = 'charging_sessions'

    session_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    reservation_id = db.Column(db.String(35), db.ForeignKey('reservations.reservation_id', ondelete='CASCADE'), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    energy_consumed = db.Column(db.Float, default=0.0)  # in kWh
    total_cost = db.Column(db.Float, default=0.0)


class UsageHistory(db.Model):
    __tablename__ = 'usage_history'

    record_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    station_id = db.Column(db.Integer, db.ForeignKey('stations.station_id', ondelete='CASCADE'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    hour = db.Column(db.Integer, nullable=False)  # 0 to 23
    occupancy = db.Column(db.Float, nullable=False)  # % e.g. 75.0
    energy_consumed = db.Column(db.Float, nullable=False)  # kWh
    reservations_count = db.Column(db.Integer, default=0)

