"""
Seed Data Script for EV Charging Slot Availability System
Populates initial sample stations, chargers, users, and realistic reservations.
"""

from datetime import datetime, date, timedelta
from database import db, User, Station, Charger, Reservation, UsageHistory

def seed_database():
    print("[*] Checking database seed status...")
    if Station.query.first() is not None:
        print("[+] Database already contains data. Skipping seeding.")
        return

    print("[*] Seeding users...")
    admin_user = User(
        name="System Administrator",
        email="admin@evcharge.com",
        phone="+91 98765 43210",
        vehicle_type="Tesla Model 3",
        vehicle_number="AP-05-EV-0001",
        role="admin",
        status="active"
    )
    admin_user.set_password("admin123")
    db.session.add(admin_user)

    demo_user = User(
        name="Rahul Sharma",
        email="user@evcharge.com",
        phone="+91 91234 56789",
        vehicle_type="Tata Nexon EV Max",
        vehicle_number="AP-05-EV-4421",
        role="user",
        status="active"
    )
    demo_user.set_password("user123")
    db.session.add(demo_user)

    user2 = User(
        name="Priya Varma",
        email="priya@example.com",
        phone="+91 94401 23456",
        vehicle_type="MG ZS EV",
        vehicle_number="AP-05-EV-8899",
        role="user",
        status="active"
    )
    user2.set_password("password123")
    db.session.add(user2)

    db.session.commit()

    print("[*] Seeding charging stations & chargers...")
    stations_data = [
        {
            "name": "GreenCharge Station",
            "address": "Opp. Collectorate, Subhash Road, Kakinada",
            "city": "Kakinada",
            "lat": 16.989063,
            "lon": 82.247465,
            "hours": "24/7 Open & Supported",
            "chargers": [
                {"code": "CH-01", "type": "DC Fast Charging", "power": "60 kW", "status": "Available", "price": 13.50},
                {"code": "CH-02", "type": "DC Fast Charging", "power": "60 kW", "status": "Available", "price": 13.50},
                {"code": "CH-03", "type": "DC Fast Charging", "power": "60 kW", "status": "Available", "price": 13.50},
                {"code": "CH-04", "type": "Rapid Charging", "power": "120 kW", "status": "Occupied", "price": 16.00, "veh": "Hyundai Ioniq 5"},
                {"code": "CH-05", "type": "Rapid Charging", "power": "120 kW", "status": "Available", "price": 16.00},
                {"code": "CH-06", "type": "AC Charging", "power": "22 kW", "status": "Available", "price": 11.00},
                {"code": "CH-07", "type": "AC Charging", "power": "22 kW", "status": "Occupied", "price": 11.00, "veh": "MG Comet EV"},
            ]
        },
        {
            "name": "EcoVolt Charging Hub",
            "address": "Bhanugudi Junction, Near RTO Office, Kakinada",
            "city": "Kakinada",
            "lat": 16.963212,
            "lon": 82.238124,
            "hours": "24/7 Automated Access",
            "chargers": [
                {"code": "EV-01", "type": "DC Fast Charging", "power": "60 kW", "status": "Available", "price": 14.00},
                {"code": "EV-02", "type": "DC Fast Charging", "power": "60 kW", "status": "Occupied", "price": 14.00, "veh": "Tata Tiago EV"},
                {"code": "EV-03", "type": "Rapid Charging", "power": "150 kW", "status": "Available", "price": 17.50},
                {"code": "EV-04", "type": "Rapid Charging", "power": "150 kW", "status": "Available", "price": 17.50},
                {"code": "EV-05", "type": "AC Charging", "power": "22 kW", "status": "Available", "price": 11.50},
                {"code": "EV-06", "type": "AC Charging", "power": "22 kW", "status": "Occupied", "price": 11.50, "veh": "Mahindra XUV400"},
            ]
        },
        {
            "name": "PowerDrive EV Station",
            "address": "Main Road, Jagannaickpur Bridge Circle, Kakinada",
            "city": "Kakinada",
            "lat": 16.945100,
            "lon": 82.231200,
            "hours": "06:00 AM - 11:30 PM",
            "chargers": [
                {"code": "PD-01", "type": "DC Fast Charging", "power": "50 kW", "status": "Available", "price": 13.00},
                {"code": "PD-02", "type": "DC Fast Charging", "power": "50 kW", "status": "Available", "price": 13.00},
                {"code": "PD-03", "type": "DC Fast Charging", "power": "50 kW", "status": "Occupied", "price": 13.00, "veh": "BYD Atto 3"},
                {"code": "PD-04", "type": "AC Charging", "power": "11 kW", "status": "Maintenance", "price": 10.00},
                {"code": "PD-05", "type": "AC Charging", "power": "22 kW", "status": "Available", "price": 11.50},
            ]
        },
        {
            "name": "ChargePoint Central",
            "address": "Highway Bypass Junction, Madhavapatnam, Kakinada",
            "city": "Kakinada",
            "lat": 17.012500,
            "lon": 82.259000,
            "hours": "24/7 Highway Express Hub",
            "chargers": [
                {"code": "CP-01", "type": "Rapid Charging", "power": "150 kW", "status": "Available", "price": 16.50},
                {"code": "CP-02", "type": "Rapid Charging", "power": "150 kW", "status": "Available", "price": 16.50},
                {"code": "CP-03", "type": "DC Fast Charging", "power": "60 kW", "status": "Available", "price": 14.00},
                {"code": "CP-04", "type": "DC Fast Charging", "power": "60 kW", "status": "Available", "price": 14.00},
                {"code": "CP-05", "type": "DC Fast Charging", "power": "60 kW", "status": "Occupied", "price": 14.00, "veh": "Kia EV6"},
                {"code": "CP-06", "type": "DC Fast Charging", "power": "60 kW", "status": "Occupied", "price": 14.00, "veh": "Audi e-tron"},
                {"code": "CP-07", "type": "AC Charging", "power": "22 kW", "status": "Available", "price": 11.00},
                {"code": "CP-08", "type": "AC Charging", "power": "22 kW", "status": "Available", "price": 11.00},
            ]
        },
        {
            "name": "VoltWay Station",
            "address": "Near Port Main Gate, Beach Road, Kakinada",
            "city": "Kakinada",
            "lat": 16.972300,
            "lon": 82.261200,
            "hours": "07:00 AM - 11:00 PM",
            "chargers": [
                {"code": "VW-01", "type": "DC Fast Charging", "power": "60 kW", "status": "Available", "price": 14.00},
                {"code": "VW-02", "type": "DC Fast Charging", "power": "60 kW", "status": "Occupied", "price": 14.00, "veh": "Tata Curvv EV"},
                {"code": "VW-03", "type": "AC Charging", "power": "22 kW", "status": "Occupied", "price": 12.00, "veh": "Ola S1 Pro"},
                {"code": "VW-04", "type": "AC Charging", "power": "22 kW", "status": "Maintenance", "price": 12.00},
            ]
        },
        {
            "name": "FastCharge Hub",
            "address": "ADB Samalkot Road, Near Industrial Corridor, Kakinada",
            "city": "Kakinada",
            "lat": 17.025100,
            "lon": 82.215400,
            "hours": "24/7 Supercharger Hub",
            "chargers": [
                {"code": "FC-01", "type": "Rapid Charging", "power": "180 kW", "status": "Available", "price": 17.00},
                {"code": "FC-02", "type": "Rapid Charging", "power": "180 kW", "status": "Available", "price": 17.00},
                {"code": "FC-03", "type": "DC Fast Charging", "power": "60 kW", "status": "Available", "price": 13.50},
                {"code": "FC-04", "type": "DC Fast Charging", "power": "60 kW", "status": "Available", "price": 13.50},
                {"code": "FC-05", "type": "DC Fast Charging", "power": "60 kW", "status": "Occupied", "price": 13.50, "veh": "Tata Punch EV"},
                {"code": "FC-06", "type": "AC Charging", "power": "22 kW", "status": "Available", "price": 10.50},
            ]
        }
    ]

    created_stations = []
    for s_info in stations_data:
        st = Station(
            station_name=s_info["name"],
            address=s_info["address"],
            city=s_info["city"],
            latitude=s_info["lat"],
            longitude=s_info["lon"],
            operating_hours=s_info["hours"],
            status="Operational"
        )
        db.session.add(st)
        db.session.flush() # populate st.station_id

        for c_info in s_info["chargers"]:
            charger = Charger(
                station_id=st.station_id,
                charger_code=c_info["code"],
                charger_type=c_info["type"],
                power_rating=c_info["power"],
                status=c_info["status"],
                price_per_kwh=c_info["price"],
                current_vehicle=c_info.get("veh", None)
            )
            db.session.add(charger)

        created_stations.append(st)

    db.session.commit()

    print("[*] Seeding realistic sample reservations...")
    today = date.today()
    tomorrow = today + timedelta(days=1)
    yesterday = today - timedelta(days=1)
    last_week = today - timedelta(days=4)

    # 1. Active Upcoming Reservation for demo_user
    res1 = Reservation(
        reservation_id="EV20261103001",
        user_id=demo_user.user_id,
        station_id=created_stations[0].station_id,
        charger_id=created_stations[0].chargers[0].charger_id,
        reservation_date=tomorrow,
        start_time="10:00 AM",
        end_time="11:00 AM",
        vehicle_type=demo_user.vehicle_type,
        vehicle_number=demo_user.vehicle_number,
        status="Confirmed",
        estimated_duration=60,
        estimated_cost=270.00
    )
    db.session.add(res1)

    # 2. Completed reservation
    res2 = Reservation(
        reservation_id="EV20261028045",
        user_id=demo_user.user_id,
        station_id=created_stations[1].station_id,
        charger_id=created_stations[1].chargers[2].charger_id,
        reservation_date=last_week,
        start_time="03:00 PM",
        end_time="03:45 PM",
        vehicle_type=demo_user.vehicle_type,
        vehicle_number=demo_user.vehicle_number,
        status="Completed",
        estimated_duration=45,
        estimated_cost=315.00
    )
    db.session.add(res2)

    # 3. Cancelled reservation
    res3 = Reservation(
        reservation_id="EV20261015012",
        user_id=demo_user.user_id,
        station_id=created_stations[2].station_id,
        charger_id=created_stations[2].chargers[0].charger_id,
        reservation_date=today - timedelta(days=10),
        start_time="08:00 AM",
        end_time="09:00 AM",
        vehicle_type=demo_user.vehicle_type,
        vehicle_number=demo_user.vehicle_number,
        status="Cancelled",
        estimated_duration=60,
        estimated_cost=260.00
    )
    db.session.add(res3)

    # 4. Another user's reservation
    res4 = Reservation(
        reservation_id="EV20261103088",
        user_id=user2.user_id,
        station_id=created_stations[3].station_id,
        charger_id=created_stations[3].chargers[1].charger_id,
        reservation_date=today,
        start_time="04:00 PM",
        end_time="05:00 PM",
        vehicle_type=user2.vehicle_type,
        vehicle_number=user2.vehicle_number,
        status="Confirmed",
        estimated_duration=60,
        estimated_cost=330.00
    )
    db.session.add(res4)

    # Historical usage for analytics
    print("[*] Seeding historical usage data for analytics charts...")
    for day_offset in range(7, 0, -1):
        hist_date = today - timedelta(days=day_offset)
        for h in [6, 9, 12, 15, 18, 21]:
            occ = 30 + (h * 2.5) if h != 18 else 88.0
            usage = UsageHistory(
                station_id=created_stations[0].station_id,
                date=hist_date,
                hour=h,
                occupancy=min(95.0, occ),
                energy_consumed=round(occ * 3.4, 1),
                reservations_count=int(occ / 12)
            )
            db.session.add(usage)

    db.session.commit()
    print("[+] Database successfully initialized and seeded with rich sample data!")

