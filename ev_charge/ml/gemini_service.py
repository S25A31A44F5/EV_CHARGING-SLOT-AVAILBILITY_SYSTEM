"""
EV Charging Slot Availability System
Gemini AI Service Module
Powers conversational AI driver support, intelligent charging advice, and demand analysis
"""

import os
import requests
from config import Config

GEMINI_API_KEY = Config.GEMINI_API_KEY
DEFAULT_MODEL = Config.GEMINI_MODEL

SYSTEM_PROMPT = """You are '⚡ EV Charge AI Assistant', an intelligent, polite, and technical AI assistant for the 'EV Charging Slot Availability System'.
Your job is to assist Electric Vehicle (EV) drivers with:
1. Finding and recommending optimal charging stations based on location (primarily Kakinada / Andhra Pradesh charging cluster), speed, and price.
2. Explaining EV charging concepts: AC Level 2 (Type 2, 11-22 kW) vs DC Fast Charging (CCS2, 50-60 kW) vs Ultra-Rapid (120-180 kW).
3. Advising on battery health (e.g. charging 20% to 80% rule, avoiding heat degradation).
4. Explaining slot reservations, avoiding peak hours (5-9 PM), and saving charging costs.

Be concise, helpful, friendly, and structure answers with clear bullet points. Use emojis like ⚡, 🔋, ⏱️, 💰 appropriately."""

def ask_gemini_assistant(user_message, context_info=None):
    """
    Sends a query to Google Gemini API using the configured API key if present.
    If no API key is provided, falls back to the smart offline knowledge engine.
    """
    api_key = os.environ.get('GEMINI_API_KEY') or Config.GEMINI_API_KEY
    if not api_key:
        return get_smart_offline_reply(user_message)

    # Build prompt with system context
    prompt_text = f"{SYSTEM_PROMPT}\n\n"
    if context_info:
        prompt_text += f"CURRENT PLATFORM CONTEXT:\n{context_info}\n\n"
    prompt_text += f"USER QUESTION: {user_message}\nASSISTANT ANSWER:"

    models_to_try = [DEFAULT_MODEL, 'gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-flash-latest']

    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            payload = {
                "contents": [
                    {
                        "parts": [{"text": prompt_text}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.4,
                    "maxOutputTokens": 600
                }
            }
            resp = requests.post(url, json=payload, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                reply = data['candidates'][0]['content']['parts'][0]['text'].strip()
                return reply
        except Exception as e:
            print(f"[!] Error calling Gemini model {model}: {e}")
            continue

    # Graceful fallback if network or API has intermittent error
    return get_smart_offline_reply(user_message)


def generate_demand_ai_analysis(station_name, hour, day_name, predicted_occ, demand_level):
    """
    Generates tailored AI commentary on predicted demand for the ML Demand page.
    """
    prompt = f"Analyze EV charging demand for {station_name} at {hour:02d}:00 on {day_name}. Predicted occupancy is {predicted_occ}% (Demand Level: {demand_level}). In 2-3 sentences, provide smart driver advice (e.g., whether to reserve now or charge during off-peak)."
    return ask_gemini_assistant(prompt)


def get_smart_offline_reply(user_message):
    """Fallback knowledge engine in case of network unavailability."""
    msg = user_message.lower()
    if 'fast' in msg or 'dc' in msg or 'speed' in msg:
        return "⚡ **DC Fast Charging (50–60 kW):** Charges most EVs (e.g., Tata Nexon, MG ZS) from 20% to 80% in approximately 45–55 minutes. Ultra-Rapid (120–150 kW) can do it in under 30 minutes! For daily top-ups, AC Type 2 (11–22 kW) is gentler on your battery."
    elif 'peak' in msg or 'time' in msg or 'hour' in msg:
        return "⏱️ **Best Charging Hours:** Peak station demand occurs during commute hours (08:00–10:00 AM and 05:00–09:00 PM). For zero wait times and lower grid load, charge between **11:00 AM – 03:00 PM** or after **09:30 PM**."
    elif 'cost' in msg or 'price' in msg or 'tariff' in msg:
        return "💰 **Charging Tariffs:** In our network, AC charging ranges from ₹10.50 to ₹12.00/kWh, while DC Fast charging ranges from ₹13.50 to ₹16.50/kWh. A typical 20 kWh top-up costs approximately ₹250 to ₹330."
    elif 'nexon' in msg or 'punch' in msg or 'tata' in msg:
        return "🔋 **Tata EV Recommendation:** For Tata Nexon EV (40.5 kWh battery) or Punch EV (35 kWh), using a DC Fast Charger (60 kW) at GreenCharge Station or EcoVolt Hub will take you from 20% to 80% in ~45 mins for approx ₹280–₹310."
    else:
        return "⚡ **EV Smart Assistant:** Welcome to EV Charge! You can find stations nearby, check real-time socket availability, and lock in your charging bay using the **Reserve Slot** menu. Feel free to ask about charging speeds, vehicle compatibility, or station recommendations!"

