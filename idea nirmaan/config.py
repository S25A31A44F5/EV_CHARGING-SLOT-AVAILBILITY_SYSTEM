"""
Application Configuration Module
Loads environment settings and API keys.
"""

import os

# Default fallback values or environment variables
API_KEY = os.environ.get("API_KEY", "AQ.Ab8RN6IAGzZNjOp70LZ0ti9IFEcSjokcFujDn7PF7tNzZvQwvQ")
EXTERNAL_API_KEY = os.environ.get("EXTERNAL_API_KEY", API_KEY)
SECRET_KEY = os.environ.get("SECRET_KEY", "ev_charge_secure_mini_project_secret_key_2026")

# Database configuration toggle
USE_MYSQL = os.environ.get("USE_MYSQL", "False").lower() in ("true", "1", "yes")
MYSQL_CONFIG = {
    'host': os.environ.get("MYSQL_HOST", "localhost"),
    'user': os.environ.get("MYSQL_USER", "root"),
    'password': os.environ.get("MYSQL_PASSWORD", "password"),
    'database': os.environ.get("MYSQL_DATABASE", "ev_charging_db")
}
