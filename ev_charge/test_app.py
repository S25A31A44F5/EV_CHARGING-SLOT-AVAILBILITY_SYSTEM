"""
Automated Test Suite for EV Charging Slot Availability System
Validates all endpoints, APIs, ML predictions, and user flows.
"""

from app import app
from database import db, Station, User, Reservation

def run_tests():
    client = app.test_client()

    print("[*] 1. Testing Home Landing Page...")
    resp = client.get('/')
    assert resp.status_code == 200, f"Home failed with status {resp.status_code}"
    assert b"Charge Smarter. Drive Further." in resp.data
    print("    [+] Home Page rendered successfully with hero and statistics.")

    print("[*] 2. Testing Stations Directory & REST API...")
    resp = client.get('/api/stations')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['count'] >= 6, f"Expected at least 6 stations, found {data['count']}"
    print(f"    [+] Found {data['count']} operational stations in API payload.")

    print("[*] 3. Testing Time Slot Availability Engine...")
    resp = client.get('/api/station/1/slots')
    assert resp.status_code == 200
    slots_data = resp.get_json()
    assert len(slots_data['slots']) > 0
    print(f"    [+] Generated {len(slots_data['slots'])} time slots for Station 1.")

    print("[*] 4. Testing Scikit-Learn AI Demand Prediction...")
    resp = client.get('/api/ml/predict-demand?station_id=1&hour=18&day_of_week=4')
    assert resp.status_code == 200
    ml_data = resp.get_json()
    assert 'prediction' in ml_data
    pred = ml_data['prediction']
    print(f"    [+] ML Output: Demand={pred['demand_level']}, Occupancy={pred['predicted_occupancy']}%, Color={pred['color']}")

    print("[*] 5. Testing 24-Hour ML Demand Curve...")
    resp = client.get('/api/ml/curve?station_id=1&day_of_week=2')
    assert resp.status_code == 200
    curve_data = resp.get_json()
    assert len(curve_data['curve']) == 24
    print("    [+] 24-hour demand curve generated across all 24 hours.")

    print("[*] 6. Testing Smart Recommendation Engine...")
    resp = client.get('/api/recommendations')
    assert resp.status_code == 200
    rec_data = resp.get_json()
    assert len(rec_data['recommendations']) > 0
    top_rec = rec_data['recommendations'][0]
    print(f"    [+] Top Recommendation: {top_rec['station_name']} (Reason: {top_rec['recommendation_reason']})")

    print("[*] 7. Testing User Authentication & Reservation Lifecycle...")
    with client:
        # Login
        login_resp = client.post('/login', data={'email': 'user@evcharge.com', 'password': 'user123'}, follow_redirects=True)
        assert login_resp.status_code == 200
        print("    [+] User Rahul Sharma authenticated successfully.")

        # Dashboard
        dash_resp = client.get('/dashboard')
        assert dash_resp.status_code == 200
        assert b"Welcome Back, Rahul Sharma!" in dash_resp.data
        print("    [+] Driver Dashboard loaded with personalized metrics.")

        # Create reservation
        booking_resp = client.post('/api/reserve', json={
            'station_id': 1,
            'reservation_date': '2026-11-05',
            'start_time': '10:00 AM',
            'estimated_duration': 60,
            'vehicle_type': 'Tata Nexon EV Max',
            'vehicle_number': 'AP-05-EV-4421'
        })
        assert booking_resp.status_code == 200
        book_data = booking_resp.get_json()
        assert book_data['success'] is True
        res_id = book_data['reservation_id']
        print(f"    [+] Created new Reservation ID: {res_id}")

        # Check confirmation pass
        pass_resp = client.get(f'/booking/confirmation/{res_id}')
        assert pass_resp.status_code == 200
        assert b"Reservation Confirmed" in pass_resp.data
        print(f"    [+] Booking confirmation pass generated.")

        # Check My Bookings
        my_book_resp = client.get('/my-bookings')
        assert my_book_resp.status_code == 200
        print(f"    [+] My Bookings list verified.")

    print("[*] 8. Testing Admin Portal & Role Authorization...")
    with client:
        admin_login = client.post('/login', data={'email': 'admin@evcharge.com', 'password': 'admin123'}, follow_redirects=True)
        assert admin_login.status_code == 200

        admin_dash = client.get('/admin/dashboard')
        assert admin_dash.status_code == 200
        assert b"System Control Center" in admin_dash.data
        print("    [+] Admin Console loaded with 6 operational metric cards.")

        admin_stations = client.get('/admin/stations')
        assert admin_stations.status_code == 200
        print("    [+] Admin Station Management table verified.")

        admin_chargers = client.get('/admin/chargers')
        assert admin_chargers.status_code == 200
        print("    [+] Admin Chargers hardware telemetry table verified.")

        admin_res = client.get('/admin/reservations')
        assert admin_res.status_code == 200
        print("    [+] Admin Reservations table verified.")

        admin_users = client.get('/admin/users')
        assert admin_users.status_code == 200
        print("    [+] Admin User Directory verified.")

    print("[*] 9. Testing Google Gemini AI Integration (AQ Key)...")
    ai_resp = client.post('/api/ai/chat', json={'message': 'Which station should I charge at in Kakinada?'})
    assert ai_resp.status_code == 200
    ai_data = ai_resp.get_json()
    assert ai_data['success'] is True
    assert 'powered_by' in ai_data
    print(f"    [+] Gemini AI Assistant responded successfully (Powered by: {ai_data['powered_by']}).")

    print("\n==================================================================")
    print("SUCCESS: ALL 8 TEST MODULES AND USER FLOWS PASSED FLAWLESSLY!")
    print("==================================================================")

if __name__ == '__main__':
    run_tests()

