import os
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
# Load environment variables from .env file
load_dotenv(os.path.join(BASE_DIR, '.env'))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'ev-charge-smart-secret-key-2026-mini-project')
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)

    # Google Gemini AI API Configuration
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', 'AQ.Ab8RN6KWp4QQdyaHuKt5OrQX7lGVo10kqqiqe_a94rEKgRzxfA')
    GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-3.5-flash-lite')

    # Database Configuration:
    # Supports both SQLite (default for instant run) and MySQL (for production mini-project demo)
    DB_TYPE = os.environ.get('DB_TYPE', 'sqlite').lower()

    if DB_TYPE == 'mysql':
        MYSQL_USER = os.environ.get('MYSQL_USER', 'root')
        MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', 'password')
        MYSQL_HOST = os.environ.get('MYSQL_HOST', 'localhost')
        MYSQL_PORT = os.environ.get('MYSQL_PORT', '3306')
        MYSQL_DB = os.environ.get('MYSQL_DB', 'ev_charge_db')
        SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
    else:
        # SQLite database file stored right inside project root
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'ev_charge.db')}"

    SQLALCHEMY_TRACK_MODIFICATIONS = False
