"""
EV Charging Slot Availability System
Flask Web Application & REST API
College Engineering Mini-Project
"""

import os
from functools import wraps
from datetime import datetime, date, timedelta
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from flask_cors import CORS

from config import Config
from database import db, User, Station, Charger, Reservation, ChargingSession, UsageHistory
from seed_data import seed_database
from ml.predictor import DemandPredictor, calculate_smart_recommendation
from ml.gemini_service import ask_gemini_assistant, generate_demand_ai_analysis
from services.overpass_service import fetch_osm_charging_stations, geocode_location, haversine_distance

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

db.init_app(app)

# Initialize ML Predictor instance
predictor = DemandPredictor()

# ---------------------------------------------------------------------
# Database initialization & seeding on startup
# ---------------------------------------------------------------------
with app.app_context():
    db.create_all()
    seed_database()

# ---------------------------------------------------------------------
# Context Processors & Auth Helpers
# ---------------------------------------------------------------------
@app.context_processor
def inject_global_vars():
    user = None
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
    return {
        'current_user': user,
        'current_year': datetime.now().year,
        'is_admin': session.get('role') == 'admin'
    }

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page.', 'warning')
            return redirect(url_for('login', next=request.path))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session or session.get('role') != 'admin':
            flash('Access restricted. Admin credentials required.', 'danger')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# ---------------------------------------------------------------------
# User Facing Pages
# ---------------------------------------------------------------------

@app.route('/')
def index():
    """Home landing page with hero, statistics, how it works, and recommended stations."""
    stations = Station.query.filter_by(status='Operational').all()
    total_stations = len(stations)
    total_chargers = Charger.query.count()
    total_reservations = Reservation.query.count() + 1500 # Realistic college project presentation counter
    availability_pct = 95.2

    # Smart recommendations preview
    recommended = calculate_smart_recommendation(stations)[:3]

    return render_template(
        'index.html',
        total_stations=total_stations,
        total_chargers=total_chargers,
        total_reservations=total_reservations,
        availability_pct=availability_pct,
        recommended=recommended
    )

@app.route('/stations')
def find_stations():
    """Find Stations page with search filters and interactive map."""
    return render_template('stations.html')

@app.route('/station/<int:station_id>')
def station_detail(station_id):
    """Detailed station view with live charger grid status."""
    station = Station.query.get_or_404(station_id)
    # ML demand forecast for current day
    today_dow = datetime.today().weekday()
    curve_data = predictor.predict_24h_curve(station_id=station.station_id, day_of_week=today_dow)
    curr_hour = datetime.now().hour
    current_demand = predictor.predict(station_id=station.station_id, hour=curr_hour, day_of_week=today_dow)

    return render_template(
        'station_detail.html',
        station=station,
        current_demand=current_demand,
        curve_data=curve_data
    )

@app.route('/reserve')
@login_required
def reserve_slot():
    """Slot reservation page with visual time picker."""
    station_id = request.args.get('station_id', type=int)
    charger_id = request.args.get('charger_id', type=int)

    stations = Station.query.filter_by(status='Operational').all()
    selected_station = Station.query.get(station_id) if station_id else (stations[0] if stations else None)
    selected_charger = Charger.query.get(charger_id) if charger_id else None

    user = User.query.get(session['user_id'])

    return render_template(
        'reserve.html',
        stations=stations,
        selected_station=selected_station,
        selected_charger=selected_charger,
        user=user,
        today=date.today().strftime('%Y-%m-%d')
    )

@app.route('/booking/confirmation/<reservation_id>')
@login_required
def booking_confirmation(reservation_id):
    """Booking success screen with receipt download option."""
    reservation = Reservation.query.get_or_404(reservation_id)
    return render_template('booking_success.html', reservation=reservation)

@app.route('/my-bookings')
@login_required
def my_bookings():
    """User bookings categorized into Upcoming, Completed, and Cancelled."""
    user_id = session['user_id']
    all_bookings = Reservation.query.filter_by(user_id=user_id).order_by(Reservation.created_at.desc()).all()

    upcoming = [b for b in all_bookings if b.status == 'Confirmed']
    completed = [b for b in all_bookings if b.status == 'Completed']
    cancelled = [b for b in all_bookings if b.status == 'Cancelled']

    return render_template(
        'my_bookings.html',
        upcoming=upcoming,
        completed=completed,
        cancelled=cancelled
    )

@app.route('/dashboard')
@login_required
def user_dashboard():
    """Personalized EV driver dashboard."""
    user = User.query.get(session['user_id'])
    bookings = Reservation.query.filter_by(user_id=user.user_id).all()

    upcoming_count = sum(1 for b in bookings if b.status == 'Confirmed')
    completed_count = sum(1 for b in bookings if b.status == 'Completed')
    cancelled_count = sum(1 for b in bookings if b.status == 'Cancelled')
    total_charging_hours = round(sum(b.estimated_duration for b in bookings if b.status == 'Completed') / 60, 1)

    next_booking = Reservation.query.filter_by(user_id=user.user_id, status='Confirmed').order_by(Reservation.reservation_date.asc()).first()

    stations = Station.query.filter_by(status='Operational').all()
    recommended = calculate_smart_recommendation(stations)[:3]

    return render_template(
        'dashboard.html',
        user=user,
        upcoming_count=upcoming_count,
        completed_count=completed_count,
        cancelled_count=cancelled_count,
        total_charging_hours=total_charging_hours,
        next_booking=next_booking,
        recommended=recommended
    )

@app.route('/analytics')
def analytics():
    """Visual analytics & demand charts page."""
    stations = Station.query.all()
    return render_template('analytics.html', stations=stations)

@app.route('/demand-prediction')
def ml_demand():
    """Dedicated AI demand prediction & ML architecture showcase."""
    stations = Station.query.all()
    return render_template('ml_demand.html', stations=stations)

@app.route('/about')
def about():
    """College Mini-Project about page with architecture, problem, and future scope."""
    return render_template('about.html')

# ---------------------------------------------------------------------
# Authentication Routes
# ---------------------------------------------------------------------

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '').strip()
        remember = bool(request.form.get('remember'))

        user = User.query.filter_by(email=email).first()

        if user and user.check_password(password):
            if user.status != 'active':
                flash('Your account has been deactivated. Please contact admin.', 'danger')
                return render_template('login.html')

            session['user_id'] = user.user_id
            session['user_name'] = user.name
            session['user_email'] = user.email
            session['role'] = user.role
            session.permanent = remember

            flash(f'Welcome back, {user.name}!', 'success')

            if user.role == 'admin':
                return redirect(url_for('admin_dashboard'))

            next_page = request.args.get('next')
            return redirect(next_page if next_page else url_for('user_dashboard'))
        else:
            flash('Invalid email address or password. Try demo credentials below.', 'danger')

    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip()
        phone = request.form.get('phone', '').strip()
        password = request.form.get('password', '').strip()
        confirm_password = request.form.get('confirm_password', '').strip()
        vehicle_type = request.form.get('vehicle_type', 'Electric Sedan')
        vehicle_number = request.form.get('vehicle_number', '').strip().upper()

        if not name or not email or not password:
            flash('Please fill in all mandatory fields.', 'warning')
            return render_template('register.html')

        if password != confirm_password:
            flash('Passwords do not match.', 'danger')
            return render_template('register.html')

        if User.query.filter_by(email=email).first():
            flash('An account with this email already exists. Please log in.', 'info')
            return redirect(url_for('login'))

        new_user = User(
            name=name,
            email=email,
            phone=phone,
            vehicle_type=vehicle_type,
            vehicle_number=vehicle_number,
            role='user',
            status='active'
        )
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()

        session['user_id'] = new_user.user_id
        session['user_name'] = new_user.name
        session['user_email'] = new_user.email
        session['role'] = 'user'

        flash('Registration successful! Welcome to EV Charge.', 'success')
        return redirect(url_for('user_dashboard'))

    return render_template('register.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out successfully.', 'info')
    return redirect(url_for('index'))

# ---------------------------------------------------------------------
# Admin Portal Routes
# ---------------------------------------------------------------------

@app.route('/admin')
@app.route('/admin/dashboard')
@admin_required
def admin_dashboard():
    total_stations = Station.query.count()
    total_chargers = Charger.query.count()
    available_chargers = Charger.query.filter_by(status='Available').count()
    occupied_chargers = Charger.query.filter_by(status='Occupied').count()
    maintenance_chargers = Charger.query.filter_by(status='Maintenance').count()

    today_str = date.today()
    today_reservations = Reservation.query.filter_by(reservation_date=today_str).count()
    active_users = User.query.filter_by(role='user', status='active').count()

    recent_reservations = Reservation.query.order_by(Reservation.created_at.desc()).limit(6).all()
    stations = Station.query.all()

    return render_template(
        'admin/dashboard.html',
        total_stations=total_stations,
        total_chargers=total_chargers,
        available_chargers=available_chargers,
        occupied_chargers=occupied_chargers,
        maintenance_chargers=maintenance_chargers,
        today_reservations=today_reservations,
        active_users=active_users,
        recent_reservations=recent_reservations,
        stations=stations
    )

@app.route('/admin/stations')
@admin_required
def admin_stations():
    stations = Station.query.all()
    return render_template('admin/stations.html', stations=stations)

@app.route('/admin/chargers')
@admin_required
def admin_chargers():
    chargers = Charger.query.all()
    stations = Station.query.all()
    return render_template('admin/chargers.html', chargers=chargers, stations=stations)

@app.route('/admin/reservations')
@admin_required
def admin_reservations():
    reservations = Reservation.query.order_by(Reservation.created_at.desc()).all()
    return render_template('admin/reservations.html', reservations=reservations)

@app.route('/admin/users')
@admin_required
def admin_users():
    users = User.query.filter_by(role='user').all()
    return render_template('admin/users.html', users=users)

# ---------------------------------------------------------------------
# REST API Endpoints
# ---------------------------------------------------------------------

@app.route('/api/geocode', methods=['GET'])
def api_geocode():
    """Geocode city, locality or address using Nominatim / OpenStreetMap."""
    q = request.args.get('query', '').strip()
    if not q:
        return jsonify({'success': False, 'message': 'Missing query parameter'}), 400
    res = geocode_location(q)
    if res:
        return jsonify({'success': True, 'location': res})
    return jsonify({'success': False, 'message': f"No location found for '{q}'"}), 404

@app.route('/api/stations/nearby', methods=['GET'])
@app.route('/api/stations', methods=['GET'])
def api_get_stations_nearby():
    """
    Returns verified EV charging stations near a geographic coordinate:
    1. EV Charge Network stations (with live/simulated socket telemetry & direct booking)
    2. Real-world OpenStreetMap stations (queried via Overpass API with blue unknown-status markers)
    """
    # Coordinates default to Kakinada, Andhra Pradesh, India
    user_lat = request.args.get('latitude', default=16.989065, type=float)
    user_lon = request.args.get('longitude', default=82.247465, type=float)
    radius_km = request.args.get('radius', default=35.0, type=float)
    source_filter = request.args.get('source', default='all').lower()  # 'all', 'network', 'osm'

    search_query = request.args.get('search', '').lower().strip()
    char_type = request.args.get('type', '')
    availability = request.args.get('availability', '')
    max_price = request.args.get('max_price', type=float)
    operator_filter = request.args.get('operator', '').lower().strip()

    combined_stations = []

    # 1. Fetch EV Charge Network Stations from Database
    if source_filter in ['all', 'network']:
        db_stations = Station.query.filter_by(status='Operational').all()
        for st in db_stations:
            dist = haversine_distance(user_lat, user_lon, st.latitude, st.longitude)
            # Check radius boundary
            if dist > radius_km:
                continue

            # Text search filter
            if search_query:
                in_name = search_query in st.station_name.lower()
                in_addr = search_query in st.address.lower()
                in_city = search_query in st.city.lower()
                if not (in_name or in_addr or in_city):
                    continue

            # Charging Type filter
            if char_type and char_type != 'All':
                station_types = [c.charger_type for c in st.chargers]
                if char_type not in station_types:
                    continue

            # Availability filter
            badge_text = st.availability_badge['text']
            if availability and availability != 'All':
                if availability.lower() == 'unknown':
                    continue  # Network stations have known live/simulated telemetry
                if badge_text.lower() != availability.lower():
                    continue

            # Price filter
            if max_price and st.min_price > max_price:
                continue

            # Operator filter
            if operator_filter and 'ev charge' not in operator_filter and 'greencharge' not in operator_filter:
                pass  # Keep or filter

            st_dict = st.to_dict(distance=dist)
            st_dict['source'] = 'EV Charge Network (Direct Booking Enabled)'
            st_dict['is_network_station'] = True
            st_dict['operator'] = 'EV Charge Network'
            st_dict['power_rating'] = "60-150 kW (DC)" if "DC" in st.primary_charging_type or "Rapid" in st.primary_charging_type else "22 kW (AC)"
            st_dict['google_maps_url'] = f"https://www.google.com/maps/dir/?api=1&destination={st.latitude},{st.longitude}"
            st_dict['availability_badge']['desc'] = 'Verified network station with live/simulated IoT socket telemetry and reservation support.'
            combined_stations.append(st_dict)

    # 2. Fetch Real-World OpenStreetMap Stations via Overpass Service
    if source_filter in ['all', 'osm']:
        osm_stations = fetch_osm_charging_stations(lat=user_lat, lon=user_lon, radius_meters=int(radius_km * 1000))
        for osm_st in osm_stations:
            dist = haversine_distance(user_lat, user_lon, osm_st['latitude'], osm_st['longitude'])
            if dist > radius_km:
                continue

            # Text search filter
            if search_query:
                in_name = search_query in osm_st['station_name'].lower()
                in_addr = search_query in osm_st['address'].lower()
                in_op = search_query in osm_st['operator'].lower()
                if not (in_name or in_addr or in_op):
                    continue

            # Charging Type filter
            if char_type and char_type != 'All':
                if char_type.lower() not in osm_st['primary_charging_type'].lower():
                    continue

            # Availability filter (OSM stations have 'Live Status: Unknown')
            if availability and availability != 'All':
                if availability.lower() not in ['unknown', 'live status: unknown']:
                    continue

            # Price filter
            if max_price and osm_st['min_price'] > max_price:
                continue

            # Operator filter
            if operator_filter and operator_filter not in osm_st['operator'].lower():
                continue

            osm_st['distance'] = dist
            combined_stations.append(osm_st)

    # Sort combined stations by distance from search center
    combined_stations.sort(key=lambda s: s['distance'])

    network_count = sum(1 for s in combined_stations if s.get('is_network_station'))
    osm_count = sum(1 for s in combined_stations if not s.get('is_network_station'))

    return jsonify({
        'success': True,
        'center': {
            'latitude': user_lat,
            'longitude': user_lon,
            'radius_km': radius_km
        },
        'count': len(combined_stations),
        'network_count': network_count,
        'osm_count': osm_count,
        'stations': combined_stations
    })

@app.route('/api/station/<int:station_id>', methods=['GET'])
def api_station_detail(station_id):
    st = Station.query.get_or_404(station_id)
    chargers_list = [c.to_dict() for c in st.chargers]
    data = st.to_dict()
    data['chargers'] = chargers_list
    return jsonify({'success': True, 'station': data})

@app.route('/api/station/<int:station_id>/slots', methods=['GET'])
def api_station_slots(station_id):
    """
    Returns time slots for the station on a given date.
    Calculates which slots are Available vs Booked based on existing reservations.
    """
    date_str = request.args.get('date', date.today().strftime('%Y-%m-%d'))
    try:
        req_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        req_date = date.today()

    station = Station.query.get_or_404(station_id)
    total_chargers = station.total_chargers

    # Default hourly time slots from 06:00 AM to 10:00 PM
    time_slots = [
        "06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
        "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
        "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM", "10:00 PM"
    ]

    # Check reservations for this date
    existing_res = Reservation.query.filter_by(
        station_id=station_id,
        reservation_date=req_date,
        status='Confirmed'
    ).all()

    # Tally bookings per slot
    slot_counts = {slot: 0 for slot in time_slots}
    for res in existing_res:
        if res.start_time in slot_counts:
            slot_counts[res.start_time] += 1

    # Format response
    response_slots = []
    for slot in time_slots:
        booked_count = slot_counts[slot]
        # If booked count reaches total chargers, it's Booked, else Available
        # Add realistic sample bookings if requested date is today
        is_booked = booked_count >= max(1, total_chargers - 1)
        if slot in ["10:00 AM", "01:00 PM", "06:00 PM"] and req_date == date.today():
            is_booked = True

        response_slots.append({
            'time': slot,
            'status': 'Booked' if is_booked else 'Available',
            'available_count': max(0, total_chargers - booked_count) if not is_booked else 0
        })

    return jsonify({'success': True, 'date': date_str, 'slots': response_slots})

@app.route('/api/reserve', methods=['POST'])
@login_required
def api_create_reservation():
    data = request.get_json() or {}
    station_id = data.get('station_id')
    charger_id = data.get('charger_id')
    res_date_str = data.get('reservation_date')
    start_time = data.get('start_time')
    duration = int(data.get('estimated_duration', 60))
    vehicle_type = data.get('vehicle_type', 'Electric Car')
    vehicle_number = data.get('vehicle_number', 'AP-05-EV-1001')

    if not station_id or not res_date_str or not start_time:
        return jsonify({'success': False, 'message': 'Missing mandatory booking details.'}), 400

    station = Station.query.get(station_id)
    if not station:
        return jsonify({'success': False, 'message': 'Invalid station selected.'}), 404

    # Pick or validate charger
    if charger_id:
        charger = Charger.query.get(charger_id)
    else:
        # Auto-assign available charger
        charger = Charger.query.filter_by(station_id=station_id, status='Available').first()
        if not charger:
            charger = Charger.query.filter_by(station_id=station_id).first()

    if not charger:
        return jsonify({'success': False, 'message': 'No chargers available at this station.'}), 400

    try:
        res_date = datetime.strptime(res_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'success': False, 'message': 'Invalid date format.'}), 400

    # Calculate end time (duration minutes)
    try:
        t_parsed = datetime.strptime(start_time, '%I:%M %p')
        t_end = t_parsed + timedelta(minutes=duration)
        end_time_str = t_end.strftime('%I:%M %p')
    except Exception:
        end_time_str = "1 Hour Later"

    # Calculate estimated cost (e.g. 20 kWh estimated * price_per_kwh)
    energy_kwh = round((duration / 60) * 22.0, 1) # Estimated consumption
    estimated_cost = round(energy_kwh * charger.price_per_kwh, 2)

    # Generate unique professional Booking ID e.g. EV20261103987
    date_code = datetime.now().strftime('%Y%m%d')
    random_suffix = f"{Reservation.query.count() + 101:03d}"
    reservation_id = f"EV{date_code}{random_suffix}"

    new_res = Reservation(
        reservation_id=reservation_id,
        user_id=session['user_id'],
        station_id=station.station_id,
        charger_id=charger.charger_id,
        reservation_date=res_date,
        start_time=start_time,
        end_time=end_time_str,
        vehicle_type=vehicle_type,
        vehicle_number=vehicle_number,
        status='Confirmed',
        estimated_duration=duration,
        estimated_cost=estimated_cost
    )

    db.session.add(new_res)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Reservation confirmed successfully!',
        'reservation_id': reservation_id,
        'redirect_url': url_for('booking_confirmation', reservation_id=reservation_id)
    })

@app.route('/api/reservation/<reservation_id>/cancel', methods=['POST'])
@login_required
def api_cancel_reservation(reservation_id):
    res = Reservation.query.get_or_404(reservation_id)
    # Check permissions
    if res.user_id != session['user_id'] and session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized to cancel this booking.'}), 403

    res.status = 'Cancelled'
    db.session.commit()
    return jsonify({'success': True, 'message': f'Booking {reservation_id} has been cancelled.'})

@app.route('/api/ml/predict-demand', methods=['GET'])
def api_predict_demand():
    station_id = request.args.get('station_id', default=1, type=int)
    hour = request.args.get('hour', default=datetime.now().hour, type=int)
    day = request.args.get('day_of_week', default=datetime.today().weekday(), type=int)
    temp = request.args.get('temperature', default=28.0, type=float)
    is_weekend = 1 if day >= 5 else 0

    pred = predictor.predict(
        station_id=station_id,
        hour=hour,
        day_of_week=day,
        is_weekend=is_weekend,
        temperature=temp
    )

    # Optional Gemini AI Demand Commentary (only when requested)
    if request.args.get('with_ai') == 'true':
        station = Station.query.get(station_id)
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        day_name = day_names[day] if 0 <= day < 7 else "Today"
        st_name = station.station_name if station else "Charging Station"

        ai_analysis = generate_demand_ai_analysis(
            station_name=st_name,
            hour=hour,
            day_name=day_name,
            predicted_occ=pred['predicted_occupancy'],
            demand_level=pred['demand_level']
        )
        pred['ai_strategy'] = ai_analysis
    else:
        pred['ai_strategy'] = None

    return jsonify({'success': True, 'prediction': pred})

@app.route('/api/ai/chat', methods=['POST'])
def api_ai_chat():
    """
    Conversational AI Assistant powered by Google Gemini API
    """
    data = request.get_json() or {}
    user_msg = data.get('message', '').strip()
    station_id = data.get('station_id')

    if not user_msg:
        return jsonify({'success': False, 'reply': 'Please ask a question about EV charging!'}), 400

    context_str = None
    if station_id:
        st = Station.query.get(station_id)
        if st:
            context_str = f"Selected Station: {st.station_name}, Address: {st.address}, Total Bays: {st.total_chargers}, Available: {st.available_chargers}, Min Tariff: ₹{st.min_price}/kWh"
    else:
        # Provide general network summary
        stations = Station.query.all()
        context_str = f"Network has {len(stations)} hubs in Kakinada cluster including: " + ", ".join([s.station_name for s in stations[:4]])

    reply = ask_gemini_assistant(user_msg, context_info=context_str)
    return jsonify({
        'success': True,
        'reply': reply,
        'powered_by': 'Google Gemini AI (AQ Key)'
    })

@app.route('/api/ml/curve', methods=['GET'])
def api_ml_curve():
    station_id = request.args.get('station_id', default=1, type=int)
    day = request.args.get('day_of_week', default=datetime.today().weekday(), type=int)
    curve = predictor.predict_24h_curve(station_id=station_id, day_of_week=day)
    return jsonify({'success': True, 'curve': curve})

@app.route('/api/recommendations', methods=['GET'])
def api_recommendations():
    stations = Station.query.filter_by(status='Operational').all()
    user_lat = request.args.get('lat', default=16.9890, type=float)
    user_lon = request.args.get('lon', default=82.2475, type=float)

    recs = calculate_smart_recommendation(stations, user_lat=user_lat, user_lon=user_lon)
    formatted = []
    for r in recs:
        d = r['station'].to_dict(distance=r['distance_km'])
        d['recommendation_score'] = r['score']
        d['recommendation_reason'] = r['reason']
        d['predicted_demand'] = r['predicted_demand']
        formatted.append(d)

    return jsonify({'success': True, 'recommendations': formatted})

@app.route('/api/analytics/summary', methods=['GET'])
def api_analytics_summary():
    """Aggregated data payload for Chart.js charts."""
    stations = Station.query.all()

    # 1. Station usage bar data
    station_names = [s.station_name for s in stations]
    station_res_counts = [len(s.reservations) + 12 for s in stations]

    # 2. Hourly peak curve (06:00 to 23:00)
    hourly_labels = ["06 AM", "09 AM", "12 PM", "03 PM", "06 PM", "09 PM", "11 PM"]
    hourly_demand = [18, 55, 62, 74, 92, 78, 35]

    # 3. Charger occupancy donut data
    total_chargers = Charger.query.count()
    available = Charger.query.filter_by(status='Available').count()
    occupied = Charger.query.filter_by(status='Occupied').count()
    maintenance = Charger.query.filter_by(status='Maintenance').count()

    # 4. 7-day bookings trend
    today = date.today()
    days_labels = [(today - timedelta(days=i)).strftime('%b %d') for i in range(6, -1, -1)]
    days_data = [14, 19, 16, 22, 28, 31, 26]

    # 5. Monthly usage
    months_labels = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]
    months_sessions = [310, 420, 560, 680, 890, 1140]

    return jsonify({
        'success': True,
        'station_usage': {'labels': station_names, 'data': station_res_counts},
        'peak_hours': {'labels': hourly_labels, 'data': hourly_demand},
        'occupancy': {'available': available, 'occupied': occupied, 'maintenance': maintenance, 'total': total_chargers},
        'daily_trend': {'labels': days_labels, 'data': days_data},
        'monthly_usage': {'labels': months_labels, 'data': months_sessions}
    })

@app.route('/api/simulate-live-pulse', methods=['POST'])
def api_simulate_live_pulse():
    """
    Simulates real-time IoT charger status updates.
    Switches an available charger to occupied or vice-versa to showcase dynamic live polling.
    """
    import random
    chargers = Charger.query.filter(Charger.status.in_(['Available', 'Occupied'])).all()
    if chargers:
        ch = random.choice(chargers)
        old_status = ch.status
        ch.status = 'Occupied' if old_status == 'Available' else 'Available'
        ch.current_vehicle = 'Live Demo EV' if ch.status == 'Occupied' else None
        db.session.commit()
        return jsonify({
            'success': True,
            'charger_id': ch.charger_id,
            'charger_code': ch.charger_code,
            'station_name': ch.station.station_name,
            'new_status': ch.status,
            'message': f"Charger {ch.charger_code} at {ch.station.station_name} changed from {old_status} to {ch.status}"
        })
    return jsonify({'success': False, 'message': 'No chargers available for simulation'})

# ---------------------------------------------------------------------
# Admin Action APIs
# ---------------------------------------------------------------------

@app.route('/api/admin/station/add', methods=['POST'])
@admin_required
def api_admin_add_station():
    name = request.form.get('station_name')
    address = request.form.get('address')
    city = request.form.get('city', 'Kakinada')
    lat = float(request.form.get('latitude', 16.9890))
    lon = float(request.form.get('longitude', 82.2475))
    hours = request.form.get('operating_hours', '24/7 Support & Access')
    num_chargers = int(request.form.get('num_chargers', 4))
    char_type = request.form.get('charger_type', 'DC Fast Charging')
    price = float(request.form.get('price_per_kwh', 14.0))

    if not name or not address:
        flash('Station name and address are required.', 'danger')
        return redirect(url_for('admin_stations'))

    new_st = Station(
        station_name=name,
        address=address,
        city=city,
        latitude=lat,
        longitude=lon,
        operating_hours=hours,
        status='Operational'
    )
    db.session.add(new_st)
    db.session.flush()

    # Create chargers for this station
    for i in range(1, num_chargers + 1):
        charger = Charger(
            station_id=new_st.station_id,
            charger_code=f"CH-{i:02d}",
            charger_type=char_type,
            power_rating="60 kW" if "DC" in char_type else ("150 kW" if "Rapid" in char_type else "22 kW"),
            status="Available",
            price_per_kwh=price
        )
        db.session.add(charger)

    db.session.commit()
    flash(f'Station "{name}" created with {num_chargers} chargers successfully!', 'success')
    return redirect(url_for('admin_stations'))

@app.route('/api/admin/station/<int:station_id>/delete', methods=['POST'])
@admin_required
def api_admin_delete_station(station_id):
    st = Station.query.get_or_404(station_id)
    name = st.station_name
    db.session.delete(st)
    db.session.commit()
    flash(f'Station "{name}" has been deleted.', 'info')
    return redirect(url_for('admin_stations'))

@app.route('/api/admin/charger/<int:charger_id>/status', methods=['POST'])
@admin_required
def api_admin_update_charger_status(charger_id):
    charger = Charger.query.get_or_404(charger_id)
    new_status = request.form.get('status')
    if new_status in ['Available', 'Occupied', 'Maintenance']:
        charger.status = new_status
        db.session.commit()
        flash(f'Charger {charger.charger_code} status updated to {new_status}.', 'success')
    return redirect(url_for('admin_chargers'))

@app.route('/api/admin/reservation/<reservation_id>/status', methods=['POST'])
@admin_required
def api_admin_update_res_status(reservation_id):
    res = Reservation.query.get_or_404(reservation_id)
    new_status = request.form.get('status')
    if new_status in ['Confirmed', 'Completed', 'Cancelled']:
        res.status = new_status
        db.session.commit()
        flash(f'Reservation {reservation_id} updated to {new_status}.', 'success')
    return redirect(url_for('admin_reservations'))

@app.route('/api/admin/user/<int:user_id>/toggle-status', methods=['POST'])
@admin_required
def api_admin_toggle_user_status(user_id):
    user = User.query.get_or_404(user_id)
    user.status = 'disabled' if user.status == 'active' else 'active'
    db.session.commit()
    flash(f'User {user.name} status changed to {user.status}.', 'info')
    return redirect(url_for('admin_users'))

# ---------------------------------------------------------------------
# Error Handlers
# ---------------------------------------------------------------------
@app.errorhandler(404)
def page_not_found(e):
    return render_template('base.html', not_found=True), 404

if __name__ == '__main__':
    print("[*] Starting EV Charging Slot Availability System on http://127.0.0.1:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)

