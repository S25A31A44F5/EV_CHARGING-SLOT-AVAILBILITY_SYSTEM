"""
EV Charging Slot Availability System
Machine Learning Training Script - Demand Prediction Model
Using Scikit-Learn, Pandas, and NumPy
"""

import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'demand_model.pkl')

def generate_synthetic_historical_data(n_samples=2500):
    """
    Generate realistic historical EV charging session logs:
    - Peak hours in EV charging: morning commute (8-10 AM) and evening return (5-9 PM)
    - Weekends have shifted patterns (midday peaks 11 AM - 4 PM)
    - Temperature effects (extreme cold/hot increases EV battery climate drain -> higher charge frequency)
    """
    np.random.seed(42)

    station_ids = np.random.choice([1, 2, 3, 4, 5, 6], size=n_samples)
    hours = np.random.randint(0, 24, size=n_samples)
    days_of_week = np.random.randint(0, 7, size=n_samples) # 0=Monday, 6=Sunday
    is_weekend = (days_of_week >= 5).astype(int)
    temperatures = np.round(np.random.normal(loc=28.0, scale=6.0, size=n_samples), 1)

    occupancy = []
    for h, w, s, temp in zip(hours, is_weekend, station_ids, temperatures):
        # Base station popularity factor
        station_bias = {1: 15, 2: 10, 3: 12, 4: 8, 5: 5, 6: 14}.get(s, 10)

        # Base curve
        if w == 0:
            # Weekday curve: peaks at 8-10 AM and 5-9 PM
            if 8 <= h <= 10:
                base = 65 + np.random.uniform(5, 25)
            elif 17 <= h <= 21:
                base = 75 + np.random.uniform(10, 25)
            elif 11 <= h <= 16:
                base = 45 + np.random.uniform(0, 20)
            elif 0 <= h <= 5:
                base = 10 + np.random.uniform(0, 15)
            else:
                base = 35 + np.random.uniform(0, 20)
        else:
            # Weekend curve: peak at 11 AM - 5 PM
            if 11 <= h <= 17:
                base = 70 + np.random.uniform(5, 25)
            elif 18 <= h <= 21:
                base = 55 + np.random.uniform(0, 20)
            elif 0 <= h <= 6:
                base = 8 + np.random.uniform(0, 12)
            else:
                base = 40 + np.random.uniform(0, 20)

        # Temperature effect: above 34C or below 18C increases demand by 5-10%
        if temp > 34 or temp < 18:
            base += 6.5

        final_occ = np.clip(base + station_bias + np.random.normal(0, 4), 5, 98)
        occupancy.append(round(float(final_occ), 1))

    df = pd.DataFrame({
        'station_id': station_ids,
        'hour': hours,
        'day_of_week': days_of_week,
        'is_weekend': is_weekend,
        'temperature': temperatures,
        'occupancy': occupancy
    })

    return df

def train_and_save_model():
    print("[*] Generating synthetic EV charging dataset for Scikit-Learn training...")
    df = generate_synthetic_historical_data(n_samples=3500)

    X = df[['station_id', 'hour', 'day_of_week', 'is_weekend', 'temperature']]
    y = df['occupancy']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print(f"[*] Training RandomForestRegressor model on {len(X_train)} historical records...")
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=12,
        random_state=42,
        min_samples_split=4
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    print(f"[+] Model trained successfully. R2 Score: {r2:.4f}, RMSE: {np.sqrt(mse):.2f}%")

    # Save artifact
    joblib.dump(model, MODEL_PATH)
    print(f"[+] Model artifact persisted to {MODEL_PATH}")

    # Also save a sample CSV for demonstration
    csv_path = os.path.join(os.path.dirname(__file__), 'sample_historical_sessions.csv')
    df.head(200).to_csv(csv_path, index=False)
    print(f"[+] Sample training CSV saved to {csv_path}")

    return model

if __name__ == '__main__':
    train_and_save_model()

