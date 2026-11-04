"""
EV Charging Slot Availability System
OpenStreetMap & Overpass API Service
Fetches actual real-world EV charging station coordinates, tags, and operators.
Includes caching, multiple mirror fallbacks, and Nominatim geocoding.
"""

import os
import json
import time
import math
import requests

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cache')
CACHE_FILE = os.path.join(CACHE_DIR, 'overpass_cache.json')
BASE_OSM_FILE = os.path.join(CACHE_DIR, 'osm_andhra_pradesh.json')
CACHE_TTL = 3600  # 1 hour cache TTL

OVERPASS_SERVERS = [
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter'
]

HEADERS = {
    'User-Agent': 'EVChargingSlotAvailabilitySystem/2.0 (college-cse-mini-project; contact: admin@evcharge.edu)',
    'Accept': 'application/json, text/plain, */*'
}

# In-memory cache dictionary
_MEMORY_CACHE = {}


def _get_cache_key(lat, lon, radius):
    return f"{round(lat, 2)}_{round(lon, 2)}_{int(radius)}"


def _load_disk_cache():
    global _MEMORY_CACHE
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                _MEMORY_CACHE = json.load(f)
        except Exception as e:
            print(f"[!] Warning reading cache file: {e}")
            _MEMORY_CACHE = {}


def _save_disk_cache():
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(_MEMORY_CACHE, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[!] Warning saving cache file: {e}")


def load_baseline_osm_stations():
    """Loads baseline verified OpenStreetMap charging stations from disk."""
    if os.path.exists(BASE_OSM_FILE):
        try:
            with open(BASE_OSM_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[!] Warning reading baseline OSM stations: {e}")
    return []


_load_disk_cache()


def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points on the earth (in kilometers).
    """
    try:
        r = 6371.0  # Earth radius in kilometers
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = math.sin(delta_phi / 2.0) ** 2 + \
            math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(r * c, 2)
    except Exception:
        return 0.0


def fetch_osm_charging_stations(lat=16.9890, lon=82.2475, radius_meters=50000):
    """
    Queries real EV charging stations from OpenStreetMap via Overpass API.
    Uses bounding box for speed and falls back to cached verified OSM nodes.
    """
    cache_key = _get_cache_key(lat, lon, radius_meters)
    now = time.time()

    # Check cache first
    if cache_key in _MEMORY_CACHE:
        entry = _MEMORY_CACHE[cache_key]
        if now - entry.get('timestamp', 0) < CACHE_TTL:
            return entry.get('stations', [])

    # Calculate bounding box
    delta_lat = (radius_meters / 1000.0) / 111.0
    cos_lat = math.cos(math.radians(lat))
    delta_lon = (radius_meters / 1000.0) / (111.0 * (cos_lat if cos_lat > 0.1 else 0.1))

    min_lat = round(lat - delta_lat, 4)
    max_lat = round(lat + delta_lat, 4)
    min_lon = round(lon - delta_lon, 4)
    max_lon = round(lon + delta_lon, 4)

    query = f"""[out:json][timeout:6];
(
  node["amenity"="charging_station"]({min_lat},{min_lon},{max_lat},{max_lon});
);
out center tags qt 35;"""

    stations = []
    success = False

    # Attempt live query with short timeout (4s)
    for server in OVERPASS_SERVERS[:2]:
        try:
            resp = requests.post(server, data={'data': query}, headers=HEADERS, timeout=4)
            if resp.status_code == 200:
                raw_data = resp.json()
                elements = raw_data.get('elements', [])
                if elements:
                    stations = _parse_overpass_elements(elements, user_lat=lat, user_lon=lon)
                    success = True
                    break
        except Exception:
            continue

    if not success or not stations:
        # Load verified baseline OSM elements and filter by distance
        base_elements = load_baseline_osm_stations()
        nearby_base = []
        radius_km = radius_meters / 1000.0
        for el in base_elements:
            el_lat = el.get('lat')
            el_lon = el.get('lon')
            dist = haversine_distance(lat, lon, el_lat, el_lon)
            if dist <= radius_km:
                nearby_base.append(el)

        stations = _parse_overpass_elements(nearby_base, user_lat=lat, user_lon=lon)

    # Save to memory and disk cache
    _MEMORY_CACHE[cache_key] = {
        'timestamp': now,
        'stations': stations
    }
    _save_disk_cache()
    return stations


def _parse_overpass_elements(elements, user_lat=None, user_lon=None):
    """
    Normalizes raw OpenStreetMap Overpass elements into clean station objects.
    Extracts real names, operators, connector types, and addresses.
    """
    parsed = []
    for el in elements:
        tags = el.get('tags', {})
        st_lat = el.get('lat') or el.get('center', {}).get('lat')
        st_lon = el.get('lon') or el.get('center', {}).get('lon')

        if not st_lat or not st_lon:
            continue

        osm_id = el.get('id')
        operator = tags.get('operator') or tags.get('brand') or tags.get('network') or 'Public / Independent'
        name = tags.get('name')

        if not name:
            if operator and operator != 'Public / Independent':
                name = f"{operator} EV Charging Station"
            else:
                name = "Public EV Charging Station"

        # Address resolution from OSM tags
        if tags.get('addr:full'):
            address = tags.get('addr:full')
        else:
            addr_parts = []
            if tags.get('addr:housenumber') or tags.get('addr:street'):
                addr_parts.append(f"{tags.get('addr:housenumber', '')} {tags.get('addr:street', '')}".strip())
            if tags.get('addr:suburb') or tags.get('addr:neighbourhood'):
                addr_parts.append(tags.get('addr:suburb') or tags.get('addr:neighbourhood'))
            if tags.get('addr:city') or tags.get('addr:district'):
                addr_parts.append(tags.get('addr:city') or tags.get('addr:district'))
            if tags.get('addr:state'):
                addr_parts.append(tags.get('addr:state'))
            address = ", ".join([p for p in addr_parts if p]) if addr_parts else f"Near Coordinates ({st_lat:.4f}, {st_lon:.4f})"

        # Sockets & connector detection
        connectors = []
        for key in tags:
            if key.startswith('socket:') and tags[key] in ['yes', '1', '2', '3', '4']:
                socket_name = key.replace('socket:', '').replace('_', ' ').title()
                connectors.append(socket_name)

        if not connectors:
            connectors = ['CCS-2 (DC Fast)', 'Type 2 (AC)']

        primary_type = "DC Fast & AC" if len(connectors) > 1 else connectors[0]
        if 'Ccs' in primary_type or 'Combo' in primary_type:
            primary_type = "DC Fast Charging"
        elif 'Type 2' in primary_type:
            primary_type = "AC Charging"

        try:
            capacity = int(tags.get('capacity', '2'))
        except ValueError:
            capacity = 2

        power = tags.get('maxpower') or tags.get('output') or tags.get('voltage')
        if not power:
            power = "50 kW (DC)" if "DC" in primary_type else "22 kW (AC)"

        fee_info = tags.get('charge') or tags.get('fee')
        if fee_info and fee_info != 'yes':
            tariff_str = fee_info
            min_price = 14.50
        else:
            tariff_str = "Standard Grid Tariff"
            min_price = 14.00

        dist_km = haversine_distance(user_lat, user_lon, st_lat, st_lon) if (user_lat and user_lon) else 2.5

        parsed.append({
            'station_id': f"osm_{osm_id}",
            'osm_id': osm_id,
            'station_name': name,
            'address': address,
            'city': tags.get('addr:city') or tags.get('addr:district') or 'Andhra Pradesh',
            'latitude': float(st_lat),
            'longitude': float(st_lon),
            'operating_hours': tags.get('opening_hours') or '24/7 Access',
            'status': 'Mapped on OpenStreetMap',
            'total_chargers': max(1, capacity),
            'available_chargers': 'Unknown',
            'occupied_chargers': 'Unknown',
            'waiting_time': 'Unknown',
            'estimated_charge_time': '30-45 min',
            'primary_charging_type': primary_type,
            'connectors': connectors,
            'power_rating': power,
            'operator': operator,
            'min_price': min_price,
            'tariff_str': tariff_str,
            'distance': dist_km,
            'source': 'OpenStreetMap (Overpass API)',
            'is_network_station': False,
            'google_maps_url': f"https://www.google.com/maps/dir/?api=1&destination={st_lat},{st_lon}",
            'availability_badge': {
                'text': 'Live Status: Unknown',
                'class': 'badge-osm',
                'color': '#3B82F6',
                'desc': 'Verified real-world location from OpenStreetMap. Live socket telemetry not connected.'
            }
        })

    parsed.sort(key=lambda s: s['distance'])
    return parsed


def geocode_location(query):
    """
    Geocodes city, area, or landmark using Nominatim OpenStreetMap Search API.
    Returns latitude, longitude, and formatted name.
    """
    if not query or not query.strip():
        return None

    cache_key = f"geo_{query.lower().strip()}"
    now = time.time()
    if cache_key in _MEMORY_CACHE:
        entry = _MEMORY_CACHE[cache_key]
        if now - entry.get('timestamp', 0) < 86400 * 7:
            return entry.get('data')

    # Known Indian/AP hubs dictionary for instantaneous response
    known_hubs = {
        'kakinada': {'display_name': 'Kakinada, Andhra Pradesh, India', 'latitude': 16.989065, 'longitude': 82.247465},
        'bhanugudi': {'display_name': 'Bhanugudi Junction, Kakinada, Andhra Pradesh, India', 'latitude': 16.963212, 'longitude': 82.238124},
        'rajahmundry': {'display_name': 'Rajahmundry, Andhra Pradesh, India', 'latitude': 17.0005, 'longitude': 81.8040},
        'visakhapatnam': {'display_name': 'Visakhapatnam, Andhra Pradesh, India', 'latitude': 17.6868, 'longitude': 83.2185},
        'vizag': {'display_name': 'Visakhapatnam (Vizag), Andhra Pradesh, India', 'latitude': 17.6868, 'longitude': 83.2185},
        'vijayawada': {'display_name': 'Vijayawada, Andhra Pradesh, India', 'latitude': 16.5062, 'longitude': 80.6480},
        'guntur': {'display_name': 'Guntur, Andhra Pradesh, India', 'latitude': 16.3067, 'longitude': 80.4365},
        'hyderabad': {'display_name': 'Hyderabad, Telangana, India', 'latitude': 17.3850, 'longitude': 78.4867},
        'bengaluru': {'display_name': 'Bengaluru, Karnataka, India', 'latitude': 12.9716, 'longitude': 77.5946},
        'chennai': {'display_name': 'Chennai, Tamil Nadu, India', 'latitude': 13.0827, 'longitude': 80.2707}
    }

    q_clean = query.lower().strip()
    if q_clean in known_hubs:
        return known_hubs[q_clean]

    url = 'https://nominatim.openstreetmap.org/search'
    params = {
        'q': query,
        'format': 'json',
        'limit': 1,
        'countrycodes': 'in',
        'addressdetails': 1
    }

    try:
        resp = requests.get(url, params=params, headers=HEADERS, timeout=6)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                item = data[0]
                result = {
                    'display_name': item.get('display_name'),
                    'latitude': float(item.get('lat')),
                    'longitude': float(item.get('lon')),
                    'type': item.get('type')
                }
                _MEMORY_CACHE[cache_key] = {'timestamp': now, 'data': result}
                _save_disk_cache()
                return result
    except Exception as e:
        print(f"[!] Geocoding error for '{query}': {e}")

    # Fallback partial matching
    for city, info in known_hubs.items():
        if city in q_clean:
            return info

    return None
