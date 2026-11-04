"""
EV Charging Demand Predictor & Recommendation Engine
Scikit-Learn inference wrapper with heuristic fallbacks
"""

import os
import joblib
import numpy as np
import pandas as pd

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'demand_model.pkl')

def get_demand_category(occupancy):
    if occupancy < 35.0:
        return {'level': 'Low', 'color': '#10B981', 'badge': 'badge-success', 'desc': 'High chance of immediate charger availability'}
    elif occupancy < 65.0:
        return {'level': 'Medium', 'color': '#3B82F6', 'badge': 'badge-info', 'desc': 'Moderate charger availability, minor wait possible'}
    elif occupancy < 85.0:
        return {'level': 'High', 'color': '#F59E0B', 'badge': 'badge-warning', 'desc': 'High station utilization, reserve in advance'}
    else:
        return {'level': 'Very High', 'color': '#EF4444', 'badge': 'badge-danger', 'desc': 'Peak charging rush, reservation strongly advised'}


class DemandPredictor:
    def __init__(self):
        self.model = None
        self._load_model()

    def _load_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
            except Exception as e:
                print(f"[!] Error loading model artifact: {e}")
                self.model = None

    def predict(self, station_id=1, hour=14, day_of_week=2, is_weekend=0, temperature=28.0):
        """
        Predict occupancy % for a given station and time features.
        """
        if self.model is not None:
            features = pd.DataFrame([{
                'station_id': int(station_id),
                'hour': int(hour),
                'day_of_week': int(day_of_week),
                'is_weekend': int(is_weekend),
                'temperature': float(temperature)
            }])
            predicted_occ = float(self.model.predict(features)[0])
            predicted_occ = np.clip(predicted_occ, 5.0, 98.0)
        else:
            base = 40.0
            if 8 <= hour <= 10 or 17 <= hour <= 21:
                base = 78.0
            elif 0 <= hour <= 5:
                base = 15.0
            predicted_occ = base

        cat = get_demand_category(predicted_occ)
        return {
            'predicted_occupancy': round(predicted_occ, 1),
            'demand_level': cat['level'],
            'color': cat['color'],
            'badge': cat['badge'],
            'description': cat['desc']
        }

    def predict_24h_curve(self, station_id=1, day_of_week=2, temperature=28.0):
        """
        Generate 24-hour demand prediction profile for charts.
        """
        is_weekend = 1 if day_of_week >= 5 else 0
        curve = []
        for h in range(24):
            pred = self.predict(station_id, h, day_of_week, is_weekend, temperature)
            hour_str = f"{h:02d}:00"
            curve.append({
                'hour': hour_str,
                'occupancy': pred['predicted_occupancy'],
                'level': pred['demand_level'],
                'color': pred['color']
            })
        return curve


def calculate_smart_recommendation(stations, user_lat=16.9890, user_lon=82.2475, preferred_type=None):
    """
    Smart Multi-factor Recommendation Algorithm:
    Evaluates:
    1. Distance from user (using Haversine)
    2. Charger availability ratio
    3. Estimated waiting time
    4. Price per kWh
    5. Primary charging power
    6. Current ML predicted demand
    """
    predictor = DemandPredictor()
    scored_stations = []

    for station in stations:
        lat1, lon1 = np.radians(user_lat), np.radians(user_lon)
        lat2, lon2 = np.radians(station.latitude), np.radians(station.longitude)
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
        c = 2 * np.arcsin(np.sqrt(a))
        distance_km = round(6371 * c, 1)
        if distance_km < 0.5:
            distance_km = 0.8

        total = station.total_chargers or 1
        avail = station.available_chargers
        wait = station.waiting_time
        price = float(station.min_price)

        # Predict current demand
        ml_pred = predictor.predict(station.station_id, hour=15, day_of_week=3)

        # Multi-factor weights
        score_avail = (avail / total) * 35.0
        score_dist = max(0, 25.0 - (distance_km * 2.2))
        score_wait = max(0, 20.0 - (wait * 0.7))
        score_price = max(0, 10.0 - ((price - 10) * 0.5))
        score_ml = (100.0 - ml_pred['predicted_occupancy']) * 0.1

        total_score = round(score_avail + score_dist + score_wait + score_price + score_ml, 1)

        reasons = []
        if avail >= 3:
            reasons.append("High charger availability")
        elif avail > 0:
            reasons.append("Available slot right now")

        if wait == 0:
            reasons.append("Zero waiting time")
        elif wait <= 5:
            reasons.append("Minimal 5 min wait")

        if distance_km <= 3.0:
            reasons.append("Very close distance")

        if 'Rapid' in station.primary_charging_type:
            reasons.append("Ultra-rapid charging (150kW)")

        if price <= 13.0:
            reasons.append("Budget friendly rates")

        reason_str = " + ".join(reasons[:3]) if reasons else "Good charging choice"

        scored_stations.append({
            'station': station,
            'score': total_score,
            'distance_km': distance_km,
            'reason': reason_str,
            'predicted_demand': ml_pred['demand_level'],
            'predicted_occupancy': ml_pred['predicted_occupancy']
        })

    scored_stations.sort(key=lambda x: x['score'], reverse=True)
    return scored_stations
